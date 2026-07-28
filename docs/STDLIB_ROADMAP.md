# @agapi/stdlib roadmap

Target: **Node-shaped + platform APIs** for scripts, control protocols, drivers, and the **stdlib gallery** — not a full Node runtime and **not** CF GUI logic.

Related: [COMPAT.md](./COMPAT.md) (behavior contract), [ARCHITECTURE.md](./ARCHITECTURE.md) (layers).

---

## Mission

| In scope | Out of scope |
|----------|----------------|
| Transport: net / dgram / http / dns / tls / mdns | Full Node module matrix |
| Platform device: network status, sensors, battery, … | CF joins / Pixi / GUI |
| Buffer, process, EventEmitter, SystemError | `child_process`, workers |
| Host-injectable backends (Tauri / mock / browser probes) | Device **drivers** / Matter app logic (sibling packages) |
| `window.agapi.*` for classic project scripts | CF-specific wrappers (those live in **cf-runtime**, thin) |

```
gallery / drivers / CF scripts
            │
     window.agapi.*     ← installStdlib(host)
            │
     @agapi/stdlib      ← public façades (Node-shaped + platform)
            │
     host-tauri / mock  ← no CF imports
            │
     OS / browser / Rust plugins
```

**Hard rule:** platform capabilities are **`agapi.*` + host**, never implemented inside `@agapi/cf-runtime`.  
cf-runtime may later *map* `CF.ipv4address` / `CF.startMonitoring` → `agapi.device.*` / `agapi.sensors.*`, but the real work is in stdlib/host.

---

## Status (baseline)

| Tier | Modules | Status |
|------|---------|--------|
| **T0** | `events`, `Buffer`, `process` (partial) | ✅ |
| **T1** | `net`, `dgram`, `http` (client + server), `http.WebSocket` (client), `http.WebSocketServer` (+ host) | ✅ happy-path. HTTP client/server on official `@tauri-apps/plugin-http`; WS client on official `@tauri-apps/plugin-websocket`; WS server stays custom (axum) — no official Tauri plugin accepts inbound WS |
| **T1+** | `dns.lookup`, `tls.connect` (client) | ✅ client only — server (`tls.createServer`, https server) ❌ planned, see Phase A |
| **T1++** | `mdns.browse` / `publish` | ✅ lab (Tauri / mdns-sd) |
| **T2** | `stream` / backpressure / `drain` | ❌ |
| **T3** | `fs` subset | ✅ lab. Scoped to app data/config/cache/log dirs + temp (`fs:allow-app-*-recursive`), not whole-disk |
| **T4** | **platform device** (network status, sensors, props, NFC, notify, bio, haptics, camera, BT) | 🟡 network status (C1), notifications (C5), biometric (C6, mobile-only), haptics (C7, mobile + browser fallback), NFC (C8, mobile-only) shipped; sensors/device-props/camera/BT ⏸ blocked — no official Tauri plugin for any of these yet, see C2/C3/C9 |
| **T4b** | `crypto` (stdlib façade) | ❌ browser Web Crypto in gallery only |

Globals after `installStdlib` today:  
**`agapi.{net,dgram,http,dns,tls,mdns,device,notifications,biometric,haptics,nfc,fs,Buffer,process,host,version}`**.
`agapi.device` is `getNetworkStatus()` + `watchNetwork()` only so far (see C1). `agapi.biometric`/`agapi.nfc` are **mobile-only** (Android/iOS — not compiled into desktop builds at all); `agapi.haptics` has a mobile host + `navigator.vibrate` browser fallback; `agapi.notifications` and `agapi.fs` work everywhere.

Planned additions (names may refine):  
**`agapi.sensors`**, **`agapi.crypto`**, later camera/bluetooth. More `agapi.device` fields (battery, brightness, volume, identity — C2).  
⏸ **C2 (device props), C3 (sensors), and bluetooth (C9) are blocked**: no official `@tauri-apps/plugin-*` covers any of these today, and rolling a custom Rust/host implementation isn't a current priority. Re-check the official Tauri plugin list periodically — pick these back up once an official plugin lands.

---

## Development principles

