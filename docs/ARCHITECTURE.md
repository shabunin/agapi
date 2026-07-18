# agapi runtime architecture

```
application shell (React / menus / zip open)
        │
        ▼
cf-loader  (@agapi/cf-loader)  parseGUI, loadProject, CF.*, joins
        │
        ▼
stdlib-js  (@agapi/stdlib)     net / dgram / http / events
        │
        ▼
tauri-js   (@agapi/host-tauri)  IPC adapters, handle maps
        │
        ▼
tauri-rust (src-tauri/plugins)  real OS sockets / http
```

## Packages

| Package | Role |
|---------|------|
| `@agapi/host-protocol` | Shared wire types (events, errors) — no UI/CF |
| `@agapi/stdlib` | Node-shaped public API + mock provider |
| `@agapi/host-tauri` | Tauri `invoke`/`listen` backends |
| `@agapi/cf-loader` | CF/iViewer runtime: parser, Pixi renderer, CF API, systems |
| app (`/src`) | Tauri shell UI (open zip, menus, window) — not CF logic |

## Bootstrap

```ts
import { installStdlib } from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

installStdlib(createTauriHost()); // sets window.net / dgram / http
```

## Rules

1. **stdlib** must not import `@tauri-apps/*`.
2. **host-tauri** must not import CF / Pixi / joins.
3. **cf-loader** uses only `@agapi/stdlib/*` (+ pixi/gsap) — never `@tauri-apps/*`.
4. **application shell** prefers `@agapi/cf-loader` + `@agapi/stdlib`; Tauri only in bootstrap.
5. Compat tiers: T0 events/process → T1 net/dgram/http → T2 streams → T3 fs.

## Branch

Work lives on `feat/stdlib-runtime`.
