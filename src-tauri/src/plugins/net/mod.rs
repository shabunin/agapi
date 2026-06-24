use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Manager, AppHandle, Runtime};
use tokio::sync::Mutex;

pub mod tcp;
pub mod udp;

pub struct NetState {
    pub tcp_sockets: Arc<Mutex<HashMap<String, tokio::sync::mpsc::Sender<tcp::TcpCommand>>>>,
    pub udp_sockets: Arc<Mutex<HashMap<String, tokio::sync::mpsc::Sender<udp::UdpCommand>>>>,
    pub tcp_servers: Arc<Mutex<HashMap<String, tokio::sync::mpsc::Sender<tcp::TcpServerCommand>>>>,
}

pub fn init_state<R: Runtime>(app: &AppHandle<R>) {
    app.manage(NetState {
        tcp_sockets: Arc::new(Mutex::new(HashMap::new())),
        udp_sockets: Arc::new(Mutex::new(HashMap::new())),
        tcp_servers: Arc::new(Mutex::new(HashMap::new())),
    });
}
