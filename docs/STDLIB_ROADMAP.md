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
| **T3** | `fs` subset | ❌ planned |
| **T4** | **platform device** (network status, sensors, props, NFC, notify, bio, haptics, camera, BT) | 🟡 network status shipped (snapshot + watch, no `ssid` — see C1); rest ❌ planned |
| **T4b** | `crypto` (stdlib façade) | ❌ browser Web Crypto in gallery only |

Globals after `installStdlib` today:  
**`agapi.{net,dgram,http,dns,tls,mdns,device,Buffer,process,host,version}`**.
`agapi.device` is `getNetworkStatus()` + `watchNetwork()` only so far — see C1.

Planned additions (names may refine):  
**`agapi.sensors`**, **`agapi.fs`**, **`agapi.nfc`**, **`agapi.notifications`**, **`agapi.biometric`**, **`agapi.haptics`**, **`agapi.crypto`**, later camera/bluetooth. More `agapi.device` fields (battery, brightness, volume, identity — C2).

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
| Bluetooth | host planned | stub |
| Sensors | `agapi.sensors` | stub |
| Haptics | `agapi.haptics` | stub |
| Notifications | `agapi.notifications` | stub |
| Filesystem | `agapi.fs` | stub |
| NFC | `agapi.nfc` | stub |
| Biometric | `agapi.biometric` | stub |
| WebRTC / WebCodecs | browser | info |
| Crypto | browser `crypto.subtle` | lab (not `agapi.crypto` yet) |
| **Device props** (battery, brightness, volume, identity) | `agapi.device` | planned |
| **Haptics** | `agapi.haptics` | planned |

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

#### C2 — Device properties (P1)

| Property | Notes |
|----------|--------|
| battery level + charge status | Battery Status API and/or OS |
| screen brightness | get/set where OS allows |
| sound volume | get (set optional) |
| identity | model, name, uuid / machine id |

Events: property change stream on `agapi.device` (not CF events in stdlib).

#### C3 — Sensors (P1–P2)

| Sensor | Typical backend |
|--------|-----------------|
| accelerometer | DeviceMotion / host |
| gyroscope | DeviceMotion / host |
| attitude | DeviceOrientation / host |
| heading | compass / host |
| location | Geolocation / host |

API sketch: `agapi.sensors.start(type, options)` → handle with `stop()` + data events; `agapi.sensors.available()`.

#### C4 — Filesystem subset **T3** (P1)

Narrow **host** FS (not full POSIX Node `fs`):

| Op | Use |
|----|-----|
| `readFile` / `writeFile` / `appendFile` | logs, config, cache |
| `mkdir` / `readdir` / `stat` / `remove` | app data dir |
| scoped roots | app data, cache, optional user-picked dir |

No arbitrary whole-disk access without explicit picker/permission.

#### C5 — Notifications (P2)

| Op | Notes |
|----|--------|
| `agapi.notifications.requestPermission()` | OS / web |
| `agapi.notifications.show({ title, body, … })` | local notify |
| optional tap / dismiss events | host-dependent |

#### C6 — Biometric (P2)

| Op | Notes |
|----|--------|
| `agapi.biometric.isAvailable()` | face / fingerprint / none |
| `agapi.biometric.authenticate({ reason })` | unlock / confirm action |

Host-only on mobile/desktop OS; no pure-browser guarantee.

#### C7 — Haptics (P2)

| Op | Notes |
|----|--------|
| `agapi.haptics.impact(style?)` | light / medium / heavy |
| `agapi.haptics.notification(type?)` | success / warning / error |
| `agapi.haptics.selection()` | tick |

Browser: `navigator.vibrate` fallback where present; mobile host preferred.

#### C8 — NFC (P2–P3)

| Op | Notes |
|----|--------|
| scan / session | NDEF read |
| write (optional) | where OS allows |
| availability | Android-first; iOS limited; desktop rare |

Likely **host plugin** only; gallery stub until mobile host exists.

#### C9 — Camera / Bluetooth

Stay host-mobile scoped; façades under `agapi.camera` / `agapi.bluetooth` when implemented — still **not** cf-runtime. Bluetooth has a gallery stub; camera's was pulled for now (no host plan yet) — re-add when there's an actual capability to stub against.

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
├── device       # getNetworkStatus()+watchNetwork() shipped; battery, brightness, volume, identity [planned]
├── sensors      # accel, gyro, attitude, heading, location               [planned]
├── fs           # scoped files                                           [planned]
├── nfc          # NDEF scan/write                                        [planned]
├── notifications
├── biometric
├── haptics
├── crypto       # optional thin WebCrypto/host wrapper                   [planned]
├── camera / bluetooth   # mobile                                         [planned]
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
| 2 | `feat/agapi-device-battery` | battery + property events |
| 3 | `feat/agapi-fs` | scoped read/write + gallery |
| 4 | `feat/agapi-sensors` | accel/geo first, then gyro/attitude/heading |
| 5 | `feat/agapi-notifications` | local notifications |
| 6 | `feat/agapi-haptics` | vibrate / impact |
| 7 | `feat/agapi-biometric` | auth prompt |
| 8 | `feat/agapi-nfc` | mobile NDEF |
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
