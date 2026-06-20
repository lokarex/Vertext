use crate::ai::FileChangeSummary;
use git2::{Delta, Diff, DiffDelta, DiffLine, DiffLineType, DiffOptions, Patch, Repository};

const MAX_DIFF_CHARS: usize = 12_000;
const SUMMARY_BUDGET_DIVISOR: usize = 4;
const MIN_FILE_DETAIL_CHARS: usize = 160;
const OMISSION_MARKER_RESERVE: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffAnalysis {
    pub sampled_diff: String,
    pub files_changed: Vec<FileChangeSummary>,
}

#[derive(Debug)]
struct HunkMetadata {
    chars: usize,
}

#[derive(Debug)]
struct FileMetadata {
    diff_index: usize,
    header: String,
    hunks: Vec<HunkMetadata>,
    summary: FileChangeSummary,
    binary: bool,
}

impl FileMetadata {
    fn detail_chars(&self) -> usize {
        let content_chars: usize = self.hunks.iter().map(|hunk| hunk.chars).sum();
        self.header.chars().count()
            + content_chars
            + usize::from(self.binary) * binary_marker(&self.summary.path).chars().count()
    }
}

pub fn analyze_changes(repo: &Repository) -> Result<DiffAnalysis, String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    opts.patience(true).indent_heuristic(true);
    let diff = repo
        .diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    analyze_diff(&diff, MAX_DIFF_CHARS)
}

fn analyze_diff(diff: &Diff<'_>, max_chars: usize) -> Result<DiffAnalysis, String> {
    let mut files = collect_metadata(diff)?;
    files.sort_by(|left, right| left.summary.path.cmp(&right.summary.path));

    let files_changed = files.iter().map(|file| file.summary.clone()).collect();
    let summary = build_summary(&files, max_chars / SUMMARY_BUDGET_DIVISOR);
    let section_header = "\nSampled diff:\n";
    let fixed_chars = summary.chars().count() + section_header.chars().count();
    let detail_budget = max_chars.saturating_sub(fixed_chars);
    let detail_sizes: Vec<usize> = files.iter().map(FileMetadata::detail_chars).collect();
    let file_budgets = allocate_file_budgets(&detail_sizes, detail_budget);

    let mut sampled_diff = String::with_capacity(max_chars);
    sampled_diff.push_str(&summary);
    sampled_diff.push_str(section_header);

    for (file, budget) in files.iter().zip(file_budgets) {
        if budget == 0 {
            continue;
        }
        sampled_diff.push_str(&render_file(diff, file, budget)?);
    }

    let sampled_diff = truncate_chars(&sampled_diff, max_chars);
    Ok(DiffAnalysis {
        sampled_diff,
        files_changed,
    })
}

fn collect_metadata(diff: &Diff<'_>) -> Result<Vec<FileMetadata>, String> {
    let mut files = Vec::with_capacity(diff.deltas().len());

    for (diff_index, delta) in diff.deltas().enumerate() {
        let path = delta_path(&delta);
        let status = delta_status(delta.status()).to_string();
        let header = file_header(&delta);
        let patch = Patch::from_diff(diff, diff_index).map_err(|e| e.to_string())?;

        let (additions, deletions, hunks, binary) = if let Some(patch) = patch {
            let (_, additions, deletions) = patch.line_stats().map_err(|e| e.to_string())?;
            let mut hunks = Vec::with_capacity(patch.num_hunks());
            for hunk_index in 0..patch.num_hunks() {
                hunks.push(HunkMetadata {
                    chars: hunk_chars(&patch, hunk_index)?,
                });
            }
            (additions, deletions, hunks, false)
        } else {
            (0, 0, Vec::new(), true)
        };

        files.push(FileMetadata {
            diff_index,
            header,
            hunks,
            summary: FileChangeSummary {
                path,
                status,
                additions,
                deletions,
            },
            binary,
        });
    }

    Ok(files)
}

fn hunk_chars(patch: &Patch<'_>, hunk_index: usize) -> Result<usize, String> {
    let (hunk, line_count) = patch.hunk(hunk_index).map_err(|e| e.to_string())?;
    let mut chars = String::from_utf8_lossy(hunk.header()).chars().count();
    for line_index in 0..line_count {
        let line = patch
            .line_in_hunk(hunk_index, line_index)
            .map_err(|e| e.to_string())?;
        chars += formatted_line_chars(&line);
    }
    Ok(chars)
}

