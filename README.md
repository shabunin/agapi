## agapi

CommandFusion / iViewer-style GUI runtime (Pixi + Tauri).

### Architecture (see `docs/ARCHITECTURE.md`)

```
application  →  @agapi/stdlib  →  @agapi/host-tauri  →  Rust plugins
```

Work in progress on branch `feat/stdlib-runtime`.

### Local

```bash
npm install
npm run dev          # browser (mock net)
npm run tauri:dev    # real sockets / http
```

