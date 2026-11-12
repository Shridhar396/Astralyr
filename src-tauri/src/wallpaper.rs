#[cfg(windows)]
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::{BOOL, HWND, LPARAM, WPARAM},
        UI::WindowsAndMessaging::{
            EnumWindows, FindWindowExW, FindWindowW, GetSystemMetrics, GetWindowLongW,
            SendMessageTimeoutW, SetParent, SetWindowLongW, SetWindowPos, UpdateWindow,
            GWL_STYLE, HWND_TOP, SMTO_NORMAL, SM_CXSCREEN, SM_CYSCREEN, SWP_FRAMECHANGED,
            SWP_SHOWWINDOW, WS_CHILD, WS_POPUP, WS_VISIBLE,
        },
    },
};

#[derive(Default, Debug)]
struct WorkerWDiscovery {
    shelldll_parent: HWND,
    workerw_behind: HWND,
}

#[inline]
fn is_valid_hwnd(hwnd: HWND) -> bool {
    !hwnd.0.is_null() && (hwnd.0 as isize) != -1 && (hwnd.0 as isize) != 0
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let discovery = &mut *(lparam.0 as *mut WorkerWDiscovery);

    // Look for a child window with class "SHELLDLL_DefView" (which holds desktop icons)
    let def_view = FindWindowExW(hwnd, HWND::default(), w!("SHELLDLL_DefView"), PCWSTR::null());
    if let Ok(dv) = def_view {
        if is_valid_hwnd(dv) {
            discovery.shelldll_parent = hwnd;

            // In Windows 10/11, WorkerW behind icons is typically the sibling WorkerW created right after
            if let Ok(behind) = FindWindowExW(HWND::default(), hwnd, w!("WorkerW"), PCWSTR::null()) {
                if is_valid_hwnd(behind) {
                    discovery.workerw_behind = behind;
                    return BOOL(0); // Found target! Stop enumeration.
                }
            }
        }
    }

    BOOL(1) // Continue search
}

/// Parents the given application window HWND to the Windows 11 WorkerW layer behind desktop icons.
#[cfg(windows)]
pub fn enable_wallpaper_mode(app_hwnd: HWND) -> Result<(), String> {
    unsafe {
        // Step 1: Find Progman
        let progman = FindWindowW(w!("Progman"), PCWSTR::null())
            .map_err(|e| format!("Failed to find Progman: {:?}", e))?;

        if !is_valid_hwnd(progman) {
            return Err("Progman window handle is invalid".into());
        }

        // Step 2: Send undocumented message 0x052C to Progman to spawn WorkerW
        let mut send_result: usize = 0;
        let _ = SendMessageTimeoutW(
            progman,
            0x052C,
            WPARAM(0x0000000D), // 0xD spawns WorkerW on Windows 10 & 11
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            Some(&mut send_result),
        );

        // Step 3: Discover the target WorkerW behind desktop icons
        let mut discovery = WorkerWDiscovery::default();
        let _ = EnumWindows(
            Some(enum_windows_callback),
            LPARAM(&mut discovery as *mut _ as isize),
        );

        let mut target_worker = discovery.workerw_behind;

        // Fallback 1: If target was not found as a sibling, check if SHELLDLL_DefView was in Progman,
        // and find the WorkerW sibling of Progman
        if !is_valid_hwnd(target_worker) {
            if let Ok(w_sib) = FindWindowExW(HWND::default(), progman, w!("WorkerW"), PCWSTR::null()) {
                if is_valid_hwnd(w_sib) {
                    target_worker = w_sib;
                }
            }
        }

        // Fallback 2: Check child WorkerW inside discovery.shelldll_parent
        if !is_valid_hwnd(target_worker) {
            if is_valid_hwnd(discovery.shelldll_parent) {
                if let Ok(w_child) = FindWindowExW(discovery.shelldll_parent, HWND::default(), w!("WorkerW"), PCWSTR::null()) {
                    if is_valid_hwnd(w_child) {
                        target_worker = w_child;
                    }
                }
            }
        }

        if !is_valid_hwnd(target_worker) {
            return Err("Could not locate Windows 11 WorkerW layer behind desktop icons".into());
        }

        // Step 4: Parent app window to WorkerW
        SetParent(app_hwnd, target_worker);

        // Step 5: Adjust window style to WS_CHILD so it acts as desktop canvas child
        let style = GetWindowLongW(app_hwnd, GWL_STYLE);
        let new_style = (style & !(WS_POPUP.0 as i32)) | (WS_CHILD.0 as i32) | (WS_VISIBLE.0 as i32);
        SetWindowLongW(app_hwnd, GWL_STYLE, new_style);

        // Step 6: Expand to entire monitor resolution
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

        // Step 7: Repaint WorkerW
        let _ = UpdateWindow(target_worker);

        Ok(())
    }
}

/// Restores the window from WorkerW desktop layer back to a standard top-level window.
#[cfg(windows)]
pub fn disable_wallpaper_mode(app_hwnd: HWND) -> Result<(), String> {
    unsafe {
        // Reparent to Desktop (HWND::default() / 0)
        SetParent(app_hwnd, HWND::default());

        // Restore style from WS_CHILD back to WS_POPUP
        let style = GetWindowLongW(app_hwnd, GWL_STYLE);
        let new_style = (style & !(WS_CHILD.0 as i32)) | (WS_POPUP.0 as i32) | (WS_VISIBLE.0 as i32);
        SetWindowLongW(app_hwnd, GWL_STYLE, new_style);

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

#[cfg(not(windows))]
pub fn enable_wallpaper_mode(_app_hwnd: ()) -> Result<(), String> {
    Err("Wallpaper Mode is only supported on Windows".into())
}

#[cfg(not(windows))]
pub fn disable_wallpaper_mode(_app_hwnd: ()) -> Result<(), String> {
    Err("Wallpaper Mode is only supported on Windows".into())
}
