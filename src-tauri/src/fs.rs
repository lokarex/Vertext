use log::error;
use serde::{Deserialize, Serialize};

/// A node in a file tree representing a directory entry in a repository.
///
/// `FileEntry` is serialized to camelCase JSON for the frontend file
/// explorer component. Directories contain a `children` list; files
/// are leaf nodes with an empty `children` vector.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// Relative path from the repository root, using `/` separators.
    pub key: String,
    /// Display name of the file or directory.
    pub label: String,
    /// `true` if this entry represents a file (leaf node),
    /// `false` if it represents a directory.
    pub is_leaf: bool,
    /// Child entries for directories. Empty for files.
    pub children: Vec<FileEntry>,
}

/// Recursively reads a directory and builds a tree of [`FileEntry`] nodes.
///
/// Traverses the directory tree starting at `dir`, producing entries
/// with paths relative to `base`. Directories are listed before files,
/// and entries within each group are sorted alphabetically by name.
/// I/O errors for individual directories are logged and skipped rather
/// than propagated.
pub fn read_dir_recursive(dir: &std::path::Path, base: &std::path::Path) -> Vec<FileEntry> {
    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = match std::fs::read_dir(dir) {
        Ok(d) => d,
        Err(e) => {
            error!("Failed to read directory {:?}: {}", dir, e);
            return entries;
        }
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        if a_is_dir != b_is_dir {
            b_is_dir.cmp(&a_is_dir)
        } else {
            a.file_name().cmp(&b.file_name())
        }
    });

    for item in items {
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();
        let relative_path = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace("\\", "/");

        if path.is_dir() {
            let children = read_dir_recursive(&path, base);
            entries.push(FileEntry {
                key: relative_path,
                label: name,
                is_leaf: false,
                children,
            });
        } else {
            entries.push(FileEntry {
                key: relative_path,
                label: name,
                is_leaf: true,
                children: Vec::new(),
            });
        }
    }

    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn empty_dir_returns_empty_vec() {
        let dir = TempDir::new().unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert!(entries.is_empty());
    }

    #[test]
    fn single_file_returns_one_leaf_entry() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("readme.md"), "hello").unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].label, "readme.md");
        assert!(entries[0].is_leaf);
    }

    #[test]
    fn single_directory_returns_one_non_leaf_entry() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("src")).unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].label, "src");
        assert!(!entries[0].is_leaf);
    }

    #[test]
    fn directories_before_files() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("z_file.txt"), "").unwrap();
        fs::create_dir(dir.path().join("a_dir")).unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert!(!entries[0].is_leaf);
        assert!(entries[1].is_leaf);
    }

    #[test]
    fn alphabetical_sorting_within_groups() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("z.txt"), "").unwrap();
        fs::write(dir.path().join("a.txt"), "").unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert_eq!(entries[0].label, "a.txt");
        assert_eq!(entries[1].label, "z.txt");
    }

    #[test]
    fn nested_directories_recursed() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("a/b")).unwrap();
        fs::write(dir.path().join("a/b/c.md"), "").unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].label, "a");
        assert_eq!(entries[0].children.len(), 1);
        assert_eq!(entries[0].children[0].label, "b");
        assert_eq!(entries[0].children[0].children.len(), 1);
        assert_eq!(entries[0].children[0].children[0].label, "c.md");
    }

    #[test]
    fn key_uses_forward_slash() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("sub/file.txt"), "").unwrap();
        let entries = read_dir_recursive(dir.path(), dir.path());
        assert!(entries[0].children[0].key.contains('/'));
    }

    #[test]
    fn nonexistent_path_returns_empty() {
        let dir = TempDir::new().unwrap();
        let nonexistent = dir.path().join("nonexistent");
        let entries = read_dir_recursive(&nonexistent, &nonexistent);
        assert!(entries.is_empty());
    }
}
