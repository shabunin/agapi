## agapi

CommandFusion / iViewer-style GUI runtime (Pixi + Tauri).

### Architecture (see `docs/ARCHITECTURE.md`)

```
shell  →  @agapi/cf-loader  →  @agapi/stdlib  →  @agapi/host-tauri  →  Rust
```

Branch: `feat/stdlib-runtime`.

### Local

```bash
npm install
npm run dev          # browser (mock net)
npm run tauri:dev    # real sockets / http
```

