use log::{error, trace};
use std::{path::PathBuf, sync::OnceLock};
use tauri::{Emitter, Manager};

use crate::fs::{read_dir_recursive, FileEntry};
use crate::repository::{CommitInfo, Repository};
use keyring_core::Entry;

// The global directory where all repositories are stored.
// Initialized once during application startup via [`init_repos_dir`].
static REPOS_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Initializes the global repositories directory.
///
/// Derives the path from the platform-specific application data
/// directory (e.g. `%APPDATA%` on Windows) and creates it if
/// it does not already exist. Must be called once during the
/// Tauri setup phase before any repository commands are invoked.
///
/// # Panics
///
/// Panics if the application data directory cannot be resolved
/// or if the repositories directory cannot be created.
pub fn init_repos_dir(app: &tauri::App) {
    trace!("Initializing repos dir...");
    REPOS_DIR
        .set(
            app.path()
                .app_data_dir()
                .expect("failed to get app data dir")
                .join("repos"),
        )
        .expect("failed to set repos dir");
    trace!(
        "Repos dir: {:?}",
        REPOS_DIR.get().expect("failed to get repos dir")
    );
    std::fs::create_dir_all(&REPOS_DIR.get().expect("failed to get repos dir"))
        .expect("failed to create repos dir");
    trace!("Repos dir initialized successfully.");
}

// Returns a reference to the global repositories directory path.
fn repos_dir() -> &'static PathBuf {
    REPOS_DIR.get().expect("failed to get repos dir")
}

// Returns the hostname of the current device as a String.
// Used to name per-device Git branches for conflict-free sync.
fn device_name() -> String {
    hostname::get()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "unknown-device".to_string())
}

/// Creates a new local Git repository with a device-specific branch.
///
/// Initializes a bare Git repository at
/// `<app_data>/repos/<repo_name>` and checks out a branch named
/// after the current device's hostname. The device-branch strategy
/// eliminates merge conflicts during multi-device synchronization.
///
/// # Errors
///
/// Returns an error if the repository cannot be initialized or if
/// the device branch cannot be created and checked out.
#[tauri::command]
pub fn init_local_repository(repo_name: String) -> Result<(), String> {
    trace!("Initializing local repository: {}", repo_name);
    let path = repos_dir().join(&repo_name);
    git2::Repository::init(&path)
        .map_err(|e| e.to_string())
        .map_err(|err| {
            error!("Failed to initialize local repository: {}", err);
            err
        })?;
    trace!("Local repository initialized successfully: {}", repo_name);
    trace!("The new local repository path: {:?}", path);

    let repo = Repository::open(&path)?;
    let device_name = device_name();
    repo.ensure_branch(&device_name)?;
    trace!(
        "Device branch '{}' set for repository: {}",
        device_name,
        repo_name
    );
    Ok(())
}

/// Clones a remote Git repository and sets up a device branch.
///
/// Clones from `remote_url` via HTTP(S), skipping TLS certificate
/// verification. If `user_name` and `password` are both provided,
/// they are used for HTTP basic authentication.
///
/// # Errors
///
/// Returns an error if the clone operation fails or if the device
/// branch cannot be created and checked out.
#[tauri::command]
pub fn clone_remote_repository(
    remote_url: String,
    repo_name: String,
    user_name: Option<String>,
    password: Option<String>,
) -> Result<(), String> {
    let path = repos_dir().join(&repo_name);

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.certificate_check(|_, _| Ok(git2::CertificateCheckStatus::CertificateOk));

    if let (Some(user), Some(pass)) = (&user_name, &password) {
        let user = user.clone();
        let pass = pass.clone();
        callbacks.credentials(move |_url, _username, _allowed| {
            git2::Cred::userpass_plaintext(&user, &pass).map_err(|e| {
                git2::Error::new(git2::ErrorCode::Auth, git2::ErrorClass::Callback, &e.to_string())
            })
        });
    }

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fetch_opts);

    builder
        .clone(&remote_url, &path)
        .map_err(|e| e.to_string())?;

    let repo = Repository::open(&path)?;
    let device_name = device_name();
    repo.ensure_branch(&device_name)?;
    trace!(
        "Device branch '{}' set for cloned repository: {}",
        device_name,
        repo_name
    );
    Ok(())
}

