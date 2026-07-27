# agapi runtime architecture

```
application shell (React / menus / zip open / gallery)
        │
        ├──────────────────────┐
        ▼                      ▼
cf-runtime                 gallery / scripts / drivers
(@agapi/cf-runtime)        (use agapi.* directly)
parseGUI, CF.*, joins
        │                      │
        └──────────┬───────────┘
                   ▼
           stdlib-js  (@agapi/stdlib)
           net / dgram / http / dns / tls / mdns
           + planned: device / sensors / fs / nfc /
             notifications / biometric / haptics / crypto
                   │
                   ▼
           tauri-js   (@agapi/host-tauri)
           IPC adapters (no CF / Pixi)
                   │
                   ▼
           tauri-rust (src-tauri/plugins)
           OS sockets / http / mdns / device plugins …
```

## Packages

| Package | Role |
|---------|------|
| `@agapi/host-protocol` | Shared wire types (events, errors) — no UI/CF |
| `@agapi/stdlib` | Public API surface (`agapi.*`) + mock-friendly façades |
| `@agapi/host-tauri` | Tauri `invoke`/`listen` backends |
| `@agapi/cf-runtime` | CF engine only: parser, Pixi, CF API, systems — **consumes** stdlib |
| app (`/src`) | Launcher + CF shell + **Stdlib Gallery** |

### Apps vs packages

```
src/App.tsx                 launcher (CF | Gallery)
src/apps/CfApp.tsx          thin shell: open zip/fs → loadProject()
src/apps/cf/openProject     asset loading (shell only)
src/apps/gallery/           labs for stdlib + browser probes
src/apps/NcApp.tsx          sockets lab body

packages/cf-runtime         CF engine (no React, no device host IPC)
packages/stdlib             agapi public API
packages/host-tauri         host implementations
```

## Bootstrap

```ts
import { installStdlib } from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

installStdlib(createTauriHost());
// → globalThis.agapi.{net,dgram,http,dns,tls,mdns,Buffer,process,host,version}
// → later: device, sensors, fs, nfc, notifications, biometric, haptics, crypto
```

## Rules

1. **stdlib** must not import `@tauri-apps/*`, CF, or Pixi.
2. **host-tauri** must not import CF / Pixi / joins.
3. **cf-runtime** uses only `@agapi/stdlib/*` (+ pixi/gsap) — never `@tauri-apps/*` for networking or device.
4. **Platform device APIs** (network status, sensors, battery, brightness, NFC, FS, notifications, biometric, haptics) belong in **stdlib + host**, not cf-runtime. CF may wrap them later.
5. **application shell** prefers `@agapi/cf-runtime` + `@agapi/stdlib`; Tauri only in bootstrap.
6. Compat tiers: transport T0–T1++ → streams T2 → fs T3 → platform device T4. See [STDLIB_ROADMAP.md](./STDLIB_ROADMAP.md).

## Compat & roadmap

- [COMPAT.md](./COMPAT.md) — Node-shaped / HTTPS options / mDNS behavior  
- [STDLIB_ROADMAP.md](./STDLIB_ROADMAP.md) — tiers, platform plan, gallery map, PR order  

## Branch

Work lives on `feat/stdlib-runtime` (until merged).
