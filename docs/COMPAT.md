# Node.js compatibility (stdlib T0 / T1)

Target: **Node-shaped APIs** for CF scripts and control protocols — not a full Node runtime.

## Tiers

| Tier | Modules | Status |
|------|---------|--------|
| **T0** | `events`, `Buffer`, `process` (partial) | ✅ shipped |
| **T1** | `net`, `dgram`, `http` (+ host) | ✅ happy-path + polish |
| **T1+** | `dns.lookup`, `tls.connect` (client) | ✅ |
| **T1++** | `mdns.browse` / `mdns.publish` | ✅ lab (Tauri) |
| **T2** | `stream` / backpressure | ❌ not yet |
| **T3** | `fs` subset | ❌ not yet |

## Globals (after `installStdlib`)

Single namespace: **`window.agapi`** / **`globalThis.agapi`** (no top-level `window.net`, etc.).

| Path | Notes |
|------|--------|
| `agapi.net` | TCP client/server |
| `agapi.dgram` | UDP |
| `agapi.http` | createServer / request / get / WebSocketServer / WebSocket |
| `agapi.dns` | `lookup` / `lookupAsync` |
| `agapi.tls` | `connect` (client only) |
| `agapi.mdns` | `browse` / `publish` (DNS-SD; Tauri host) |
| `agapi.device` | `getNetworkStatus()` / `watchNetwork()` — online snapshot + watch, local addresses (Tauri host) |
| `agapi.notifications` | `isPermissionGranted` / `requestPermission` / `show` / `onAction` (desktop + mobile) |
| `agapi.biometric` | `checkStatus` / `authenticate` (**mobile only** — Android/iOS) |
| `agapi.haptics` | `impact` / `notification` / `selection` / `vibrate` (mobile host, browser `navigator.vibrate` fallback) |
| `agapi.nfc` | `isAvailable` / `scan` / `write` / `textRecord` / `uriRecord` (**mobile only** — Android/iOS) |
| `agapi.Buffer` | minimal subset (from/alloc/concat/toString) |
| `agapi.process` | `env`, `platform`, `nextTick`, `cwd()` stub |
| `agapi.host` | active host name (`tauri`, `mock`, …) |
| `agapi.version` | stdlib version string |

Application packages still use ESM: `import { net } from '@agapi/stdlib'`.

## Errors

Host errors are mapped to `SystemError` with optional `code`:

- `ECONNREFUSED`, `EADDRINUSE`, `ETIMEDOUT`, `ECONNRESET`, `EPIPE`, `ENOTFOUND`, …

```js
socket.on('error', (err) => {
  console.log(err.code); // e.g. 'ECONNREFUSED'
});
```

## TCP notes

| API | Behavior |
|-----|----------|
| `data` event | **`Buffer`** (unless `setEncoding`) |
| `write(data, cb)` | `cb(err?)`; always returns `true` (no drain yet) |
| `end()` | **half-close** write (FIN); keeps reading |
| `destroy()` | full teardown |
| `finish` | after write half closed |
| UDS / IPC path | not supported |

## UDP notes

| API | Behavior |
|-----|----------|
| `message` | `(Buffer, rinfo)` |
| `send` overloads | msg+port, msg+port+addr, offset/length forms |
| multicast / broadcast / TTL | supported on Tauri host |

## DNS

```js
agapi.dns.lookup('example.com', (err, address, family) => {
  // address: string, family: 4 | 6
});

agapi.dns.lookup('example.com', { family: 4, all: true }, (err, addresses) => {
  // addresses: [{ address, family }, ...]
});
```

Uses OS resolver via Rust `tokio::net::lookup_host`.

## TLS (client)

```js
const s = agapi.tls.connect({
  host: 'example.com',
  port: 443,
  servername: 'example.com',      // SNI
  rejectUnauthorized: true,       // false = accept any cert (lab/dev)
  // ALPNProtocols: ['http/1.1'],
}, () => {
  s.write('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');
});
s.on('data', (buf) => console.log(buf.toString()));
```

Events: `secureConnect`, `connect`, `data` (Buffer), `finish`, `end`, `close`, `error`.  
No `tls.createServer` yet.

## mDNS / DNS-SD

Host-backed (`mdns-sd` in Tauri). Not available on browser mock host.

```js
// Browse (service type with or without .local.)
const handle = agapi.mdns.browse('_http._tcp', (ev) => {
  if (ev.type === 'resolved' && ev.service) {
    console.log(ev.service.name, ev.service.addresses, ev.service.port, ev.service.txt);
  }
  if (ev.type === 'removed') console.log('gone', ev.fullname);
});
// handle.stop();

// Publish
const pub = await agapi.mdns.publish({
  type: '_agapi-demo._tcp',
  name: 'My Panel',
  port: 8080,
  txt: { path: '/' },
});
// await pub.stop();
```

