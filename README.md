## agapi

CommandFusion / iViewer-style GUI runtime (Pixi + Tauri).

### Architecture (see `docs/ARCHITECTURE.md`)

```
shell  →  @agapi/cf-runtime  →  @agapi/stdlib  →  @agapi/host-tauri  →  Rust
```

Branch: `feat/stdlib-runtime`.

### Docs

- [Architecture](docs/ARCHITECTURE.md)
- [stdlib COMPAT](docs/COMPAT.md)
- [stdlib roadmap](docs/STDLIB_ROADMAP.md) (+ **Stdlib Gallery** app in the shell)

### Local

```bash
npm install
npm run dev          # browser (mock net)
npm run tauri:dev    # real sockets / http
```

