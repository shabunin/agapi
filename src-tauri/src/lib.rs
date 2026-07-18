mod plugins;

#[tauri::command]
fn set_devtools(app: tauri::AppHandle, open: bool) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        if open {
            window.open_devtools();
        } else {
            window.close_devtools();
        }
    }
}

#[tauri::command]
fn is_devtools_open(app: tauri::AppHandle) -> bool {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        window.is_devtools_open()
    } else {
        false
    }
}

#[tauri::command]
fn resize_window(app: tauri::AppHandle, width: f64, height: f64) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            set_devtools, 
            is_devtools_open, 
            resize_window,
            plugins::net::tcp::tcp_connect,
            plugins::net::tcp::tcp_write,
            plugins::net::tcp::tcp_destroy,
            plugins::net::tcp::tcp_shutdown,
            plugins::net::tcp::tcp_listen,
            plugins::net::tcp::tcp_server_close,
            plugins::net::tcp::tcp_set_keep_alive,
            plugins::net::tcp::tcp_set_no_delay,
            plugins::net::udp::udp_bind,
            plugins::net::udp::udp_send,
            plugins::net::udp::udp_close,
            plugins::net::udp::udp_add_membership,
            plugins::net::udp::udp_drop_membership,
            plugins::net::udp::udp_set_broadcast,
            plugins::net::udp::udp_connect,
            plugins::net::udp::udp_disconnect,
            plugins::net::udp::udp_set_ttl,
            plugins::net::udp::udp_set_multicast_ttl,
            plugins::net::udp::udp_set_multicast_loopback,
            plugins::net::udp::udp_set_recv_buffer_size,
            plugins::net::udp::udp_set_send_buffer_size,
            plugins::net::udp::udp_get_recv_buffer_size,
            plugins::net::udp::udp_get_send_buffer_size,
            plugins::http::server::http_server_listen,
            plugins::http::server::http_server_close,
            plugins::http::server::http_server_respond,
            plugins::http::server::ws_send_message,
            plugins::http::server::ws_close_connection,
            plugins::http::client::http_client_request,
        ])
        .setup(|app| {
            plugins::net::init_state(app.handle());
            plugins::http::init_state(app.handle());
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem, Submenu};
                use tauri::Emitter;

                let open_native = MenuItem::with_id(app, "open_native", "Open (native fs)", true, Some("CmdOrCtrl+O"))?;
                let open_browser = MenuItem::with_id(app, "open_browser", "Open (in browser zip)", true, None::<&str>)?;
                let reload = MenuItem::with_id(app, "reload", "Reload App", true, Some("CmdOrCtrl+R"))?;
                let file_menu = Submenu::with_items(app, "File", true, &[&open_native, &open_browser, &reload])?;

                let devtools = MenuItem::with_id(app, "devtools", "DevTools", true, Some("CmdOrCtrl+Shift+I"))?;
                let outline = MenuItem::with_id(app, "outline", "Outline", true, Some("CmdOrCtrl+Shift+O"))?;
                let fullscreen = MenuItem::with_id(app, "fullscreen", "Fullscreen", true, Some("F11"))?;
                
                let landscape = MenuItem::with_id(app, "landscape", "Landscape", true, Some("CmdOrCtrl+1"))?;
                let portrait = MenuItem::with_id(app, "portrait", "Portrait", true, Some("CmdOrCtrl+2"))?;
                let orientation_menu = Submenu::with_items(app, "Orientation", true, &[&landscape, &portrait])?;

                let view_menu = Submenu::with_items(app, "View", true, &[&devtools, &outline, &fullscreen, &orientation_menu])?;

                let menu = Menu::with_items(app, &[&file_menu, &view_menu])?;
                app.set_menu(menu)?;

                app.on_menu_event(move |app, event| {
                    app.emit("menu-action", event.id().as_ref()).unwrap_or(());
                });
            }

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
