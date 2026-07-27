//! mDNS / DNS-SD browse + publish via `mdns-sd` (pure Rust, cross-platform).
//!
//! Frontend listens on event `mdns-event` with camelCase JSON payloads.

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use uuid::Uuid;

const EVENT_NAME: &str = "mdns-event";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsServicePayload {
    pub name: String,
    pub service_type: String,
    pub fullname: String,
    pub host: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub txt: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsEventPayload {
    pub id: String,
    /// started | found | resolved | removed | stopped | error | published | unpublished
    pub event: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fullname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<MdnsServicePayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub struct MdnsState {
    daemon: Mutex<Option<ServiceDaemon>>,
    /// browse_id → normalized service type
    browses: Mutex<HashMap<String, String>>,
    /// publish_id → fullname for unregister
    publishes: Mutex<HashMap<String, String>>,
}

impl Default for MdnsState {
    fn default() -> Self {
        Self {
            daemon: Mutex::new(None),
            browses: Mutex::new(HashMap::new()),
            publishes: Mutex::new(HashMap::new()),
        }
    }
}

pub fn init_state<R: Runtime>(app: &AppHandle<R>) {
    app.manage(MdnsState::default());
}

fn with_daemon<F, T>(state: &MdnsState, f: F) -> Result<T, String>
where
    F: FnOnce(&ServiceDaemon) -> Result<T, String>,
{
    let mut guard = state.daemon.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let d = ServiceDaemon::new().map_err(|e| format!("mdns daemon: {e}"))?;
        *guard = Some(d);
    }
    let d = guard.as_ref().ok_or_else(|| "mdns daemon missing".to_string())?;
    f(d)
}

/// Normalize to DNS-SD form ending with `.local.`
fn normalize_service_type(ty: &str) -> Result<String, String> {
    let mut t = ty.trim().to_string();
    if t.is_empty() {
        return Err("empty service type".into());
    }
    while t.ends_with('.') {
        t.pop();
    }
    if !t.ends_with(".local") {
        t.push_str(".local");
    }
    t.push('.');
    Ok(t)
}

fn instance_from_fullname(fullname: &str, ty: &str) -> String {
    let f = fullname.trim_end_matches('.');
    let t = ty.trim_end_matches('.');
    let suffix = format!(".{t}");
    if let Some(prefix) = f.strip_suffix(&suffix) {
        prefix.to_string()
    } else {
        fullname
            .split('.')
            .next()
            .unwrap_or(fullname)
            .to_string()
    }
}

fn txt_to_map(props: &mdns_sd::TxtProperties) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for p in props.iter() {
        map.insert(p.key().to_string(), p.val_str().to_string());
    }
    map
}

fn resolved_to_payload(info: &mdns_sd::ResolvedService) -> MdnsServicePayload {
    let service_type = info.ty_domain.clone();
    let fullname = info.fullname.clone();
    let name = instance_from_fullname(&fullname, &service_type);
    let addresses: Vec<String> = info.addresses.iter().map(|a| a.to_string()).collect();
    MdnsServicePayload {
        name,
        service_type,
        fullname,
        host: info.host.clone(),
        port: info.port,
        addresses,
        txt: txt_to_map(&info.txt_properties),
    }
}

fn emit_event<R: Runtime>(app: &AppHandle<R>, payload: MdnsEventPayload) {
    if let Err(e) = app.emit(EVENT_NAME, payload) {
        log::warn!("[mdns] emit failed: {e}");
    }
}

/// Start browsing `serviceType` (e.g. `_http._tcp`). Returns browse session id.
/// The caller supplies `browse_id` so it can filter events that may arrive
/// before this command resolves (the browse thread emits immediately).
#[tauri::command]
pub fn mdns_browse_start<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, MdnsState>,
    service_type: String,
    browse_id: Option<String>,
) -> Result<String, String> {
    let ty = normalize_service_type(&service_type)?;
    let browse_id = browse_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let receiver = with_daemon(&state, |d| {
        d.browse(&ty).map_err(|e| format!("browse: {e}"))
    })?;

    state
        .browses
        .lock()
        .map_err(|e| e.to_string())?
        .insert(browse_id.clone(), ty.clone());

    let app2 = app.clone();
    let id2 = browse_id.clone();
    let ty2 = ty.clone();

    std::thread::Builder::new()
        .name(format!("mdns-browse-{browse_id}"))
        .spawn(move || {
            emit_event(
                &app2,
                MdnsEventPayload {
                    id: id2.clone(),
                    event: "started".into(),
                    service_type: Some(ty2.clone()),
                    fullname: None,
                    service: None,
                    error: None,
                },
            );

            while let Ok(ev) = receiver.recv() {
                match ev {
                    ServiceEvent::SearchStarted(st) => {
                        emit_event(
                            &app2,
                            MdnsEventPayload {
                                id: id2.clone(),
                                event: "started".into(),
                                service_type: Some(st),
                                fullname: None,
                                service: None,
                                error: None,
                            },
                        );
                    }
                    ServiceEvent::ServiceFound(st, fullname) => {
                        emit_event(
                            &app2,
                            MdnsEventPayload {
                                id: id2.clone(),
                                event: "found".into(),
                                service_type: Some(st),
                                fullname: Some(fullname),
                                service: None,
                                error: None,
                            },
                        );
                    }
                    ServiceEvent::ServiceResolved(info) => {
                        let service = resolved_to_payload(&info);
                        emit_event(
                            &app2,
                            MdnsEventPayload {
                                id: id2.clone(),
                                event: "resolved".into(),
                                service_type: Some(service.service_type.clone()),
                                fullname: Some(service.fullname.clone()),
                                service: Some(service),
                                error: None,
                            },
                        );
                    }
                    ServiceEvent::ServiceRemoved(st, fullname) => {
                        emit_event(
                            &app2,
                            MdnsEventPayload {
                                id: id2.clone(),
                                event: "removed".into(),
                                service_type: Some(st),
                                fullname: Some(fullname),
                                service: None,
                                error: None,
                            },
                        );
                    }
                    ServiceEvent::SearchStopped(st) => {
                        emit_event(
                            &app2,
                            MdnsEventPayload {
                                id: id2.clone(),
                                event: "stopped".into(),
                                service_type: Some(st),
                                fullname: None,
                                service: None,
                                error: None,
                            },
                        );
                        break;
                    }
                    _ => {}
                }
            }
        })
        .map_err(|e| format!("spawn browse thread: {e}"))?;

    log::info!("[mdns] browse start id={browse_id} type={ty}");
    Ok(browse_id)
}