/// Performs a full multi-device sync workflow for a repository.
///
/// # Workflow
///
/// 1. **Checking** — Opens the repository, configures the remote,
///    and ensures the device branch exists.
/// 2. **Committing** — Commits any uncommitted local changes.
/// 3. **Fetching** — Fetches all branches from the remote.
/// 4. **Merging** — Finds the latest commit across all branches
///    and merges it using the *theirs* strategy (fast-forward
///    when possible).
/// 5. **Pushing** — Pushes all local branches back to the remote.
///
/// Progress events are emitted via the `sync-progress` event with
/// `step` and `message` fields for real-time UI updates.
///
/// # Errors
///
/// Returns an error if any step fails: opening the repository,
/// committing, fetching, merging, or pushing.
#[tauri::command]
pub fn sync_repository(
    app_handle: tauri::AppHandle,
    repo_name: String,
    remote_url: String,
    user_name: String,
    password: String,
) -> Result<(), String> {
    trace!("Starting sync for repository: {}", repo_name);
    let device_name = device_name();

    let emit = |step: &str, message: &str| {
        let _ = app_handle.emit(
            "sync-progress",
            serde_json::json!({
                "step": step,
                "message": message,
                "repo_name": repo_name,
            }),
        );
    };

    // Step 1: checking
    emit("checking", "Checking repository status...");
    let path = repos_dir().join(&repo_name);
    let repo = Repository::open_with_remote(&path, &remote_url, &user_name, &password)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.setup_remote()?;
    repo.ensure_branch(&device_name)?;
    trace!("Repository opened and device branch ensured");

    // Step 2: committing
    emit("committing", "Committing local changes...");
    if repo.has_uncommitted_changes()? {
        repo.commit_all()?;
        trace!("Uncommitted changes committed");
    } else {
        trace!("No uncommitted changes");
    }

    // Step 3: fetching
    emit("fetching", "Fetching remote branches...");
    repo.fetch_all_branches()?;

    // Step 4: merging
    emit("merging", "Finding latest commit...");
    let (latest_oid, latest_ref_name) = repo.latest_commit()?;
    let head_oid = repo.head_oid()?;

    if head_oid != latest_oid {
        trace!(
            "Latest commit {} is on ref '{}', not on current branch (head {}), merging...",
            latest_oid,
            latest_ref_name,
            head_oid
        );
        emit("merging", "Merging latest commit...");
        repo.merge_theirs(latest_oid)?;
    } else {
        trace!(
            "Latest commit {} is already on current branch, no merge needed",
            latest_oid
        );
    }

    // Step 5: pushing
    emit("pushing", "Pushing all branches...");
    repo.push_all_branches()?;

    emit("done", "Sync completed");
    trace!("Sync completed for repository: {}", repo_name);
    Ok(())
}

