# @agapi/stdlib roadmap

Target: **Node-shaped APIs** for CF scripts, control protocols, and the **stdlib gallery** — not a full Node runtime.

Related: [COMPAT.md](./COMPAT.md) (behavior contract), [ARCHITECTURE.md](./ARCHITECTURE.md) (layers).

---

## Mission

| In scope | Out of scope |
|----------|----------------|
| TCP / UDP / HTTP / DNS / TLS façades | Full Node module matrix |
| Buffer, process, EventEmitter, SystemError | `child_process`, workers |
| Host-injectable backends (Tauri / mock) | Device drivers / Matter (separate packages) |
| `window.agapi.*` for classic project scripts | GUI / CF / Pixi |

```
gallery apps / drivers / CF scripts
            │
     window.agapi  /  import from '@agapi/stdlib'
            │
        @agapi/stdlib
            │
     host-tauri  /  mock
            │
          OS / Rust
```

---

## Status (baseline)

| Tier | Modules | Status |
|------|---------|--------|
| **T0** | `events`, `Buffer`, `process` (partial) | ✅ |
| **T1** | `net`, `dgram`, `http` (+ host) | ✅ happy-path |
| **T1+** | `dns.lookup`, `tls.connect` (client) | ✅ |
| **T2** | `stream` / backpressure / `drain` | ❌ |
| **T3** | `fs` subset | ❌ |
| **T4** | discovery (`mdns`), mobile, media | ❌ host + browser probes |

Globals after `installStdlib`: **`agapi.{net,dgram,http,dns,tls,Buffer,process,host,version}`**.

---

## Development principles

1. stdlib **never** imports `@tauri-apps/*`, CF, or Pixi.
2. One PR ≈ one module or one behavior; update **COMPAT.md** with surface changes.
3. Prefer fixing transport gaps (errors, timeouts, drain) over new modules “because Node has them”.
4. Protocols (Matter, AV brands) live in **`@agapi/drivers`** (or sibling packages), not stdlib.
5. Gallery apps validate features; they must not become the public API.

---

## Roadmap phases

### Phase A — Stabilize T1 / T1+ (current baseline)

**Goal:** reliable sockets for CF systems and gallery tools.

| Item | Notes |
|------|--------|
| Error `code` matrix | `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, … consistent across host |
| TCP `write` / `drain` (minimal) | stop silent buffer growth |
| TLS polish | timeouts, clearer cert errors, ALPN as needed |
| HTTP client timeouts / abort | gallery Postman + `CF.request` |
| Mock host parity | browser `npm run dev` stays useful |
| Smoke tests | unit on mock; optional Tauri loopback |

**Git:** `fix/stdlib-*`, `test/stdlib-*` — short-lived.

### Phase B — Gallery-driven verification

**Goal:** interactive proof for every shipped surface.

| Gallery tool | stdlib surface | Priority |
|--------------|----------------|----------|
| **Sockets (NC)** | `net` / `dgram` | ✅ exists → gallery entry |
| **TLS client** | `tls.connect` | next |
| **HTTP lab** (mini Postman) | `http.request` / `get` | next |
| **DNS** | `dns.lookup` | next |
| **mDNS** | future host capability | stub → implement |
| **Camera** | mobile / host API | stub |
| **Bluetooth** | mobile / host API | stub |
| **WebRTC** | browser + later host | info / capability page |
| **WebCodecs** | browser | info / capability page |

App entry: shell launcher → **Stdlib Gallery** (`src/apps/gallery/`).  
CF App stays a sibling product frontend, not inside the gallery.

### Phase C — Discovery & host extras

| Capability | Package surface (proposed) | Host work |
|------------|----------------------------|-----------|
| mDNS browse / advertise | `agapi.mdns` or host-only plugin | Rust/Bonjour/Avahi |
| Local network permissions | docs + gallery warnings | OS / mobile |
| Crypto subset | `agapi.crypto` (random, hash) | only when drivers need it |

Do **not** put Matter commissioning into stdlib; Matter may *use* mDNS + UDP + TCP from here.

### Phase D — Streams (T2) — only if needed

Implement minimal Duplex / `drain` if:

- third-party protocol code requires `.pipe()`, or  
- backpressure becomes a real production issue.

Otherwise keep framing in drivers (`data` → buffer → lines).

### Phase E — Filesystem (T3) — only if needed

Narrow host API: `readFile` / `writeFile` / `mkdir` for logs, cert cache, script config.  
Not a POSIX `fs` clone.

### Explicit non-goals (long horizon)

- `tls.createServer` / full HTTPS Agent  
- UDS / IPC paths  
- `require()` module loader  
- Exact Node `errno` numbers per OS  
- Full WebRTC stack inside stdlib (probe first; integrate later if product needs it)

---

## Stdlib gallery (product shape)

```
Launcher
├── CF App              → @agapi/cf-runtime
└── Stdlib Gallery      → React tools on @agapi/stdlib (+ browser probes)
    ├── Sockets (NC)    net / dgram          [live]
    ├── TLS client      tls                  [live / lab]
    ├── HTTP lab        http                 [live / lab]
    ├── DNS             dns                  [live / lab]
    ├── mDNS            (planned)            [stub]
    ├── Camera          (mobile)             [stub]
    ├── Bluetooth       (mobile)             [stub]
    ├── WebRTC          browser capabilities [info]
    └── WebCodecs       browser capabilities [info]
```

### Tool lifecycle

| Status | Meaning |
|--------|---------|
| `live` | Uses real stdlib host APIs (Tauri for full power) |
| `lab` | Works when host provides capability; degrades with clear errors on mock |
| `stub` | UI + roadmap text; no host API yet |
| `info` | Feature-detect browser / runtime; no I/O |

### Implementation map

| Path | Role |
|------|------|
| `src/apps/gallery/GalleryApp.tsx` | hub + tool router |
| `src/apps/gallery/tools/*` | one tool per feature |
| `src/apps/NcApp.tsx` | Sockets tool (shared; opened from gallery) |
| `docs/STDLIB_ROADMAP.md` | this file |

When a stub becomes live: implement host + stdlib façade first, then swap the gallery tool; update COMPAT + this roadmap.

---

## Suggested git branches

| Work | Branch |
|------|--------|
| TCP drain / errors | `fix/stdlib-tcp-backpressure` |
| Gallery hub + rehome NC | `feat/stdlib-gallery` (this work) |
| TLS / HTTP / DNS tools | can ship with gallery; polish via `feat/gallery-tls` etc. |
| mDNS host | `feat/stdlib-mdns` + `feat/host-tauri-mdns` |
| Mobile camera/BT | `feat/host-mobile-*` then gallery live tools |

Do not mix stdlib host changes with CF GUI refactors in one PR.

---

## Success criteria

- [ ] Every **live** COMPAT surface has a gallery tool (or explicit reason not to).
- [ ] Mock browser still boots gallery without Tauri (tools show honest errors).
- [ ] Tauri path exercises net/dgram/http/dns/tls from gallery without CF project.
- [ ] New stdlib modules land with COMPAT row + gallery entry (`live` or `stub`).
- [ ] Drivers / Matter depend only on stable T1+ surfaces until Phase C/D justify more.

---

## Changelog of this doc

| Date | Note |
|------|------|
| 2026-07-26 | Initial roadmap + gallery plan (sockets → TLS → HTTP → DNS → mDNS → mobile/media stubs) |