fn build_summary(files: &[FileMetadata], max_chars: usize) -> String {
    let heading = format!("Changed files ({}):\n", files.len());
    let entries: Vec<String> = files
        .iter()
        .map(|file| {
            format!(
                "- {} {} (+{} -{})\n",
                file.summary.status,
                file.summary.path,
                file.summary.additions,
                file.summary.deletions
            )
        })
        .collect();
    let full = format!("{}{}", heading, entries.concat());
    if full.chars().count() <= max_chars {
        return full;
    }

    let mut count = files.len().min(max_chars / 20);
    while count > 0 {
        let indices = evenly_spaced_indices(files.len(), count);
        let omitted = files.len().saturating_sub(indices.len());
        let marker = format!("- ... {omitted} files omitted from summary ...\n");
        let mut compact = heading.clone();
        for index in indices {
            compact.push_str(&entries[index]);
        }
        if omitted > 0 {
            compact.push_str(&marker);
        }
        if compact.chars().count() <= max_chars {
            return compact;
        }
        count -= 1;
    }

    truncate_chars(&heading, max_chars)
}

fn allocate_file_budgets(sizes: &[usize], total: usize) -> Vec<usize> {
    if sizes.is_empty() || total == 0 {
        return vec![0; sizes.len()];
    }

    let max_detailed_files = (total / MIN_FILE_DETAIL_CHARS).max(1).min(sizes.len());
    let selected = evenly_spaced_indices(sizes.len(), max_detailed_files);
    allocate_selected_budgets(sizes, total, &selected)
}

fn allocate_selected_budgets(sizes: &[usize], total: usize, selected: &[usize]) -> Vec<usize> {
    let mut budgets = vec![0; sizes.len()];
    let mut active = selected.to_vec();
    let mut remaining = total;

    while remaining > 0 && !active.is_empty() {
        let share = (remaining / active.len()).max(1);
        let mut granted = 0;
        for &index in &active {
            let available = sizes[index].saturating_sub(budgets[index]);
            let amount = available.min(share).min(remaining.saturating_sub(granted));
            budgets[index] += amount;
            granted += amount;
            if granted == remaining {
                break;
            }
        }
        remaining -= granted;
        active.retain(|&index| budgets[index] < sizes[index]);
        if granted == 0 {
            break;
        }
    }

    budgets
}

fn evenly_spaced_indices(len: usize, count: usize) -> Vec<usize> {
    if count == 0 || len == 0 {
        return Vec::new();
    }
    if count >= len {
        return (0..len).collect();
    }
    if count == 1 {
        return vec![0];
    }

    (0..count)
        .map(|position| position * (len - 1) / (count - 1))
        .collect()
}

fn render_file(diff: &Diff<'_>, file: &FileMetadata, budget: usize) -> Result<String, String> {
    if budget == 0 {
        return Ok(String::new());
    }

    let header = truncate_chars(&file.header, budget);
    let header_chars = header.chars().count();
    if header_chars == budget {
        return Ok(header);
    }

    if file.binary {
        let marker = binary_marker(&file.summary.path);
        return Ok(truncate_chars(&format!("{header}{marker}"), budget));
    }

    let Some(patch) = Patch::from_diff(diff, file.diff_index).map_err(|e| e.to_string())? else {
        return Ok(header);
    };
    let remaining = budget - header_chars;
    let hunk_sizes: Vec<usize> = file.hunks.iter().map(|hunk| hunk.chars).collect();
    let selected: Vec<usize> = (0..hunk_sizes.len()).collect();
    let hunk_budgets = allocate_selected_budgets(&hunk_sizes, remaining, &selected);

    let mut rendered = header;
    for (hunk_index, hunk_budget) in hunk_budgets.into_iter().enumerate() {
        if hunk_budget > 0 {
            rendered.push_str(&render_hunk(&patch, hunk_index, hunk_budget)?);
        }
    }
    Ok(truncate_chars(&rendered, budget))
}

