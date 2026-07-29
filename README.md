## agapi

CommandFusion / iViewer-style GUI runtime (Pixi + Tauri).

### Architecture (see `docs/ARCHITECTURE.md`)

```
shell  →  @agapi/cf-runtime  →  @agapi/stdlib  →  @agapi/host-tauri  →  Rust
```

Branch: `feat/stdlib-runtime`.

### Docs

- [Architecture](docs/ARCHITECTURE.md) — layers; device APIs live in **agapi/host**, not cf-runtime
- [stdlib COMPAT](docs/COMPAT.md)
- [stdlib roadmap](docs/STDLIB_ROADMAP.md) — transport + platform (network status, sensors, fs, nfc, notify, bio, haptics) + **Stdlib Gallery**

### Local

```bash
npm install
npm run dev          # browser (mock net)
npm run tauri:dev    # real sockets / http
```

