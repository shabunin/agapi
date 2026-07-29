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
| [`packages/driver-template`](packages/driver-template) | **Start here** — `SimpleDevice` (power on/off/?) + agapi/node TCP seams + mock-server |
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
3. **Node/dev harness** — `dev/node-transport.ts` + small CLI scripts; same seams over `node:dgram` / `fetch` / `node:http` so you can hit real gear with `tsx` without Tauri.
4. **Gallery is the lab, not the public API** — interactive proof + code snippets; ship a clear package surface from `src/index.ts`.
5. **Heavy deps → lazy-load the gallery tool** — Matter (~2MB) uses `React.lazy`. Sonos is small and static-imported. Follow size, not dogma.
6. **Do not put brand protocols in `@agapi/stdlib`** — stdlib is transport + platform only.

#### 3b. Transport-agnostic layout (Sonos pattern — copy this)

The whole point: **protocol code never knows** whether it runs under Tauri (`agapi.*`) or under plain Node. You define thin **seams** (interfaces), implement them twice, inject at the edge.

```text
packages/<name>/
  src/
    protocol/                 # ZERO imports of agapi / node / tauri / CF
      client.ts               # Device class takes SoapTransport in constructor
      discovery.ts            # discover(socket: DiscoverySocket, …)
      soap.ts / ssdp.ts / …   # pure encoding / parsing
    agapi-transport.ts        # createAgapiSoapTransport(), createAgapiDiscoverySocket()
    index.ts                  # public API: core + agapi helpers (what the app imports)
  dev/
    node-transport.ts         # createNodeSoapTransport(), createNodeDiscoverySocket()
    discover.ts               # CLI: tsx …  (uses NODE transport)
    control.ts                # CLI: tsx … <ip> play|state|…
```

**Layer diagram**

```text
  gallery / CF script / tauri:dev          dev/control.ts (tsx, no Tauri)
            │                                         │
            ▼                                         ▼
   createAgapiSoapTransport()              createNodeSoapTransport()
   createAgapiDiscoverySocket()            createNodeDiscoverySocket()
            │                                         │
            │         same interfaces                 │
            └────────────────┬────────────────────────┘
                             ▼
                    src/protocol/*  (SonosDevice, discover, …)
                             │
                    real speaker on the LAN
```

**Step A — invent seams in `protocol/` (not implementations)**

Only shapes the core needs. Example from Sonos (`packages/sonos/src/protocol/client.ts`):

```ts
// HTTP for SOAP — no fetch, no agapi.http here
export interface SoapTransport {
  post(url: string, soapAction: string, body: string): Promise<{ status: number; body: string }>;
  get(url: string): Promise<{ status: number; body: string }>;
}

export class SonosDevice {
  constructor(
    public readonly address: string,
    private readonly transport: SoapTransport,  // injected
  ) {}

  play() {
    return this.call(/* … uses this.transport.post … */);
  }
}
```

UDP discovery seam (same idea):

```ts
export interface DiscoverySocket {
  send(data: Uint8Array, port: number, address: string): void;
  onMessage(cb: (msg: Uint8Array, rinfo: { address: string }) => void): void;
  close(): void;
}

export async function discover(socket: DiscoverySocket, …): Promise<…> { /* SSDP only */ }
```

Rules for seams:

- Return plain data (`{ status, body }`, `Uint8Array`) — not Node streams or Tauri types.
- Prefer **resolve on HTTP 4xx/5xx** when the protocol puts errors in the body (UPnP SOAP faults).
- Keep methods small: `post` / `get` / `send` / `onMessage`. If you need headers (GENA `SID`), extend the result type once for both backends.

**Step B — `src/agapi-transport.ts` (production / gallery)**

Implements the same interfaces with `@agapi/stdlib`:

