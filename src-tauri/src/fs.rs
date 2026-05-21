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
