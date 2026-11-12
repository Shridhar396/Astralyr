mod wallpaper;
mod window_effects;

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WebviewWindow,
};

#[derive(Default)]
pub struct AppState {
    pub is_click_through: Mutex<bool>,
    pub current_mode: Mutex<String>,
}

#[cfg(windows)]
fn get_hwnd(window: &WebviewWindow) -> Result<windows::Win32::Foundation::HWND, String> {
    use windows::Win32::Foundation::HWND;
    let hwnd_raw = window.hwnd().map_err(|e| e.to_string())?;
    Ok(HWND(hwnd_raw.0 as *mut std::ffi::c_void))
}

#[tauri::command]
pub async fn set_window_mode(
    window: WebviewWindow,
    state: State<'_, AppState>,
    mode: String,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let hwnd = get_hwnd(&window)?;
        match mode.as_str() {
            "wallpaper" => {
                wallpaper::enable_wallpaper_mode(hwnd)?;
            }
            "theatre" => {
                wallpaper::disable_wallpaper_mode(hwnd)?;
                window_effects::enter_theatre_mode(hwnd)?;
            }
            "overlay" => {
                wallpaper::disable_wallpaper_mode(hwnd)?;
                window_effects::enter_theatre_mode(hwnd)?;
                window_effects::set_click_through_mode(hwnd, true)?;
                *state.is_click_through.lock().unwrap() = true;
            }
            "normal" => {
                wallpaper::disable_wallpaper_mode(hwnd)?;
                window_effects::enter_normal_mode(hwnd)?;
                window_effects::set_click_through_mode(hwnd, false)?;
                *state.is_click_through.lock().unwrap() = false;
            }
            _ => return Err(format!("Unknown window mode: {}", mode)),
        }

        *state.current_mode.lock().unwrap() = mode.clone();
        let _ = window.emit("desktop-mode-changed", mode);
        Ok(())
    }

    #[cfg(not(windows))]
    {
        *state.current_mode.lock().unwrap() = mode.clone();
        let _ = window.emit("desktop-mode-changed", mode);
        Ok(())
    }
}

#[tauri::command]
pub async fn set_click_through(
    window: WebviewWindow,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let hwnd = get_hwnd(&window)?;
        let res = window_effects::set_click_through_mode(hwnd, enabled)?;
        *state.is_click_through.lock().unwrap() = res;
        Ok(res)
    }

    #[cfg(not(windows))]
    {
        *state.is_click_through.lock().unwrap() = enabled;
        Ok(enabled)
    }
}

#[tauri::command]
pub async fn toggle_click_through(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let current = *state.is_click_through.lock().unwrap();
    let next = !current;
    set_click_through(window, state, next).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            is_click_through: Mutex::new(false),
            current_mode: Mutex::new("normal".into()),
        })
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Build system tray menu
            let title_i = MenuItem::with_id(
                app,
                "title",
                "Ambient Audio Visualizer (Win 11)",
                false,
                None::<&str>,
            )?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let wallpaper_i = MenuItem::with_id(
                app,
                "mode_wallpaper",
                "Wallpaper Mode (WorkerW Layer)",
                true,
                None::<&str>,
            )?;
            let theatre_i = MenuItem::with_id(
                app,
                "mode_theatre",
                "Theatre Fullscreen Mode",
                true,
                None::<&str>,
            )?;
            let overlay_i = MenuItem::with_id(
                app,
                "mode_overlay",
                "Click-Through Overlay Rim Light",
                true,
                None::<&str>,
            )?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let hud_i = MenuItem::with_id(
                app,
                "toggle_hud",
                "Toggle Controls HUD (H)",
                true,
                None::<&str>,
            )?;
            let play_i = MenuItem::with_id(
                app,
                "toggle_play",
                "Play / Pause (Space)",
                true,
                None::<&str>,
            )?;
            let next_i = MenuItem::with_id(
                app,
                "next_station",
                "Next Radio Station (->)",
                true,
                None::<&str>,
            )?;
            let sep3 = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(
                app,
                "quit",
                "Exit Visualizer",
                true,
                None::<&str>,
            )?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &title_i,
                    &sep1,
                    &wallpaper_i,
                    &theatre_i,
                    &overlay_i,
                    &sep2,
                    &hud_i,
                    &play_i,
                    &next_i,
                    &sep3,
                    &quit_i,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app_handle, event| {
                    let win = app_handle.get_webview_window("main");
                    match event.id.as_ref() {
                        "quit" => app_handle.exit(0),
                        "mode_wallpaper" => {
                            if let Some(w) = win {
                                let app_state = app_handle.state::<AppState>();
                                tauri::async_runtime::block_on(async {
                                    let _ = set_window_mode(w, app_state, "wallpaper".into()).await;
                                });
                            }
                        }
                        "mode_theatre" => {
                            if let Some(w) = win {
                                let app_state = app_handle.state::<AppState>();
                                tauri::async_runtime::block_on(async {
                                    let _ = set_window_mode(w, app_state, "theatre".into()).await;
                                });
                            }
                        }
                        "mode_overlay" => {
                            if let Some(w) = win {
                                let app_state = app_handle.state::<AppState>();
                                tauri::async_runtime::block_on(async {
                                    let _ = set_window_mode(w, app_state, "overlay".into()).await;
                                });
                            }
                        }
                        "toggle_hud" => {
                            let _ = app_handle.emit("tray-toggle-hud", ());
                        }
                        "toggle_play" => {
                            let _ = app_handle.emit("tray-toggle-play", ());
                        }
                        "next_station" => {
                            let _ = app_handle.emit("tray-next-station", ());
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_window_mode,
            set_click_through,
            toggle_click_through,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ambient Visualizer Tauri application");
}

