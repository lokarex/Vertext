use log::{error, info, trace, warn};
use std::{path::PathBuf, sync::OnceLock};
use tauri::Manager;

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
    Ok(())
}

#[tauri::command]
pub fn delete_repository(name: String) -> Result<(), String> {
    let path = repos_dir().join(&name);
    std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}