/// Stop a browse session by id.
#[tauri::command]
pub fn mdns_browse_stop(
    state: State<'_, MdnsState>,
    browse_id: String,
) -> Result<(), String> {
    let ty = state
        .browses
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&browse_id);

    let Some(ty) = ty else {
        return Ok(()); // already stopped
    };

    // Only stop_browse if no other session uses same type
    let still = state
        .browses
        .lock()
        .map_err(|e| e.to_string())?
        .values()
        .any(|t| t == &ty);

    if !still {
        with_daemon(&state, |d| {
            d.stop_browse(&ty).map_err(|e| format!("stop_browse: {e}"))
        })?;
    }

    log::info!("[mdns] browse stop id={browse_id} type={ty}");
    Ok(())
}

/// Publish a service. Returns publish session id.
#[tauri::command]
pub fn mdns_publish(
    state: State<'_, MdnsState>,
    service_type: String,
    instance_name: String,
    port: u16,
    txt: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let ty = normalize_service_type(&service_type)?;
    let name = instance_name.trim();
    if name.is_empty() {
        return Err("empty instance name".into());
    }
    if port == 0 {
        return Err("port must be non-zero".into());
    }

    let hostname = format!(
        "{}.local.",
        hostname_guess()
    );

    let props = txt.unwrap_or_default();
    let service_info = ServiceInfo::new(&ty, name, &hostname, "", port, Some(props))
        .map_err(|e| format!("ServiceInfo: {e}"))?
        .enable_addr_auto();

    let fullname = service_info.get_fullname().to_string();
    let publish_id = Uuid::new_v4().to_string();

    with_daemon(&state, |d| {
        d.register(service_info)
            .map_err(|e| format!("register: {e}"))
    })?;

    state
        .publishes
        .lock()
        .map_err(|e| e.to_string())?
        .insert(publish_id.clone(), fullname.clone());

    log::info!("[mdns] published id={publish_id} fullname={fullname}");
    Ok(publish_id)
}

/// Unpublish a previously published service.
#[tauri::command]
pub fn mdns_unpublish(
    state: State<'_, MdnsState>,
    publish_id: String,
) -> Result<(), String> {
    let fullname = state
        .publishes
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&publish_id);

    let Some(fullname) = fullname else {
        return Ok(());
    };

    with_daemon(&state, |d| {
        let rx = d
            .unregister(&fullname)
            .map_err(|e| format!("unregister: {e}"))?;
        // wait briefly for result (sync)
        let _ = rx.recv_timeout(std::time::Duration::from_secs(2));
        Ok(())
    })?;

    log::info!("[mdns] unpublished id={publish_id} fullname={fullname}");
    Ok(())
}

fn hostname_guess() -> String {
    // Real OS hostname first — HOSTNAME/COMPUTERNAME env vars are usually
    // not exported to GUI processes, so they're only a fallback.
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .or_else(|| std::env::var("HOSTNAME").ok())
        .or_else(|| std::env::var("COMPUTERNAME").ok())
        .and_then(|h| {
            let h = h.trim();
            if h.is_empty() {
                None
            } else {
                // strip domain, sanitize for DNS labels
                let label = h.split('.').next().unwrap_or(h);
                let clean: String = label
                    .chars()
                    .map(|c| {
                        if c.is_ascii_alphanumeric() || c == '-' {
                            c.to_ascii_lowercase()
                        } else {
                            '-'
                        }
                    })
                    .collect();
                if clean.is_empty() {
                    None
                } else {
                    Some(clean)
                }
            }
        })
        .unwrap_or_else(|| "agapi".into())
}
