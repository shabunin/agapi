## agapi

CommandFusion / iViewer-style GUI runtime for AV control systems — Pixi rendering + Tauri host, a standard-library layer (`agapi.*`) shared by everything above it, and a growing set of device drivers.

```
              application shell (React)
                  │              │
                  ▼              ▼
       @agapi/cf-runtime   gallery · scripts · drivers
       CF parser, Pixi,    @agapi/matterjs, @agapi/sonos,
       joins, systems      @agapi/driver-template, …
                  │              │
                  └──────┬───────┘
                         ▼
                 @agapi/stdlib
        net · dgram · http · dns · tls · mdns · fs
        device · notifications · biometric · haptics · nfc
                         │
                         ▼
               @agapi/host-tauri
              Tauri invoke / listen (no CF, no Pixi)
                         │
                         ▼
                 src-tauri (Rust)
          OS sockets, mDNS, device plugins — desktop + Android
```

Every layer below the shell talks through `agapi.*`, installed once at boot:

```ts
import { installStdlib } from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

installStdlib(createTauriHost());
// → globalThis.agapi.{net, dgram, http, dns, tls, mdns, fs,
//                     device, notifications, biometric, haptics, nfc, ...}
```

Drivers (`@agapi/matterjs`, `@agapi/sonos`, `@agapi/driver-template`, …) are sibling packages that use **only** `agapi.*` — never `@tauri-apps/*` or CF/Pixi in their protocol core. See [`docs/DRIVERS.md`](docs/DRIVERS.md) for the pattern and how to add one.

### Packages

| Package | Role |
|---------|------|
| [`@agapi/host-protocol`](packages/host-protocol) | Shared wire types (events, errors) — no UI, no CF |
| [`@agapi/stdlib`](packages/stdlib) | Public `agapi.*` surface + mock-friendly façades |
| [`@agapi/host-tauri`](packages/host-tauri) | Tauri `invoke`/`listen` backends for stdlib |
| [`@agapi/cf-runtime`](packages/cf-runtime) | CF engine: parser, Pixi renderer, joins, systems — consumes stdlib only |
| [`@agapi/matterjs`](packages/matterjs) | Matter driver — mDNS discovery, commissioning, device control |
| [`@agapi/sonos`](packages/sonos) | Sonos driver — SSDP, SOAP, ContentDirectory, GENA events |
| [`@agapi/driver-template`](packages/driver-template) | Copy-paste starter for a new line-oriented TCP driver |
| `/src` | App shell: launcher, CF app, **Stdlib Gallery** |

### Stdlib Gallery

Interactive labs for every `agapi.*` module and every driver, grouped as: **network** (sockets, TLS, HTTP, WebSocket, DNS, mDNS), **device** (network status, OS info, sensors, haptics, notifications, filesystem, NFC, biometrics, Bluetooth), **browser** (WebRTC, WebCodecs, Crypto, Web Animations, gestures — probes, not stdlib), and **drivers** (Matter, Sonos, SimpleDevice). Each lab pairs a working UI with the real code snippet it's calling — the gallery is meant to be read, not just clicked.

### Quickstart

```bash
npm install
npm run dev          # browser — mock net/http backends, UI-only
npm run tauri:dev     # real sockets / mDNS / drivers, desktop
```

`packages/matterjs/vendor/matter.js` is a git submodule — if it's empty:

```bash
git submodule update --init
```

### Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Vite dev server, browser, mock host |
| `npm run tauri:dev` | Tauri desktop app, real host |
| `npm run lint` | `tsc --noEmit` across the workspace |
| `npm run build` | Vite production build |
| `npm run tauri:build` | Desktop bundle |
| `npm run build:android` / `android:debug` | Android APK build / build+install |

### Docs

- [Architecture](docs/ARCHITECTURE.md) — layers in full, bootstrap sequence, apps vs packages
- [Drivers](docs/DRIVERS.md) — branch model, transport-agnostic seam pattern, how to add a driver
- [stdlib COMPAT](docs/COMPAT.md) — Node-shaped API surface and what's actually implemented
- [stdlib roadmap](docs/STDLIB_ROADMAP.md) — module status by tier (T0–T4b)
