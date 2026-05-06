pub mod command;
pub mod fs;
pub mod repository;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    let builder = tauri::Builder::default();

    let builder = builder.setup(|app| {
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
            command::list_commit_history,
            command::restore_commit,
            command::list_repository_tree,
            command::create_file_entry,
            command::create_directory_entry,
            command::rename_entry,
            command::delete_entry
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