```ts
import { dgram, http } from '@agapi/stdlib';
import type { SoapTransport } from './protocol/client.js';

export function createAgapiSoapTransport(): SoapTransport {
  return {
    post: (url, soapAction, body) => /* http.request({ url, method: 'POST', headers: { SOAPACTION: … } }) */,
    get: (url) => /* http.request({ url, method: 'GET' }) */,
  };
}

export function createAgapiDiscoverySocket(): Promise<DiscoverySocket> {
  // dgram.createSocket('udp4') → adapt to DiscoverySocket { send, onMessage, close }
}
```

Export these from `src/index.ts` so the app does:

```ts
import { SonosDevice, createAgapiSoapTransport, discoverSonos } from '@agapi/sonos';

const device = new SonosDevice('192.168.1.50', createAgapiSoapTransport());
await device.play();
```

**Step C — `dev/node-transport.ts` (fast loop, no Tauri)**

Same interfaces, Node builtins / global `fetch`:

```ts
import { createSocket } from 'node:dgram';
import type { SoapTransport } from '../src/protocol/client.js';

export function createNodeSoapTransport(): SoapTransport {
  return {
    post: async (url, soapAction, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPACTION: `"${soapAction}"`,
        },
        body,
      });
      return { status: res.status, body: await res.text() };
    },
    get: async (url) => {
      const res = await fetch(url);
      return { status: res.status, body: await res.text() };
    },
  };
}
```

**Step D — tiny CLI scripts in `dev/` that only use the node transport**

```ts
// packages/<name>/dev/control.ts
import { SonosDevice } from '../src/protocol/client.js';
import { createNodeSoapTransport } from './node-transport.js';

const device = new SonosDevice(process.argv[2], createNodeSoapTransport());
await device.play();
```

Do **not** put `node-transport` in the package public export — gallery/app should use agapi only. `dev/` is for humans and CI smoke.

**Checklist: is the core really independent?**

| Allowed in `src/protocol/` | Forbidden in `src/protocol/` |
|----------------------------|------------------------------|
| your seams + pure TS/XML/regex | `@agapi/stdlib`, `agapi.*` |
| | `node:dgram`, `node:http`, `fetch` (prefer seams) |
| | `@tauri-apps/*`, CF, Pixi, React |

`agapi-transport.ts` may import stdlib.  
`dev/node-transport.ts` may import `node:*` / `fetch`.  
`protocol/*` imports **neither**.

#### 3c. How to verify (order matters)

**1. Protocol + node harness first (fastest feedback)**  
Needs: device on LAN, machine on same network, no Tauri.

```bash
# discovery (SSDP / mDNS / whatever your protocol uses)
npx tsx packages/sonos/dev/discover.ts

# control by IP — skip discovery once you know the address
npx tsx packages/sonos/dev/control.ts 192.168.1.174 state
npx tsx packages/sonos/dev/control.ts 192.168.1.174 volume 25
npx tsx packages/sonos/dev/control.ts 192.168.1.174 play

# events / callback server (if you have one)
npx tsx packages/sonos/dev/events.ts 192.168.1.174
# then change volume on the speaker — NOTIFY should print here
```

If this fails, fix **protocol + node transport** — not the gallery.

**2. Typecheck / bundle**

```bash
npm run lint
npm run build
```

**3. Agapi path in the real app**

```bash
npm run tauri:dev
# Gallery → Drivers → your tool
# Discover / add-by-IP / same actions you already proved with tsx
```

Here bugs are usually: missing host install, firewall, wrong LAN IP for callbacks (GENA), or gallery wiring — not SOAP framing.

**4. Optional parity check**  
Same IP, same action, both stacks:

| Path | Command / UI |
|------|----------------|
| Node | `npx tsx packages/<name>/dev/control.ts <ip> state` |
| Agapi | gallery tool → refresh / Subscribe events |

Results should match. If node works and gallery does not, debug **agapi-transport** (or stdlib host), not `protocol/`.

**5. Browser `npm run dev`**  
Mock host: often **no** real multicast/HTTP server. Useful for UI layout only; do not treat it as protocol proof.

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
| `@agapi/driver-template` | Drivers → SimpleDevice | **Copy-paste starter**: line TCP `power on\|off\|?` (CRLF), `SimpleDevice` + agapi.net / node:net + mock-server |

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
