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

/// Grant runtime fs-scope read access to a user-picked file (e.g. from
/// `@tauri-apps/plugin-dialog`'s `open()`) plus its containing directory,
/// recursively — so opening a CF project from anywhere on disk keeps
/// working now that the static capability scope is narrowed to app dirs
/// (see capabilities/default.json). The fs plugin ORs this runtime scope
/// with the static ACL scope on every call (tauri-plugin-fs's
/// `resolve_path`), so this only ever *adds* access to this one path, never
/// removes the app-dir scope.
#[tauri::command]
fn fs_allow_read_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;
    let scope = app.fs_scope();
    let p = std::path::PathBuf::from(&path);
    scope.allow_file(&p).map_err(|e| e.to_string())?;
    if let Some(parent) = p.parent() {
        scope
            .allow_directory(parent, true)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_blec::init())
        .invoke_handler(tauri::generate_handler![
            set_devtools,
            is_devtools_open,
            resize_window,
            fs_allow_read_path,
            plugins::net::tcp::tcp_connect,
            plugins::net::tcp::tcp_write,
            plugins::net::tcp::tcp_destroy,
            plugins::net::tcp::tcp_shutdown,
            plugins::net::tcp::tcp_listen,
            plugins::net::tcp::tcp_server_close,
            plugins::net::tcp::tcp_set_keep_alive,
            plugins::net::tcp::tcp_set_no_delay,
            plugins::net::dns::dns_lookup,
            plugins::net::device::device_network_status,
            plugins::net::device::device_watch_network_start,
            plugins::net::device::device_watch_network_stop,
            plugins::net::mdns::mdns_browse_start,
            plugins::net::mdns::mdns_browse_stop,
            plugins::net::mdns::mdns_publish,
            plugins::net::mdns::mdns_unpublish,
            plugins::net::tls::tls_connect,
            plugins::net::tls::tls_write,
            plugins::net::tls::tls_shutdown,
            plugins::net::tls::tls_destroy,
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
        ])
        .setup(|app| {
            plugins::net::init_state(app.handle());
            plugins::http::init_state(app.handle());

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // Mobile-only: not compiled at all for desktop targets (see
            // Cargo.toml's target.'cfg(android/ios)'.dependencies), so these
            // can't be registered unconditionally like the plugins above.
            #[cfg(mobile)]
            {
                app.handle().plugin(tauri_plugin_biometric::init())?;
                app.handle().plugin(tauri_plugin_haptics::init())?;
                app.handle().plugin(tauri_plugin_nfc::init())?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
