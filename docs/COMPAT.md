# Node.js compatibility (stdlib T0 / T1)

Target: **Node-shaped APIs** for CF scripts and control protocols — not a full Node runtime.

## Tiers

| Tier | Modules | Status |
|------|---------|--------|
| **T0** | `events`, `Buffer`, `process` (partial) | ✅ shipped |
| **T1** | `net`, `dgram`, `http` (+ host) | ✅ happy-path + polish |
| **T2** | `stream` / backpressure | ❌ not yet |
| **T3** | `fs`, `dns` module | ❌ not yet |

## Globals (after `installStdlib`)

| Global | Notes |
|--------|--------|
| `net` | TCP client/server |
| `dgram` | UDP |
| `http` | createServer / request / get / WebSocketServer |
| `Buffer` | minimal subset (from/alloc/concat/toString) |
| `process` | `env`, `platform`, `nextTick`, `cwd()` stub |

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

## Explicit non-goals (for now)

- Duplex streams / `pipe` / real `drain`
- `tls` / `https` server as first-class
- `child_process`, `worker_threads`
- Full Node `Buffer` / encodings matrix
- Exact `err.errno` numbers per OS

## CF usage

```js
// project script — globals already installed by agapi shell
const s = net.connect(23, '192.168.1.10', () => {
  s.write('hello\r\n');
});
s.on('data', (buf) => {
  // Buffer
  CF.setJoin('s1', buf.toString('utf8'));
});
```
