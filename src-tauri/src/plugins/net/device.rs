//! Device network status (`agapi.device.getNetworkStatus` / `watchNetwork`).
//!
//! Best-effort: `network_type` is a name-based heuristic (no OS API queried
//! here distinguishes Wi-Fi from Ethernet portably), and there is no SSID —
//! that needs platform-specific Wi-Fi APIs we don't have a host for yet.
//!
//! Watch is backed by `if_addrs::IfChangeNotifier`, which does not exist on
//! Apple platforms (see its own cfg gate) — this project doesn't build for
//! those today, so that's a future-you problem: adding a macOS/iOS target
//! will need a different watch backend here.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use uuid::Uuid;

const EVENT_NAME: &str = "plugin:device:network";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NetworkAddress {
    pub address: String,
    /// "IPv4" | "IPv6"
    pub family: String,
    pub interface: String,
    pub netmask: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatusPayload {
    pub has_network: bool,
    /// "wifi" | "ethernet" | "other" | "none" — best-effort, by interface name
    pub network_type: String,
    pub addresses: Vec<NetworkAddress>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NetworkWatchEvent {
    id: String,
    status: NetworkStatusPayload,
}

pub struct DeviceState {
    /// watch_id -> stop flag, checked by the watch thread between polls.
    watches: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for DeviceState {
    fn default() -> Self {
        Self {
            watches: Mutex::new(HashMap::new()),
        }
    }
}

pub fn init_state<R: Runtime>(app: &AppHandle<R>) {
    app.manage(DeviceState::default());
}

/// Best-effort classification from interface naming conventions
/// (Linux: wlan*/wlp*, macOS: en0 is usually Wi-Fi but not reliably so this
/// only recognizes the unambiguous prefixes; Windows: "Wi-Fi"/"Ethernet").
fn classify(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.starts_with("wl") || lower.contains("wi-fi") || lower.contains("wifi") {
        "wifi"
    } else if lower.starts_with("eth")
        || lower.starts_with("en")
        || lower.starts_with("eno")
        || lower.starts_with("enp")
        || lower.contains("ethernet")
    {
        "ethernet"
    } else {
        "other"
    }
}

fn build_snapshot() -> Result<NetworkStatusPayload, String> {
    let interfaces = if_addrs::get_if_addrs().map_err(|e| format!("get_if_addrs: {e}"))?;

    let mut addresses = Vec::new();
    let mut network_type = "none";

    for iface in interfaces.iter().filter(|i| !i.is_loopback()) {
        let (ip, netmask, family) = match &iface.addr {
            if_addrs::IfAddr::V4(v4) => (
                std::net::IpAddr::V4(v4.ip),
                std::net::IpAddr::V4(v4.netmask).to_string(),
                "IPv4",
            ),
            if_addrs::IfAddr::V6(v6) => (
                std::net::IpAddr::V6(v6.ip),
                std::net::IpAddr::V6(v6.netmask).to_string(),
                "IPv6",
            ),
        };

        if network_type == "none" {
            network_type = classify(&iface.name);
        }

        addresses.push(NetworkAddress {
            address: ip.to_string(),
            family: family.to_string(),
            interface: iface.name.clone(),
            netmask,
        });
    }

    Ok(NetworkStatusPayload {
        has_network: !addresses.is_empty(),
        network_type: network_type.to_string(),
        addresses,
    })
}

#[tauri::command]
pub fn device_network_status() -> Result<NetworkStatusPayload, String> {
    build_snapshot()
}

/// Start watching for interface changes (Wi-Fi/Ethernet connect, disconnect,
/// address change, …). Emits a fresh snapshot on `plugin:device:network`
/// whenever the OS reports a real change. `watch_id` is supplied by the
/// caller so it can register its event listener before this resolves —
/// `IfChangeNotifier::new()` + the first poll happen synchronously-ish fast
/// enough that an event could otherwise arrive before an id assigned from
/// the return value is known.
#[tauri::command]
pub fn device_watch_network_start<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DeviceState>,
    watch_id: Option<String>,
) -> Result<String, String> {
    let mut notifier =
        if_addrs::IfChangeNotifier::new().map_err(|e| format!("IfChangeNotifier::new: {e}"))?;

    let id = watch_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let stop_flag = Arc::new(AtomicBool::new(false));
    state
        .watches
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), stop_flag.clone());

    let id2 = id.clone();
    std::thread::Builder::new()
        .name(format!("device-network-watch-{id}"))
        .spawn(move || {
            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }
                match notifier.wait(Some(Duration::from_secs(1))) {
                    Ok(_changes) => match build_snapshot() {
                        Ok(status) => {
                            let _ = app.emit(
                                EVENT_NAME,
                                NetworkWatchEvent {
                                    id: id2.clone(),
                                    status,
                                },
                            );
                        }
                        Err(e) => {
                            log::warn!("[device] snapshot after change failed: {e}");
                        }
                    },
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // poll timeout — loop back to recheck the stop flag
                    }
                    Err(e) => {
                        log::warn!("[device] network watch error: {e}");
                        break;
                    }
                }
            }

            if let Some(state_mutex) = app.try_state::<DeviceState>() {
                if let Ok(mut watches) = state_mutex.watches.lock() {
                    watches.remove(&id2);
                }
            }
        })
        .map_err(|e| format!("spawn watch thread: {e}"))?;

    Ok(id)
}

#[tauri::command]
pub fn device_watch_network_stop(state: State<'_, DeviceState>, id: String) -> Result<(), String> {
    if let Some(flag) = state.watches.lock().map_err(|e| e.to_string())?.get(&id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}