/// Deletes a repository and all of its contents from disk.
///
/// Removes the entire repository directory at
/// `<app_data>/repos/<repo_name>`.
///
/// # Errors
///
/// Returns an error if the directory cannot be removed.
#[tauri::command]
pub fn delete_repository(repo_name: String) -> Result<(), String> {
    let path = repos_dir().join(&repo_name);
    std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Lists the commit history of a repository.
///
/// Returns all commits reachable from any branch or remote tracking
/// ref, annotated with branch and tag information.
///
/// # Errors
///
/// Returns an error if the repository cannot be opened or the
/// revision walk fails.
#[tauri::command]
pub fn list_commit_history(repo_name: String) -> Result<Vec<CommitInfo>, String> {
    let path = repos_dir().join(&repo_name);
    let repo = Repository::open(&path)?;
    repo.history()
}

/// Restores the working tree to a historical commit.
///
/// Creates a new *restore commit* on the current branch that
/// matches the tree of `commit_oid`, preserving the full
/// history so no data is lost.
///
/// # Errors
///
/// Returns an error if the OID is invalid, the repository cannot
/// be opened, or the restore operation fails.
#[tauri::command]
pub fn restore_commit(repo_name: String, commit_oid: String) -> Result<(), String> {
    let path = repos_dir().join(&repo_name);
    let repo = Repository::open(&path)?;
    let oid = git2::Oid::from_str(&commit_oid).map_err(|e| e.to_string())?;
    repo.restore_to(oid)
}

/// Lists the file tree of a repository for the frontend explorer.
///
/// Recursively walks the repository directory and returns a flat
/// list of [`FileEntry`] nodes representing files and directories.
///
/// # Errors
///
/// Returns an error if the repository directory does not exist.
#[tauri::command]
pub fn list_repository_tree(repo_name: String) -> Result<Vec<FileEntry>, String> {
    trace!("Listing files for repository: {}", repo_name);
    let path = repos_dir().join(&repo_name);

    if !path.exists() {
        error!("Repository directory does not exist: {:?}", path);
        return Err(format!("Repository '{}' does not exist", repo_name));
    }

    let result = read_dir_recursive(&path, &path);
    trace!("File tree for '{}': {} entries", repo_name, result.len());
    Ok(result)
}

/// Creates a new empty file inside a repository.
///
/// The file is created under `<repo>/<parent_path>/<file_name>`.
///
/// # Errors
///
/// Returns an error if the file already exists or cannot be created.
#[tauri::command]
pub fn create_file_entry(
    repo_name: String,
    parent_path: String,
    file_name: String,
) -> Result<(), String> {
    trace!(
        "Creating file entry: repo={}, parent={}, file={}",
        repo_name,
        parent_path,
        file_name
    );
    let path = repos_dir()
        .join(&repo_name)
        .join(&parent_path)
        .join(&file_name);
    if path.exists() {
        error!("File already exists: {:?}", path);
        return Err(format!("File already exists: {:?}", path));
    }
    std::fs::write(&path, "").map_err(|e| {
        error!("Failed to create file {:?}: {}", path, e);
        e.to_string()
    })?;
    trace!("Created file: {:?}", path);
    Ok(())
}

/// Creates a new directory inside a repository.
///
/// The directory is created at `<repo>/<parent_path>/<dir_name>`.
/// Intermediate parent directories are created as needed.
///
/// # Errors
///
/// Returns an error if the directory already exists or cannot be
/// created.
#[tauri::command]
pub fn create_directory_entry(
    repo_name: String,
    parent_path: String,
    dir_name: String,
) -> Result<(), String> {
    trace!(
        "Creating directory entry: repo={}, parent={}, dir={}",
        repo_name,
        parent_path,
        dir_name
    );
    let path = repos_dir()
        .join(&repo_name)
        .join(&parent_path)
        .join(&dir_name);
    if path.exists() {
        error!("Directory already exists: {:?}", path);
        return Err(format!("Directory already exists: {:?}", path));
    }
    std::fs::create_dir_all(&path).map_err(|e| {
        error!("Failed to create directory {:?}: {}", path, e);
        e.to_string()
    })?;
    trace!("Created directory: {:?}", path);
    Ok(())
}

/// Renames a file or directory inside a repository.
///
/// `entry_key` is the current relative path of the entry within
/// the repository. The entry is renamed to `new_name` within the
/// same parent directory.
///
/// # Errors
///
/// Returns an error if the target path already exists or if the
/// rename operation fails.
#[tauri::command]
pub fn rename_entry(repo_name: String, entry_key: String, new_name: String) -> Result<(), String> {
    trace!(
        "Renaming entry: repo={}, key={}, new_name={}",
        repo_name,
        entry_key,
        new_name
    );
    let old_path = repos_dir().join(&repo_name).join(&entry_key);
    let parent = entry_key
        .replace("\\", "/")
        .rsplit('/')
        .nth(1)
        .unwrap_or("")
        .to_string();
    let new_path = repos_dir().join(&repo_name).join(&parent).join(&new_name);
    if new_path.exists() {
        error!("Target path already exists: {:?}", new_path);
        return Err(format!("Target path already exists: {:?}", new_path));
    }
    std::fs::rename(&old_path, &new_path).map_err(|e| {
        error!("Failed to rename {:?} to {:?}: {}", old_path, new_path, e);
        e.to_string()
    })?;
    trace!("Renamed {:?} to {:?}", old_path, new_path);
    Ok(())
}

/// Reads the contents of a file inside a repository.
///
/// Returns the file contents as a UTF-8 string. The file path
/// is resolved relative to the repository root.
///
/// # Errors
///
/// Returns an error if the file does not exist or cannot be read
/// as valid UTF-8.
#[tauri::command]
pub fn read_file_content(repo_name: String, relative_path: String) -> Result<String, String> {
    trace!(
        "Reading file content: repo={}, path={}",
        repo_name,
        relative_path
    );
    let full_path = repos_dir().join(&repo_name).join(&relative_path);
    if !full_path.exists() {
        error!("File not found: {:?}", full_path);
        return Err(format!("File not found: {}", relative_path));
    }
    let content = std::fs::read_to_string(&full_path).map_err(|e| {
        error!("Failed to read file {:?}: {}", full_path, e);
        e.to_string()
    })?;
    trace!("Read {} bytes from {:?}", content.len(), full_path);
    Ok(content)
}

/// Writes content to a file inside a repository.
///
/// Creates any missing parent directories before writing.
///
/// # Errors
///
/// Returns an error if the parent directories cannot be created
/// or if the file cannot be written.
#[tauri::command]
pub fn write_file_content(
    repo_name: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    trace!(
        "Writing file content: repo={}, path={}, {} bytes",
        repo_name,
        relative_path,
        content.len()
    );
    let full_path = repos_dir().join(&repo_name).join(&relative_path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            error!("Failed to create parent dir {:?}: {}", parent, e);
            e.to_string()
        })?;
    }
    std::fs::write(&full_path, &content).map_err(|e| {
        error!("Failed to write file {:?}: {}", full_path, e);
        e.to_string()
    })?;
    trace!("Wrote {} bytes to {:?}", content.len(), full_path);
    Ok(())
}