fn render_hunk(patch: &Patch<'_>, hunk_index: usize, budget: usize) -> Result<String, String> {
    let (hunk, line_count) = patch.hunk(hunk_index).map_err(|e| e.to_string())?;
    let header = String::from_utf8_lossy(hunk.header()).into_owned();
    if header.chars().count() >= budget {
        return Ok(truncate_chars(&header, budget));
    }

    let full_size = hunk_chars(patch, hunk_index)?;
    if full_size <= budget {
        let mut rendered = header;
        for line_index in 0..line_count {
            let line = patch
                .line_in_hunk(hunk_index, line_index)
                .map_err(|e| e.to_string())?;
            rendered.push_str(&format_diff_line(&line));
        }
        return Ok(rendered);
    }

    let header_chars = header.chars().count();
    if budget <= header_chars + OMISSION_MARKER_RESERVE {
        return Ok(truncate_chars(&header, budget));
    }

    let line_budget = budget - header_chars - OMISSION_MARKER_RESERVE;
    let head_budget = line_budget / 2;
    let tail_budget = line_budget - head_budget;
    let mut head = String::new();
    let mut head_lines = 0;
    for line_index in 0..line_count {
        let line = patch
            .line_in_hunk(hunk_index, line_index)
            .map_err(|e| e.to_string())?;
        let formatted = format_diff_line(&line);
        let available = head_budget.saturating_sub(head.chars().count());
        if available == 0 {
            break;
        }
        if formatted.chars().count() > available {
            head.push_str(&truncate_chars(&formatted, available));
            break;
        }
        head.push_str(&formatted);
        head_lines += 1;
    }

    let mut tail_parts = Vec::new();
    let mut tail_chars = 0;
    let mut tail_lines = 0;
    for line_index in (head_lines..line_count).rev() {
        let line = patch
            .line_in_hunk(hunk_index, line_index)
            .map_err(|e| e.to_string())?;
        let formatted = format_diff_line(&line);
        let available = tail_budget.saturating_sub(tail_chars);
        if available == 0 {
            break;
        }
        let part = if formatted.chars().count() > available {
            take_suffix_chars(&formatted, available)
        } else {
            formatted
        };
        tail_chars += part.chars().count();
        tail_parts.push(part);
        tail_lines += 1;
    }
    tail_parts.reverse();

    let omitted = line_count.saturating_sub(head_lines + tail_lines);
    let marker = format!("... [{omitted} lines omitted] ...\n");
    let rendered = format!("{header}{head}{marker}{}", tail_parts.concat());
    Ok(truncate_chars(&rendered, budget))
}

fn format_diff_line(line: &DiffLine<'_>) -> String {
    let content = String::from_utf8_lossy(line.content());
    match line.origin_value() {
        DiffLineType::Context => format!(" {content}"),
        DiffLineType::Addition => format!("+{content}"),
        DiffLineType::Deletion => format!("-{content}"),
        _ => content.into_owned(),
    }
}

fn formatted_line_chars(line: &DiffLine<'_>) -> usize {
    let prefix = matches!(
        line.origin_value(),
        DiffLineType::Context | DiffLineType::Addition | DiffLineType::Deletion
    ) as usize;
    prefix + String::from_utf8_lossy(line.content()).chars().count()
}

fn delta_path(delta: &DiffDelta<'_>) -> String {
    let path = if delta.status() == Delta::Deleted {
        delta.old_file().path()
    } else {
        delta.new_file().path().or_else(|| delta.old_file().path())
    };
    path.map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown".to_string())
}

fn delta_status(status: Delta) -> &'static str {
    match status {
        Delta::Added => "A",
        Delta::Deleted => "D",
        Delta::Renamed => "R",
        Delta::Copied => "C",
        Delta::Typechange => "T",
        _ => "M",
    }
}

fn file_header(delta: &DiffDelta<'_>) -> String {
    let old_path = delta
        .old_file()
        .path()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown".to_string());
    let new_path = delta
        .new_file()
        .path()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown".to_string());
    let old_marker = if delta.status() == Delta::Added {
        "/dev/null".to_string()
    } else {
        format!("a/{old_path}")
    };
    let new_marker = if delta.status() == Delta::Deleted {
        "/dev/null".to_string()
    } else {
        format!("b/{new_path}")
    };
    format!("diff --git a/{old_path} b/{new_path}\n--- {old_marker}\n+++ {new_marker}\n")
}