1. stdlib **never** imports `@tauri-apps/*`, CF, or Pixi.
2. host-tauri **never** imports CF / Pixi / joins.
3. **cf-runtime** only *consumes* `@agapi/stdlib/*` — no OS IPC of its own for device APIs.
4. One PR ≈ one module or one behavior; update **COMPAT.md** with surface changes.
5. Prefer honest stubs + gallery **info/lab** over fake CF globals.
6. Protocols (Matter, AV brands) live in **`@agapi/drivers`** (or sibling packages), not stdlib.
7. Gallery validates features; it is not the public API.
8. `installStdlib` **never replaces browser globals** (`fetch`, `WebSocket`, …) — host capabilities are opt-in via `agapi.*` only. Tried a `replaceFetch` option once: Tauri's own IPC (`invoke()`) sends commands via the page's global `fetch()` to a custom `ipc://` protocol, and `agapi.http.fetch` itself calls `invoke()` — replacing `fetch` with it recurses forever and hangs every `invoke()` call. Not fixable on our side; removed rather than left disabled-by-default as a footgun.

---

## Roadmap phases

### Phase A — Stabilize T1 / T1+ (current baseline)

**Goal:** reliable sockets for systems, gallery, and drivers.

| Item | Notes |
|------|--------|
| Error `code` matrix | `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, … |
| TCP `write` / `drain` (minimal) | backpressure |
| TLS / HTTP polish | timeouts, clearer errors, HTTPS options (`rejectUnauthorized`, `connectTimeout`, `maxRedirections`, `proxy`) |
| `tls.createServer` (server-side TLS) | ❌ not started. `net/tls.rs` only has `rustls::ClientConfig` + `TlsConnector` today; server needs `rustls::ServerConfig` + `tokio_rustls::TlsAcceptor` wrapping a `TcpListener` (same rustls dep already in `Cargo.toml`, no new plugin — Tauri has no generic TLS-socket plugin, client or server) |
| `http.createServer` over TLS (https server) | ❌ not started. `plugins/http/server.rs` is plain `TcpListener` + `axum::serve`, no TLS acceptor wrapped around it yet — same rustls building block as `tls.createServer` above |
| Mock host parity | browser `npm run dev` stays useful |
| Smoke tests | unit on mock; optional Tauri loopback |

### Phase B — Gallery-driven verification

**Goal:** interactive proof for every shipped surface.

| Gallery tool | Surface | Status |
|--------------|---------|--------|
| Sockets | `agapi.net` / `dgram` | live |
| TLS client | `agapi.tls` | lab |
| HTTP | `agapi.http.request` (+ browser `fetch()` toggle) | lab |
| HTTP server | `agapi.http.createServer` | lab |
| WebSocket server | `agapi.http.WebSocketServer` | lab |
| WebSocket client | `agapi.http.WebSocket` (+ browser `WebSocket` toggle) | lab |
| DNS | `agapi.dns` | lab |
| mDNS | `agapi.mdns` | lab |
| Network status | `agapi.device.getNetworkStatus` / `watchNetwork` | lab |
| OS info | `@tauri-apps/plugin-os` (direct, not `agapi.*` yet) | lab |
| Bluetooth | host ⏸ blocked (no official plugin) | stub |
| Sensors | `agapi.sensors` | ⏸ blocked (no official plugin) |
| Haptics | `agapi.haptics` | lab (mobile host + browser `navigator.vibrate` fallback) |
| Notifications | `agapi.notifications` | lab (desktop + mobile) |
| Filesystem | `agapi.fs` | lab |
| NFC | `agapi.nfc` | lab (**mobile only**) |
| Biometric | `agapi.biometric` | lab (**mobile only**) |
| WebRTC / WebCodecs | browser | info |
| Crypto | browser `crypto.subtle` | lab (not `agapi.crypto` yet) |
| **Device props** (battery, brightness, volume, identity) | `agapi.device` | ⏸ blocked (no official plugin) |

### Phase C — Platform device APIs (**agapi**, not cf-runtime)

All of the following land as **stdlib façades + host capabilities**.  
cf-runtime remains a thin adapter later (`CF.*` → `agapi.*`).

#### C1 — Device network status (P0)

| API | Status |
|-----|--------|
| `agapi.device.getNetworkStatus()` | ✅ shipped. Snapshot: `hasNetwork`, `networkType` (best-effort, by interface name), `addresses` (IPv4/IPv6 + netmask, per non-loopback interface) |
| `agapi.device.watchNetwork(cb)` | ✅ shipped. Returns `Promise<{ stop() }>`; `cb` fires with a fresh snapshot on real Wi-Fi/Ethernet connect, disconnect, or address change. Backed by `if_addrs::IfChangeNotifier` (background OS thread, polls with a 1s timeout so `stop()` is cooperative, not forced) |
| `ssid` field | ❌ not implemented — needs platform-specific Wi-Fi APIs (nl80211 / `NEHotspotNetwork` / WinRT), no host has one yet |
| Apple platforms (macOS/iOS/…) | ❌ `watchNetwork` has no backend there — `IfChangeNotifier` doesn't exist on Apple targets and this project doesn't build for them today; a future macOS/iOS port needs a different watch mechanism |

Host: `if_addrs::get_if_addrs()` (Rust, already a transitive dep via `mdns-sd`, now direct) — synchronous, no per-platform code needed for the snapshot.

#### C2 — Device properties (P1) — ⏸ blocked, no official plugin

| Property | Notes |
|----------|--------|
| battery level + charge status | Battery Status API and/or OS |
| screen brightness | get/set where OS allows |
| sound volume | get (set optional) |
| identity | model, name, uuid / machine id |

Events: property change stream on `agapi.device` (not CF events in stdlib).

**Blocked (2026-07-28):** no official `@tauri-apps/plugin-*` exposes battery/brightness/volume/identity today. Writing a custom Rust host for this isn't a priority right now — periodically re-check the official Tauri plugin registry and revisit once one exists.

#### C3 — Sensors (P1–P2) — ⏸ blocked, no official plugin

| Sensor | Typical backend |
|--------|-----------------|
| accelerometer | DeviceMotion / host |
| gyroscope | DeviceMotion / host |
| attitude | DeviceOrientation / host |
| heading | compass / host |
| location | Geolocation / host |

API sketch: `agapi.sensors.start(type, options)` → handle with `stop()` + data events; `agapi.sensors.available()`.

**Blocked (2026-07-28):** no official `@tauri-apps/plugin-*` covers motion/orientation/compass/location sensors today. Custom host isn't a priority right now — periodically re-check the official Tauri plugin registry and revisit once one exists.

#### C4 — Filesystem subset **T3** (P1) — ✅ shipped

Narrow **host** FS (not full POSIX Node `fs`), on official `@tauri-apps/plugin-fs`:

| Op | Status |
|----|--------|
| `agapi.fs.readFile` / `readTextFile` / `writeFile` / `appendFile` | ✅ |
| `agapi.fs.mkdir` / `readdir` / `stat` / `remove` / `exists` | ✅ |
| scoped roots (`baseDir`: appData/appConfig/appLocalData/appCache/appLog/temp) | ✅ |
| arbitrary whole-disk access | ❌ **not** granted by default (see capability-tightening note below) |

**Capability history worth knowing:** `capabilities/default.json` originally carried `fs:read-all` /
`fs:write-all`, which (verified by reading `tauri-plugin-fs`'s own `permissions/*.toml`, not just
docs) grant every fs-related command with **no pre-configured accessible paths at all** — i.e.
unrestricted whole-disk read/write, not the narrower-looking allowlist entries sitting next to them.
Asked the user, chose to tighten immediately rather than defer. Fixed in two parts:
1. Narrowed the static ACL to `fs:allow-app-read-recursive` / `fs:allow-app-write-recursive` /
   `fs:allow-temp-write-recursive` (official convenience sets scoped to `$APPCONFIG`/`$APPDATA`/
   `$APPLOCALDATA`/`$APPCACHE`/`$APPLOG`/`$TEMP`).
2. The CF project-open picker (`src/apps/cf/openProject.ts`) needs to read a user-picked file from
   *anywhere* on disk, which the narrowed static scope no longer covers. Added a Rust command
   `fs_allow_read_path` (`src-tauri/src/lib.rs`) that calls `tauri_plugin_fs::FsExt::fs_scope()` to
   grant runtime read access to just that one path + its parent dir. This works because
   `tauri-plugin-fs`'s `resolve_path` ORs the static ACL scope with this runtime scope
   (`fs_scope.scope.is_allowed(..) || scope.is_allowed(..)`) — confirmed by reading the plugin's own
   `commands.rs` — so it only ever *adds* access to the one picked path, never widens the rest.

See [COMPAT.md](./COMPAT.md#filesystem-agapifs) for the full surface + code example.

#### C5 — Notifications (P2) — ✅ shipped

| Op | Status |
|----|--------|
| `agapi.notifications.isPermissionGranted()` / `requestPermission()` | ✅ official `@tauri-apps/plugin-notification`, desktop + mobile |
| `agapi.notifications.show({ title, body, … })` | ✅ synchronous, matching the underlying plugin |
| `agapi.notifications.onAction(cb)` | ✅ tap / action-button events |

#### C6 — Biometric (P2) — ✅ shipped, mobile-only

| Op | Status |
|----|--------|
| `agapi.biometric.checkStatus()` | ✅ full upstream shape: `isAvailable`, `biometryType`, `error`, `errorCode` |
| `agapi.biometric.authenticate(reason, options?)` | ✅ rejects on cancel/failure |

Official `@tauri-apps/plugin-biometric` — **Android/iOS only**, not compiled into desktop
builds at all (`target.'cfg(android/ios)'.dependencies` in `src-tauri/Cargo.toml`); no
pure-browser fallback exists for this one.

#### C7 — Haptics (P2) — ✅ shipped

| Op | Status |
|----|--------|
| `agapi.haptics.impact(style?)` | ✅ light / medium / heavy / soft / rigid (richer than originally sketched) |
| `agapi.haptics.notification(type?)` | ✅ success / warning / error |
| `agapi.haptics.selection()` | ✅ |
| `agapi.haptics.vibrate(ms)` | ✅ bonus, matches the plugin 1:1 |

Official `@tauri-apps/plugin-haptics` (mobile-only, same as biometric) **with** a
`navigator.vibrate` browser/desktop-webview fallback implemented in the stdlib facade itself
— the one part of C6-C8 that isn't strictly mobile-locked.

#### C8 — NFC (P2–P3) — ✅ shipped, mobile-only

| Op | Status |
|----|--------|
| `agapi.nfc.isAvailable()` | ✅ |
| `agapi.nfc.scan(scanType, options?)` | ✅ NDEF/tag scan |
| `agapi.nfc.write(records, options?)` | ✅ |
| `agapi.nfc.textRecord()` / `uriRecord()` | ✅ pure passthrough to the plugin's own encoders — not reimplemented |

Official `@tauri-apps/plugin-nfc` — **Android/iOS only**. `scanType`/`options`/records stay
loosely typed (`any`) in `NfcHost` — the upstream `ScanKind`/`TechKind`/`NFCRecord` tree is
fairly deep and not worth re-declaring for a facade this thin.

#### C9 — Camera / Bluetooth — ⏸ blocked, no official plugin

Stay host-mobile scoped; façades under `agapi.camera` / `agapi.bluetooth` when implemented — still **not** cf-runtime. Bluetooth has a gallery stub; camera's was pulled for now (no host plan yet) — re-add when there's an actual capability to stub against.

**Blocked (2026-07-28):** no official `@tauri-apps/plugin-*` for Bluetooth (or camera) today. Custom host isn't a priority right now — periodically re-check the official Tauri plugin registry and revisit once one exists.

#### C10 — Crypto façade (optional)

Gallery already probes browser Web Crypto. Later:

- `agapi.crypto` thin wrapper (random, hash, hmac) for scripts  
- Matter-grade AES-CCM stays in matter.js / drivers, not necessarily stdlib

### Phase D — Streams (T2) — only if needed

Minimal Duplex / `drain` if third-party code or production backpressure requires it.  
Otherwise framing stays in drivers / CF systems.

### Explicit non-goals (long horizon)

- Full Node `fs` / `crypto` / `child_process`  
- Implementing device/sensors **inside** cf-runtime  
- UDS / IPC paths  
- `require()` module loader  
- Exact Node `errno` matrix  
- Full WebRTC stack inside stdlib  

---

## Proposed `window.agapi` growth

```
agapi
├── net, dgram, http, dns, tls, mdns     # transport (shipped / lab)
├── Buffer, process, host, version
├── device       # getNetworkStatus()+watchNetwork() shipped; battery, brightness, volume, identity [blocked — no official plugin]
├── sensors      # accel, gyro, attitude, heading, location               [blocked — no official plugin]
├── fs           # scoped files (app data/config/cache/log + temp)        [shipped]
├── nfc          # NDEF scan/write — mobile only (Android/iOS)            [shipped]
├── notifications # permission + show + onAction — desktop + mobile       [shipped]
├── biometric    # checkStatus + authenticate — mobile only               [shipped]
├── haptics      # impact/notification/selection/vibrate — mobile + browser vibrate fallback [shipped]
├── crypto       # optional thin WebCrypto/host wrapper                   [planned]
├── camera / bluetooth   # mobile                                         [blocked — no official plugin]
└── drivers      # later install from @agapi/drivers
```

cf-runtime (later, thin):

```
CF.ipv4address          ← agapi.device network snapshot
CF.NetworkStatusChange  ← agapi.device events
CF.startMonitoring      ← agapi.sensors
CF.device.batteryLevel  ← agapi.device
CF.setDeviceProperty    ← agapi.device.set(...)
```

---

## Implementation sketch (host binding)

```ts
// packages/stdlib/src/host.ts (conceptual)
interface DeviceHost {
  getNetworkStatus(): Promise<NetworkStatus>;
  watchNetwork?(cb: (s: NetworkStatus) => void): () => void;
  getBattery?(): Promise<BatteryStatus>;
  // brightness / volume / identity …
}

interface SensorsHost { /* start/stop streams */ }
interface FsHost { /* scoped paths */ }
interface NfcHost { /* session */ }
interface NotificationsHost { /* show / permission */ }
interface BiometricHost { /* authenticate */ }
interface HapticsHost { /* impact */ }

