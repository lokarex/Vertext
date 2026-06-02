use crate::ai::FileChangeSummary;
use git2::{DiffOptions, Repository};
use std::collections::HashMap;

const MAX_DIFF_CHARS: usize = 4000;

pub fn generate_diff(repo: &Repository) -> Result<String, String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut full_diff = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(content) = std::str::from_utf8(line.content()) {
            full_diff.push_str(content);
        }
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(smart_sample(&full_diff, MAX_DIFF_CHARS))
}

fn smart_sample(diff: &str, max_chars: usize) -> String {
    if diff.len() <= max_chars {
        return diff.to_string();
    }

    let mut result = String::with_capacity(max_chars);
    let mut current_file_header = String::new();
    let mut current_hunk = String::new();
    let mut in_hunk = false;
    let mut has_content = false;

    for line in diff.lines() {
        if line.starts_with("diff --git ") {
            if result.len() + current_hunk.len() > max_chars {
                break;
            }
            if in_hunk && has_content {
                result.push_str(&current_hunk);
            }
            current_file_header = format!("{}\n", line);
            current_hunk = current_file_header.clone();
            in_hunk = false;
            has_content = false;
        } else if line.starts_with("@@") || line.starts_with("---") || line.starts_with("+++") {
            if result.len() + current_hunk.len() > max_chars {
                break;
            }
            if in_hunk && has_content {
                result.push_str(&current_hunk);
            }
            current_hunk = format!("{}{current_file_header}{}\n", current_hunk, line);
            in_hunk = true;
            has_content = false;
        } else {
            if line.starts_with('+') || line.starts_with('-') {
                let trimmed = line[1..].trim();
                if !trimmed.is_empty() {
                    has_content = true;
                }
            }
            current_hunk.push_str(line);
            current_hunk.push('\n');
        }
    }

    if result.len() + current_hunk.len() <= max_chars && in_hunk && has_content {
        result.push_str(&current_hunk);
    }

    if result.is_empty() {
        diff.chars().take(max_chars).collect()
    } else {
        result
    }
}

pub fn parse_file_changes(repo: &Repository) -> Result<Vec<FileChangeSummary>, String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut file_map: HashMap<String, FileChangeSummary> = HashMap::new();

    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = if delta.status() == git2::Delta::Added {
            "A"
        } else if delta.status() == git2::Delta::Deleted {
            "D"
        } else {
            "M"
        };

        if !file_map.contains_key(&path) {
            file_map.insert(
                path.clone(),
                FileChangeSummary {
                    path: path.clone(),
                    status: status.to_string(),
                    additions: 0,
                    deletions: 0,
                },
            );
        }

        if let Some(entry) = file_map.get_mut(&path) {
            match line.origin() {
                '+' => entry.additions += 1,
                '-' => entry.deletions += 1,
                _ => {}
            }
        }
        true
    })
    .map_err(|e| e.to_string())?;

    let mut result: Vec<FileChangeSummary> = file_map.into_values().collect();
    result.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(result)
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
    fn generate_diff_returns_patch() {
        let (dir, repo) = init_test_repo();
        fs::write(dir.path().join("new.md"), "new content\n").unwrap();
        let diff = generate_diff(&repo).unwrap();
        assert!(diff.contains("new.md"));
        assert!(diff.contains("new content"));
    }

    #[test]
    fn smart_sample_under_limit_returns_full() {
        let diff =
            "diff --git a/test b/test\n--- a/test\n+++ b/test\n@@ -0,0 +1 @@\n+small change\n";
        let result = smart_sample(diff, 10000);
        assert_eq!(result, diff);
    }

    #[test]
    fn smart_sample_over_limit_truncates() {
        let mut diff = String::from(
            "diff --git a/test b/test\n--- a/test\n+++ b/test\n@@ -0,0 +1 @@\n+meaningful change\n",
        );
        while diff.len() < MAX_DIFF_CHARS * 2 {
            diff.push_str(
                "diff --git a/extra b/extra\n--- a/extra\n+++ b/extra\n@@ -0,0 +1 @@\n+extra\n",
            );
        }
        let result = smart_sample(&diff, MAX_DIFF_CHARS);
        assert!(result.len() <= MAX_DIFF_CHARS + 200);
        assert!(result.contains("meaningful change"));
    }

    #[test]
    fn parse_file_changes_returns_correct_status() {
        let (dir, repo) = init_test_repo();
        fs::write(dir.path().join("new.md"), "new content\n").unwrap();
        let changes = parse_file_changes(&repo).unwrap();
        assert!(changes
            .iter()
            .any(|c| c.path == "new.md" && c.status == "A"));
    }
}