Browse events: `started`, `found`, `resolved`, `removed`, `stopped`, `error`.  
Multicast requires real network permissions (desktop LAN / mobile local-network entitlement).

## Device network status

Host-backed (interface enumeration via `if-addrs` in Tauri). Not available on browser mock host.

```js
const status = await agapi.device.getNetworkStatus();
// { hasNetwork, networkType, addresses }

status.hasNetwork;   // boolean
status.networkType;  // 'wifi' | 'ethernet' | 'other' | 'none'
status.addresses;    // [{ address, family, interface, netmask }, ...]

// Subscribe to changes (Wi-Fi/Ethernet connect, disconnect, address change)
const handle = await agapi.device.watchNetwork((status) => {
  console.log(status.hasNetwork, status.networkType);
});
// later: handle.stop();
```

Watch is backed by `if_addrs::IfChangeNotifier` — a background thread blocks on the OS's
interface-change notification (netlink on Linux, equivalent on Windows/Android) and emits
a fresh snapshot only on a real change (spurious wakeups are filtered internally, not
debounced by us). `watchNetwork` is `async` specifically so a platform/permission failure
(e.g. notifier creation failing) surfaces as a rejected promise, not a silent no-op.

**Honest limits, not oversights:**
- `networkType` is a **best-effort guess from interface names** (`wl*` → wifi, `eth*`/`en*` → ethernet), not a real OS API query — no portable API distinguishes Wi-Fi from Ethernet across Linux/Windows/Android/macOS without extra platform-specific work.
- There is **no `ssid` field**. Reading the SSID needs platform-specific Wi-Fi APIs (nl80211 on Linux, `NEHotspotNetwork` on Apple platforms, WinRT on Windows) that no host implements yet.
- `watchNetwork` has **no Apple-platform backend**: `if-addrs`'s `IfChangeNotifier` doesn't exist on macOS/iOS/tvOS/watchOS/visionOS. This project doesn't build for those today, so it isn't handled — a future macOS/iOS target will need a different watch backend here.

## Notifications

