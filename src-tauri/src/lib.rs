pub mod git;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

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
        git::init_repos_dir(app);
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
            greet,
            git::init_local_repository,
            git::clone_remote_repository,
            git::delete_repository
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
