// Prevents additional console window on Windows in release builds.
// This attribute hides the console when the binary is not running
// in debug mode. On other platforms this attribute has no effect.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    vertext_lib::run()
}