Host-backed via the official [`@tauri-apps/plugin-notification`](https://v2.tauri.app/plugin/notification/).
Cross-platform: desktop (Windows/Linux/macOS) **and** mobile — unlike biometric/haptics/nfc below.

```js
let granted = await agapi.notifications.isPermissionGranted();
if (!granted) {
  granted = (await agapi.notifications.requestPermission()) === 'granted';
}
if (granted) {
  agapi.notifications.show({ title: 'agapi', body: 'hello' });
}

// Fires on tap / action-button interaction
const stop = await agapi.notifications.onAction((ev) => console.log(ev.notification, ev.actionId));
```

`show()` is **synchronous**, matching the underlying plugin (`sendNotification()` — a bad
options shape throws immediately, not via a rejected promise). `NotificationOptions` is
loosely typed (`title`/`body`/`channelId`/`icon`/`sound` + an index signature) — the real
plugin supports far more (attachments, scheduling, Android channels, iOS actions); ask for
that surface explicitly if a script needs it rather than assuming it's wired through.

## Biometric

Host-backed via the official [`@tauri-apps/plugin-biometric`](https://v2.tauri.app/plugin/biometric/).
**Mobile only (Android/iOS)** — the Rust crate isn't even compiled into desktop builds
(`src-tauri/Cargo.toml`'s `target.'cfg(android/ios)'.dependencies`), so `agapi.biometric` is
`undefined` on desktop hosts; calling it throws a clear "mobile-only" error, not a raw IPC failure.

```js
const status = await agapi.biometric.checkStatus();
// { isAvailable, biometryType: 'none'|'touchId'|'faceId'|'iris', error?, errorCode? }

if (status.isAvailable) {
  await agapi.biometric.authenticate("Confirm it's you");
  // rejects if the user cancels or authentication fails
}
```

`checkStatus()` exposes the full upstream `Status` shape (richer than a plain boolean) since
it's cheap to pass through honestly. One naming fix: the plugin's own `AuthOptions.maxAttemps`
has a typo — our `authenticate(reason, options)` spells it `maxAttempts` and maps it internally.

## Haptics

Host-backed via the official [`@tauri-apps/plugin-haptics`](https://v2.tauri.app/plugin/haptics/).
**Mobile only** for the host — same compiled-out-on-desktop story as biometric — but
`agapi.haptics` itself works everywhere: with no host, it falls back to `navigator.vibrate`
in any browser/webview that has one.

```js
await agapi.haptics.impact('medium');       // 'light'|'medium'|'heavy'|'soft'|'rigid'
await agapi.haptics.notification('success'); // 'success'|'warning'|'error'
await agapi.haptics.selection();
await agapi.haptics.vibrate(200);            // ms
```

Per the plugin's own docs: "There are no standards/requirements for vibration support on
Android, so the feedback APIs may not work correctly on more affordable phones." Not our bug.

## NFC

Host-backed via the official [`@tauri-apps/plugin-nfc`](https://v2.tauri.app/plugin/nfc/).
**Mobile only (Android/iOS)** — same compiled-out-on-desktop story as biometric/haptics.

```js
if (await agapi.nfc.isAvailable()) {
  const tag = await agapi.nfc.scan({ type: 'ndef' });
  console.log(tag.id, tag.records);

  await agapi.nfc.write([agapi.nfc.uriRecord('https://tauri.app')], {
    kind: { type: 'ndef' },
  });
}
```

`scanType`/`options`/records are loosely typed (`any`) on purpose — the upstream type tree
(`ScanKind` union, `TechKind` enum, `NFCRecord`) is fairly deep and not worth re-declaring in
full for a stdlib facade this thin. `textRecord()`/`uriRecord()` are pure data-shaping helpers
(URI protocol-table encoding, no IPC) passed straight through the host rather than
reimplemented, so upstream fixes/updates don't need manual porting.

## HTTPS client options (CF.request / agapi.http)

Backed by the official [`@tauri-apps/plugin-http`](https://v2.tauri.app/reference/javascript/http/)
— no custom Rust HTTP client. `host-tauri`'s Node-shaped `http.request()` calls the
plugin's `fetch()` under the hood and adapts the `Response` back into a Node-ish
`IncomingMessage`. `rejectUnauthorized` on the JS side maps to the plugin's
`danger` (`ClientOptions`) underneath. Defaults match local CF gear (relaxed
verification — no SNI override; unlike `agapi.tls.connect`, this client has no
per-request SNI option, since the official plugin doesn't have one).

| Option | Meaning |
|--------|---------|
| `rejectUnauthorized: false` | **default** — accept invalid cert + hostname |
| `rejectUnauthorized: true` | Verify cert against webpki roots + hostname |
| `insecure: true` | Alias → `rejectUnauthorized: false` |
| `connectTimeout` | ms, bounds the TCP+TLS connect phase |
| `maxRedirections` | `0` disables redirects |
| `proxy` | `{ all \| http \| https }`, each a URL or `{ url, basicAuth?, noProxy? }` |

```js
// Local IP, skip cert verification (default)
agapi.http.request({
  url: 'https://192.168.1.174:1843/xml/device_description.xml',
  method: 'GET',
  rejectUnauthorized: false,
}, (res) => { /* … */ }).end();

// CF.request options bag
CF.request('https://192.168.1.174:1843/xml/device_description.xml', {
  method: 'GET',
  rejectUnauthorized: false,
}, function (status, headers, body) {
  CF.log(status, body);
});
```

**Note:** `rejectUnauthorized: false` only disables **certificate verification**.  
It does **not** fix “cannot decrypt peer's message” (cipher / TLS version / broken device stack). That needs a legacy TLS backend or plain HTTP.

## WebSocket client (agapi.http.WebSocket)

Browser-compatible [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
(`readyState`, `onopen`/`onmessage`/`onerror`/`onclose`, `addEventListener`, `send`,
`close`, `binaryType`), backed by the official
[`@tauri-apps/plugin-websocket`](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/websocket).
Outbound only — it dials out to a remote server, same as the browser API. For
hosting a WebSocket *server* use `agapi.http.WebSocketServer` (unrelated, custom
axum-based; no official Tauri plugin does that).

```js
const ws = new agapi.http.WebSocket('wss://echo.example.com');
ws.binaryType = 'arraybuffer'; // default is 'blob', like real browsers
ws.onopen = () => ws.send('hello');
ws.onmessage = (ev) => console.log(ev.data);
ws.onclose = (ev) => console.log('closed', ev.code, ev.reason);
ws.onerror = (ev) => console.error('ws error', ev);
// ws.close(1000, 'done');
```

Known gaps vs. the real API: `protocol` always reads back as `''` (the plugin's
`connect()` only returns a connection id, not response headers, so the
negotiated subprotocol can't be observed) and `bufferedAmount` is always `0`
(no local write buffering — backpressure lives in the underlying Rust socket).
Incoming `Ping` frames are answered with `Pong` transparently, matching real
browsers (the plugin itself does not do this).

## Explicit non-goals (for now)

- Duplex streams / `pipe` / real `drain`
- `tls.createServer` / full `https` Agent
- `child_process`, `worker_threads`
- Full Node `Buffer` / encodings matrix
- Exact `err.errno` numbers per OS
- Client certs / custom CA files (can add later)
- Legacy TLS 1.0 / obsolete cipher suites (rustls limitation)

## CF usage

```js
// project script — classic (no import); agapi installed by shell
const s = agapi.net.connect(23, '192.168.1.10', () => {
  s.write('hello\r\n');
});
s.on('data', (buf) => {
  // agapi.Buffer
  CF.setJoin('s1', buf.toString('utf8'));
});
```