fn binary_marker(path: &str) -> String {
    format!("Binary file {path} changed\n")
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn take_suffix_chars(value: &str, max_chars: usize) -> String {
    let chars: Vec<char> = value.chars().collect();
    chars[chars.len().saturating_sub(max_chars)..]
        .iter()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn init_test_repo() -> (TempDir, git2::Repository) {
        let dir = TempDir::new().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();
        {
            let mut config = repo.config().unwrap();
            config.set_str("user.name", "test").unwrap();
            config.set_str("user.email", "test@test.com").unwrap();
        }
        {
            fs::write(dir.path().join("readme.md"), "# Test\n").unwrap();
            let mut index = repo.index().unwrap();
            index
                .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
                .unwrap();
            index.write().unwrap();
            let tree_oid = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_oid).unwrap();
            let sig = git2::Signature::now("test", "test@test.com").unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
                .unwrap();
        }
        (dir, repo)
    }

    #[test]
    fn analyze_changes_returns_patch_and_file_summaries() {
        let (dir, repo) = init_test_repo();
        fs::write(dir.path().join("new.md"), "new content\n").unwrap();
        let analysis = analyze_changes(&repo).unwrap();

        assert!(analysis.sampled_diff.contains("new.md"));
        assert!(analysis.sampled_diff.contains("new content"));
        assert!(analysis
            .files_changed
            .iter()
            .any(|change| change.path == "new.md" && change.status == "A"));
    }

    #[test]
    fn sampling_covers_later_files_after_a_large_first_file() {
        let (dir, repo) = init_test_repo();
        let large = (0..3000)
            .map(|index| format!("large line {index}\n"))
            .collect::<String>();
        fs::write(dir.path().join("a-large.md"), large).unwrap();
        fs::write(
            dir.path().join("z-late.md"),
            "distinctive content from the later file\n",
        )
        .unwrap();

        let analysis = analyze_changes(&repo).unwrap();

        assert!(analysis.sampled_diff.contains("z-late.md"));
        assert!(analysis
            .sampled_diff
            .contains("distinctive content from the later file"));
    }

    #[test]
    fn sampling_uses_a_strict_unicode_character_budget() {
        let (dir, repo) = init_test_repo();
        fs::write(dir.path().join("中文.md"), "中文内容\n".repeat(5000)).unwrap();

        let analysis = analyze_changes(&repo).unwrap();

        assert!(analysis.sampled_diff.chars().count() <= MAX_DIFF_CHARS);
        assert!(analysis.sampled_diff.contains("中文"));
    }

    #[test]
    fn oversized_hunk_keeps_both_ends_and_marks_the_omission() {
        let (dir, repo) = init_test_repo();
        let mut content = String::from("FIRST IMPORTANT LINE\n");
        for index in 0..3000 {
            content.push_str(&format!("middle line {index}\n"));
        }
        content.push_str("LAST IMPORTANT LINE\n");
        fs::write(dir.path().join("large-note.md"), content).unwrap();

        let analysis = analyze_changes(&repo).unwrap();

        assert!(analysis.sampled_diff.contains("FIRST IMPORTANT LINE"));
        assert!(analysis.sampled_diff.contains("LAST IMPORTANT LINE"));
        assert!(analysis.sampled_diff.contains("lines omitted"));
    }

    #[test]
    fn binary_files_remain_visible_in_the_summary() {
        let (dir, repo) = init_test_repo();
        fs::write(dir.path().join("image.bin"), [0, 159, 146, 150, 0, 1]).unwrap();

        let analysis = analyze_changes(&repo).unwrap();

        assert!(analysis.sampled_diff.contains("image.bin"));
        assert!(analysis
            .files_changed
            .iter()
            .any(|change| change.path == "image.bin"));
    }

    #[test]
    fn sampling_is_deterministic() {
        let (dir, repo) = init_test_repo();
        fs::write(dir.path().join("note.md"), "same change\n".repeat(2000)).unwrap();

        let first = analyze_changes(&repo).unwrap();
        let second = analyze_changes(&repo).unwrap();

        assert_eq!(first.sampled_diff, second.sampled_diff);
        assert_eq!(first.files_changed, second.files_changed);
    }
}