/// Deletes a file or directory inside a repository.
///
/// If `entry_key` points to a directory, the directory and all
/// its contents are removed. Otherwise the file is deleted.
///
/// # Errors
///
/// Returns an error if the file or directory cannot be deleted.
#[tauri::command]
pub fn delete_entry(repo_name: String, entry_key: String) -> Result<(), String> {
    trace!("Deleting entry: repo={}, key={}", repo_name, entry_key);
    let full_path = repos_dir().join(&repo_name).join(&entry_key);
    if full_path.is_dir() {
        std::fs::remove_dir_all(&full_path).map_err(|e| {
            error!("Failed to delete directory {:?}: {}", full_path, e);
            e.to_string()
        })?;
        trace!("Deleted directory: {:?}", full_path);
    } else {
        std::fs::remove_file(&full_path).map_err(|e| {
            error!("Failed to delete file {:?}: {}", full_path, e);
            e.to_string()
        })?;
        trace!("Deleted file: {:?}", full_path);
    }
    Ok(())
}

/// Retrieves a password from the OS-level keyring.
///
/// Uses the platform-native credential store (Windows Credential
/// Manager, macOS Keychain, Linux Secret Service).
///
/// Returns `Ok(None)` if no entry exists for the given service
/// and user combination.
///
/// # Errors
///
/// Returns an error if the keyring backend cannot be accessed
/// (other than the no-entry case).
#[tauri::command]
pub fn get_password(service: String, user: String) -> Result<Option<String>, String> {
    let entry = Entry::new(&service, &user).map_err(|e: keyring_core::Error| e.to_string())?;
    match entry.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring_core::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Stores a password in the OS-level keyring.
///
/// Creates or updates an entry identified by `service` and `user`.
///
/// # Errors
///
/// Returns an error if the keyring backend cannot be accessed
/// or the credential cannot be stored.
#[tauri::command]
pub fn set_password(service: String, user: String, password: String) -> Result<(), String> {
    let entry = Entry::new(&service, &user).map_err(|e: keyring_core::Error| e.to_string())?;
    entry.set_password(&password).map_err(|e: keyring_core::Error| e.to_string())
}

/// Deletes a credential from the OS-level keyring.
///
/// # Errors
///
/// Returns an error if the keyring backend cannot be accessed
/// or the credential cannot be deleted.
#[tauri::command]
pub fn delete_password(service: String, user: String) -> Result<(), String> {
    let entry = Entry::new(&service, &user).map_err(|e: keyring_core::Error| e.to_string())?;
    entry.delete_credential().map_err(|e: keyring_core::Error| e.to_string())
}