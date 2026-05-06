use log::{error, trace};
use std::{path::PathBuf, sync::OnceLock};
use tauri::{Emitter, Manager};

use crate::fs::{read_dir_recursive, FileEntry};
use crate::repository::{CommitInfo, Repository};

static REPOS_DIR: OnceLock<PathBuf> = OnceLock::new();

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

fn repos_dir() -> &'static PathBuf {
    REPOS_DIR.get().expect("failed to get repos dir")
}

fn device_name() -> String {
    hostname::get()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "unknown-device".to_string())
}

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

#[tauri::command]
pub fn clone_remote_repository(remote_url: String, repo_name: String) -> Result<(), String> {
    let path = repos_dir().join(&repo_name);

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.certificate_check(|_, _| Ok(git2::CertificateCheckStatus::CertificateOk));

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

#[tauri::command]
pub fn delete_repository(repo_name: String) -> Result<(), String> {
    let path = repos_dir().join(&repo_name);
    std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_commit_history(repo_name: String) -> Result<Vec<CommitInfo>, String> {
    let path = repos_dir().join(&repo_name);
    let repo = Repository::open(&path)?;
    repo.history()
}

#[tauri::command]
pub fn restore_commit(repo_name: String, commit_oid: String) -> Result<(), String> {
    let path = repos_dir().join(&repo_name);
    let repo = Repository::open(&path)?;
    let oid = git2::Oid::from_str(&commit_oid).map_err(|e| e.to_string())?;
    repo.restore_to(oid)
}

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
