# agapi runtime architecture

```
application (cf-loader, shell UI, CF scripts)
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
| app (`/src`) | Shell + CF runtime (temporary; cf-loader extract later) |

## Bootstrap

```ts
import { installStdlib } from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

installStdlib(createTauriHost()); // sets window.net / dgram / http
```

## Rules

1. **stdlib** must not import `@tauri-apps/*`.
2. **host-tauri** must not import CF / Pixi / joins.
3. **application** prefers `@agapi/stdlib/*`; Tauri only in shell bootstrap.
4. Compat tiers: T0 events/process → T1 net/dgram/http → T2 streams → T3 fs.

## Branch

Work lives on `feat/stdlib-runtime`.
