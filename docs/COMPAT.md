# Node.js compatibility (stdlib T0 / T1)

Target: **Node-shaped APIs** for CF scripts and control protocols — not a full Node runtime.

## Tiers

| Tier | Modules | Status |
|------|---------|--------|
| **T0** | `events`, `Buffer`, `process` (partial) | ✅ shipped |
| **T1** | `net`, `dgram`, `http` (+ host) | ✅ happy-path + polish |
| **T1+** | `dns.lookup`, `tls.connect` (client) | ✅ |
| **T2** | `stream` / backpressure | ❌ not yet |
| **T3** | `fs` subset | ❌ not yet |

## Globals (after `installStdlib`)

Single namespace: **`window.agapi`** / **`globalThis.agapi`** (no top-level `window.net`, etc.).

| Path | Notes |
|------|--------|
| `agapi.net` | TCP client/server |
| `agapi.dgram` | UDP |
| `agapi.http` | createServer / request / get / WebSocketServer |
| `agapi.dns` | `lookup` / `lookupAsync` |
| `agapi.tls` | `connect` (client only) |
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

## Explicit non-goals (for now)

- Duplex streams / `pipe` / real `drain`
- `tls.createServer` / full `https` Agent
- `child_process`, `worker_threads`
- Full Node `Buffer` / encodings matrix
- Exact `err.errno` numbers per OS
- Client certs / custom CA files (can add later)

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
