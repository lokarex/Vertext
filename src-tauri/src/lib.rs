//! Vertext — A Git-backed Markdown notebook built with Tauri.
//!
//! Each workspace is stored as a Git repository under the app data
//! directory. The application provides a WYSIWYG Markdown editor with
//! automatic version history, multi-device synchronization via a
//! device-branch strategy, and credential storage in the OS keyring.

/// AI-powered commit message generation.
pub mod ai;
/// Tauri command handlers exposed to the frontend.
pub mod command;
/// Filesystem traversal utilities for repository tree display.
pub mod fs;
/// Git repository abstraction built on [`git2`].
pub mod repository;

/// Starts the Tauri application.
///
/// Configures the keyring backend, sets up logging via
/// [`tauri_plugin_log`] (trace level in debug, info in release),
/// registers all frontend-invokable commands, attaches the store and
/// opener plugins, and opens developer tools in debug builds.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to start, if the log plugin
/// cannot be initialized, or if the fern dispatcher setup fails.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    let builder = tauri::Builder::default();

    let builder = builder.setup(|app| {
        keyring::use_native_store(false).expect("failed to init keyring native store");
        #[cfg(debug_assertions)]
        {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
        }
        command::init_repos_dir(app);
        Ok(())
    });

    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::new()
            .level(tauri_plugin_log::log::LevelFilter::Trace)
            .build(),
    );
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::new()
            .level(tauri_plugin_log::log::LevelFilter::Info)
            .build(),
    );

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            command::init_local_repository,
            command::clone_remote_repository,
            command::sync_repository,
            command::delete_repository,
            command::rename_repository,
            command::list_commit_history,
            command::restore_commit,
            command::list_repository_tree,
            command::create_file_entry,
            command::create_directory_entry,
            command::rename_entry,
            command::delete_entry,
            command::read_file_content,
            command::write_file_content,
            command::prepare_commit_message,
            command::finish_sync,
            command::get_password,
            command::set_password,
            command::delete_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    let dispatch = fern::Dispatch::new();
    #[cfg(debug_assertions)]
    let dispatch = dispatch.level(log::LevelFilter::Trace);
    #[cfg(not(debug_assertions))]
    let dispatch = dispatch.level(log::LevelFilter::Info);
    dispatch.apply().expect("failed to apply fern dispatch");
}
