# agapi runtime architecture

```
application shell (React / menus / zip open)
        │
        ▼
cf-runtime  (@agapi/cf-runtime)  parseGUI, loadProject, CF.*, joins
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
| `@agapi/cf-runtime` | CF engine: parser, Pixi, CF API, systems (`loadProject`) |
| app (`/src`) | Launcher + thin frontends only |

### Apps vs packages

```
src/App.tsx              launcher (CF | NC)
src/apps/CfApp.tsx       thin shell: open zip/fs → loadProject()
src/apps/cf/openProject  asset loading helpers (shell only)
src/apps/NcApp.tsx       netcat UI on stdlib

packages/cf-runtime      all CF engine logic (no React)
```

## Bootstrap

```ts
import { installStdlib } from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

installStdlib(createTauriHost()); // sets window.net / dgram / http
```

## Rules

1. **stdlib** must not import `@tauri-apps/*`.
2. **host-tauri** must not import CF / Pixi / joins.
3. **cf-runtime** uses only `@agapi/stdlib/*` (+ pixi/gsap) — never `@tauri-apps/*`.
4. **application shell** prefers `@agapi/cf-runtime` + `@agapi/stdlib`; Tauri only in bootstrap.
5. Compat tiers: T0 events/process → T1 net/dgram/http → T2 streams → T3 fs.

## Compat tiers

See [COMPAT.md](./COMPAT.md) for T0/T1 Node-shaped API details (Buffer, errors, half-close).

## Branch

Work lives on `feat/stdlib-runtime`.