interface AgapiHost {
  net: NetHost;
  http?: HttpHost;
  dns?: DnsHost;
  tls?: TlsHost;
  mdns?: MdnsHost;
  device?: DeviceHost;
  sensors?: SensorsHost;
  fs?: FsHost;
  nfc?: NfcHost;
  notifications?: NotificationsHost;
  biometric?: BiometricHost;
  haptics?: HapticsHost;
}
```

Missing host capability → clear error in façade (same pattern as `mdns` / `http`).

---

## Suggested PR / branch order

| Order | Branch (example) | Deliverable |
|-------|------------------|-------------|
| 1 | `feat/agapi-device-network` | ✅ shipped: network status snapshot + watch + gallery |
| 2 | `feat/agapi-device-battery` | ⏸ blocked — battery + property events, no official Tauri plugin yet |
| 3 | `feat/agapi-fs` | ✅ shipped: scoped read/write/mkdir/readdir/stat/remove/exists + capability tightening + gallery |
| 4 | `feat/agapi-sensors` | ⏸ blocked — accel/geo first, then gyro/attitude/heading, no official Tauri plugin yet |
| 5 | `feat/agapi-notifications` | ✅ shipped: permission + show + onAction + gallery |
| 6 | `feat/agapi-haptics` | ✅ shipped: vibrate/impact/notification/selection + browser fallback + gallery |
| 7 | `feat/agapi-biometric` | ✅ shipped: checkStatus + authenticate (mobile-only) + gallery |
| 8 | `feat/agapi-nfc` | ✅ shipped: isAvailable/scan/write + gallery (mobile-only) |
| 9 | `feat/cf-bridge-device` | **only then** map CF.* → agapi (optional) |

Do **not** mix cf-runtime GUI changes into platform host PRs.

---

## Success criteria

- [ ] Every live COMPAT surface has a gallery tool (or explicit opt-out).
- [ ] Platform APIs work from gallery **without** loading a CF project.
- [ ] cf-runtime has **zero** direct Tauri/device IPC for these features.
- [ ] Mock browser: honest empty/unavailable, no fake “always Wi‑Fi”.
- [ ] New modules: COMPAT row + `installStdlib` / `agapi.*` + gallery entry.

---

## Changelog of this doc

| Date | Note |
|------|------|
| 2026-07-26 | Initial roadmap + gallery plan |
| 2026-07-26 | mDNS lab shipped |
| 2026-07-27 | Platform device plan: network/sensors/props/fs/nfc/notifications/biometric/haptics under **agapi** (not cf-runtime); gallery crypto (browser) noted |
| 2026-07-27 | Noted TLS/HTTPS server gap (Phase A): both `tls.connect` and `http.createServer` are client-and-plain-only today; server-side TLS needs `rustls::ServerConfig` + `TlsAcceptor`, no official Tauri plugin covers either direction |
| 2026-07-28 | HTTP client/server migrated off the hand-rolled reqwest/rustls client onto official `@tauri-apps/plugin-http`; added `agapi.http.WebSocket` (MDN-compatible client) via official `@tauri-apps/plugin-websocket`. `agapi.http.WebSocketServer` (inbound) stays custom — no official plugin does that |
| 2026-07-28 | Fixed a batch of net-stack bugs found by audit: TCP server `'connection'` emitted before the socket was registered (race), IPv6 UDP bind/connect/send (bare `SocketAddr::from_str` needs brackets), UDP option setters silently swallowing OS errors, double-bind/double-connect races on UDP/TCP sockets, mDNS `browse_start` id race, `mdns` `hostname_guess()` never reading the real OS hostname, unbounded HTTP server request body |
| 2026-07-28 | Added, then **removed**, `installStdlib({ replaceFetch, replaceWebSocket })`: `replaceFetch` hung every `invoke()` call (Tauri's own IPC uses global `fetch()`, and `agapi.http.fetch` itself calls `invoke()` — infinite recursion, not fixable on our side). Dropped `replaceWebSocket` too for the same simple rule: stdlib never touches browser globals. Gallery's HTTP/WebSocket-client tools gained an explicit per-call toggle (`agapi.http.*` vs plain `fetch()`/`WebSocket`) instead |
| 2026-07-28 | `npm run android:debug` / `android:install:debug` — build + install a debug APK in one step (tooling, not a stdlib surface) |
| 2026-07-28 | **Phase C1 shipped:** `agapi.device.getNetworkStatus()` — snapshot (`hasNetwork`, best-effort `networkType`, non-loopback `addresses`) via `if_addrs::get_if_addrs()`. No `ssid` (needs platform-specific Wi-Fi APIs); gallery Network status tool added |
| 2026-07-28 | **C1 watch shipped:** `agapi.device.watchNetwork(cb)` — background thread on `if_addrs::IfChangeNotifier`, emits a fresh snapshot per real change (spurious wakeups filtered internally). `async`-returning so a platform/permission failure rejects instead of silently no-op-ing. No Apple-platform backend (`IfChangeNotifier` doesn't exist there; not a build target today). Gallery tool got a Watch/Stop toggle + change log |
| 2026-07-28 | Gallery regrouped into **Network** / **Device** / **Browser APIs** sections. Added OS info tool (direct `@tauri-apps/plugin-os` probe, not `agapi.*` yet) and gallery stubs for sensors/haptics/notifications/fs/nfc/biometric (previously "planned" rows with no UI). Pulled the camera stub for now — no host plan behind it. Dropped "NC"/"netcat" naming throughout (sockets tool, console header) — it read as a leftover from the original CF-tooling name, not a real distinction |
| 2026-07-28 | **C5-C8 shipped:** `agapi.notifications` (`@tauri-apps/plugin-notification`, desktop+mobile), `agapi.biometric` and `agapi.nfc` (mobile-only — Android/iOS, not compiled into desktop builds at all: `target.'cfg(android/ios)'.dependencies` in `Cargo.toml`), `agapi.haptics` (mobile host + `navigator.vibrate` browser fallback in the stdlib facade). Verified real permission defaults from each plugin's own `permissions/default.toml` rather than trusting doc summaries — `haptics` has **no** default set at all (every `allow-*` must be listed explicitly), `os:default`/`biometric:default`/`nfc:default` exclude hostname/write respectively. New `capabilities/mobile.json` (`platforms: ["android","iOS"]`) holds the mobile-only permissions so desktop capabilities stay clean. Sensors/fs/Bluetooth gallery stubs unchanged (still genuinely not implemented) |
| 2026-07-28 | **C2/C3/C9 marked blocked:** device properties (battery/brightness/volume/identity), sensors (accel/gyro/attitude/heading/location), and Bluetooth have no official `@tauri-apps/plugin-*` today. User decision: don't roll custom Rust hosts for these — not a priority. Periodically re-check the official Tauri plugin registry and revisit once one lands. Camera stays pulled (no host plan) |
| 2026-07-28 | **C4 shipped:** `agapi.fs` on official `@tauri-apps/plugin-fs` — `readFile`/`readTextFile`/`writeFile`/`appendFile`/`mkdir`/`readdir`/`stat`/`remove`/`exists`, scoped via `baseDir` (appData/appConfig/appLocalData/appCache/appLog/temp). Found (by reading the plugin's own `permissions/*.toml`, not docs) that `capabilities/default.json` had `fs:read-all`/`fs:write-all` — genuinely unrestricted whole-disk access, not the narrower allowlist entries sitting next to them. User chose to tighten immediately: narrowed to `fs:allow-app-*-recursive` + `fs:allow-temp-write-recursive`, and added a new `fs_allow_read_path` Rust command (`AppHandle::fs_scope()`) so the CF project-open picker can still grant runtime read access to an arbitrary user-picked path without widening the static ACL — relies on `tauri-plugin-fs::resolve_path` ORing the static scope with this runtime scope. Gallery `fs` stub replaced with a real read/write/mkdir/readdir/stat/remove lab |
