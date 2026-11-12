#[cfg(windows)]
use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{
        GetSystemMetrics, GetWindowLongW, SetParent, SetWindowLongW, SetWindowPos, GWL_EXSTYLE,
        GWL_STYLE, HWND_NOTOPMOST, HWND_TOP, HWND_TOPMOST, SM_CXSCREEN, SM_CYSCREEN,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_CHILD,
        WS_EX_LAYERED, WS_EX_TRANSPARENT, WS_POPUP, WS_VISIBLE,
    },
};

/// Enters Theatre Fullscreen Mode: reparents window to top-level, removes borders, sizes to full screen.
#[cfg(windows)]
pub fn enter_theatre_mode(app_hwnd: HWND) -> Result<(), String> {
    unsafe {
        // Ensure window is reparented to Desktop
        SetParent(app_hwnd, HWND::default());

        // Set style to borderless popup visible
        let style = GetWindowLongW(app_hwnd, GWL_STYLE);
        let new_style = (style & !(WS_CHILD.0 as i32)) | (WS_POPUP.0 as i32) | (WS_VISIBLE.0 as i32);
        SetWindowLongW(app_hwnd, GWL_STYLE, new_style);

        // Make fullscreen
        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);
        let _ = SetWindowPos(
            app_hwnd,
            HWND_TOP,
            0,
            0,
            screen_w,
            screen_h,
            SWP_SHOWWINDOW | SWP_FRAMECHANGED,
        );

        Ok(())
    }
}

/// Sets Click-Through (WS_EX_TRANSPARENT) mode for the screen-edge rim light overlay.
#[cfg(windows)]
pub fn set_click_through_mode(app_hwnd: HWND, enable: bool) -> Result<bool, String> {
    unsafe {
        let ex_style = GetWindowLongW(app_hwnd, GWL_EXSTYLE);

        if enable {
            // Apply WS_EX_TRANSPARENT and WS_EX_LAYERED so mouse clicks pass through
            let new_ex_style = ex_style | (WS_EX_TRANSPARENT.0 as i32) | (WS_EX_LAYERED.0 as i32);
            SetWindowLongW(app_hwnd, GWL_EXSTYLE, new_ex_style);

            // Make TOPMOST so the rim light floats above all active apps
            let _ = SetWindowPos(
                app_hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
            Ok(true)
        } else {
            // Remove WS_EX_TRANSPARENT
            let new_ex_style = ex_style & !(WS_EX_TRANSPARENT.0 as i32);
            SetWindowLongW(app_hwnd, GWL_EXSTYLE, new_ex_style);

            let _ = SetWindowPos(
                app_hwnd,
                HWND_NOTOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED,
            );
            Ok(false)
        }
    }
}

/// Restores the window to normal windowed size (1280x720 centered).
#[cfg(windows)]
pub fn enter_normal_mode(app_hwnd: HWND) -> Result<(), String> {
    unsafe {
        SetParent(app_hwnd, HWND::default());

        let style = GetWindowLongW(app_hwnd, GWL_STYLE);
        let new_style = (style & !(WS_CHILD.0 as i32)) | (WS_POPUP.0 as i32) | (WS_VISIBLE.0 as i32);
        SetWindowLongW(app_hwnd, GWL_STYLE, new_style);

        // Center on screen
        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);
        let win_w = 1280;
        let win_h = 720;
        let pos_x = (screen_w - win_w) / 2;
        let pos_y = (screen_h - win_h) / 2;

        let _ = SetWindowPos(
            app_hwnd,
            HWND_TOP,
            pos_x,
            pos_y,
            win_w,
            win_h,
            SWP_SHOWWINDOW | SWP_FRAMECHANGED,
        );

        Ok(())
    }
}

#[cfg(not(windows))]
pub fn enter_theatre_mode(_app_hwnd: ()) -> Result<(), String> {
    Err("Only supported on Windows".into())
}

#[cfg(not(windows))]
pub fn set_click_through_mode(_app_hwnd: (), _enable: bool) -> Result<bool, String> {
    Err("Only supported on Windows".into())
}

#[cfg(not(windows))]
pub fn enter_normal_mode(_app_hwnd: ()) -> Result<(), String> {
    Err("Only supported on Windows".into())
}

