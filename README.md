## agapi

CommandFusion / iViewer-style GUI runtime (Pixi + Tauri).

### Architecture (see `docs/ARCHITECTURE.md`)

```
shell / gallery / drivers
            │
     window.agapi.*     ← installStdlib(host)
            │
     @agapi/stdlib      ← Node-shaped + platform façades
            │
     @agapi/host-tauri  ← Tauri invoke / listen
            │
     OS / browser / Rust plugins
```

**Drivers** are sibling packages (`@agapi/matterjs`, `@agapi/sonos`, …).  
They use **only** `@agapi/stdlib` (`agapi.dgram`, `agapi.http`, `agapi.fs`, …) — never `@tauri-apps/*` or CF/Pixi inside the protocol core.

### Branch model (drivers)

| Branch | Role |
|--------|------|
| **`main`** | Stable app + stdlib. Drivers land here only when an admin merges the integration branch. |
| **`feat/agapi-drivers`** | **Integration** — all current drivers + gallery labs in one working tree. Day-to-day checkout for driver work. |
| **`feat/agapi-drivers-<name>`** | Short-lived feature / new-driver branch. Open a PR **into `feat/agapi-drivers`**, not into `main`. |

```
feat/agapi-drivers-foo  ─┐
feat/agapi-drivers-bar  ─┼─►  feat/agapi-drivers  ──(admin)──►  main
```

```bash
git checkout feat/agapi-drivers
git pull
git submodule update --init   # matter.js vendor (if missing)
npm install
npm run tauri:dev             # real LAN: Matter, Sonos, sockets, …
```

Browser-only: `npm run dev` (mock host — discovery/control that need real sockets will not work fully).

---

### How to add a new driver

Use existing packages as templates:

| Package | Pattern |
|---------|---------|
| [`packages/sonos`](packages/sonos) | Thin UPnP protocol core + agapi transports + gallery tool + optional `dev/` tsx harness |
| [`packages/matterjs`](packages/matterjs) | Heavier vendor/lib + lazy-loaded gallery tool |

#### 1. Branch from integration

```bash
git checkout feat/agapi-drivers
git pull
git checkout -b feat/agapi-drivers-<short-name>   # e.g. feat/agapi-drivers-denon
```

#### 2. Scaffold the package

```text
packages/<name>/
  package.json          # name: "@agapi/<name>"
  src/
    index.ts            # public exports
    protocol/           # transport-agnostic core (preferred)
    agapi-transport.ts  # glue: agapi.dgram / agapi.http / …
  dev/                  # optional: node:dgram + fetch for tsx without Tauri
```

Minimal `packages/<name>/package.json`:

```json
{
  "name": "@agapi/<name>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "files": ["src"],
  "dependencies": {
    "@agapi/stdlib": "0.0.1"
  }
}
```

Wire the monorepo:

1. **Root `package.json`** — add dependency `"@agapi/<name>": "0.0.1"`.
2. **Root `tsconfig.json`** — path aliases:

```json
"@agapi/<name>": ["packages/<name>/src/index.ts"],
"@agapi/<name>/*": ["packages/<name>/src/*"]
```

3. `npm install` (refreshes workspaces / lockfile).

#### 3. Design rules (non-negotiable)

1. **Protocol core is transport-agnostic** — pure TS over small seams (`post`/`get`, UDP socket). No `import` from `@tauri-apps/*`, CF, or Pixi in `src/protocol/`.
2. **Agapi glue in the package** — `createAgapi*Transport()` using `@agapi/stdlib` (same idea as Sonos).
3. **Node/dev optional** — `dev/` with `tsx` against real gear without launching Tauri (Sonos pattern). Speeds up protocol work a lot.
4. **Gallery is the lab, not the public API** — interactive proof + code snippets; ship a clear package surface from `src/index.ts`.
5. **Heavy deps → lazy-load the gallery tool** — Matter (~2MB) uses `React.lazy`. Sonos is small and static-imported. Follow size, not dogma.
6. **Do not put brand protocols in `@agapi/stdlib`** — stdlib is transport + platform only.

#### 4. Register the gallery tool

| File | What to add |
|------|-------------|
| `src/apps/gallery/types.ts` | `GalleryToolId` union member, e.g. `\| '<name>'` |
| `src/apps/gallery/catalog.ts` | entry in group `'drivers'` (title, blurb, surface, status, accent) |
| `src/apps/gallery/GalleryApp.tsx` | icon + render branch (`if (tool === '<name>') …`) |
| `src/apps/gallery/tools/<Name>Tool.tsx` | the lab UI |
| `src/apps/gallery/examples.ts` | `ExampleToolId` + snippets (document the real API) |

Status badges: `live` / `lab` / `stub` / `info` — new drivers usually start as **`lab`**.

#### 5. Verify

```bash
npm run lint    # tsc --noEmit
npm run build
# preferred: live check against real hardware
npm run tauri:dev
# optional node harness, if you added one:
# npx tsx packages/<name>/dev/….ts
```

#### 6. PR into integration (not main)

```bash
git push -u origin HEAD
# Open PR: base = feat/agapi-drivers, compare = your branch
```

After merge, delete the feature branch. **Do not** open driver PRs against `main` unless an admin asks.

Admin path to production: **`feat/agapi-drivers` → `main`** when the driver set is ready.

---

### Current drivers on this branch

| Package | Gallery | Notes |
|---------|---------|--------|
| `@agapi/matterjs` | Drivers → Matter | mDNS discovery, commissioning, device control; lazy-loaded |
| `@agapi/sonos` | Drivers → Sonos | SSDP + SOAP + ContentDirectory + GENA events; `dev/` harness |

---

### Docs

- [Architecture](docs/ARCHITECTURE.md) — layers; device APIs in **stdlib/host**, not cf-runtime  
- [stdlib COMPAT](docs/COMPAT.md)  
- [stdlib roadmap](docs/STDLIB_ROADMAP.md) — transport, platform APIs, gallery, driver notes  

### Scripts

```bash
npm install
npm run dev          # browser (mock net)
npm run tauri:dev    # real sockets / http / drivers
npm run lint
npm run build
```
