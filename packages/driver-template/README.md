# @agapi/driver-template

Copy-paste starting point for a line-oriented TCP driver. `SimpleDevice`
(`power on|off|?` over CRLF) is a stand-in — replace the protocol, keep the
shape. See [`docs/DRIVERS.md`](../../docs/DRIVERS.md) for the full driver
pattern this follows (why `src/protocol/` stays transport-agnostic,
verification order, etc.); this file is just the mechanical checklist for
renaming.

## Copying this package

1. `cp -r packages/driver-template packages/<name>`
2. `packages/<name>/package.json` — `name`, `description`
3. Root `package.json` — add `"@agapi/<name>": "0.0.1"` to `dependencies`
4. `tsconfig.json` — add `@agapi/<name>` + `@agapi/<name>/*` paths (copy the
   `driver-template` block)
5. `src/protocol/client.ts` — rename `SimpleDevice`, replace the wire
   protocol (framing/timeouts/reconnect logic below can usually stay as-is)
6. `dev/mock-server.ts`, `dev/control.ts` — update to the new commands
7. Gallery wiring — `src/apps/gallery/types.ts`, `catalog.ts`,
   `GalleryApp.tsx`, `examples.ts`, `tools/<Name>Tool.tsx` (see
   `docs/DRIVERS.md` §4 for the exact table)
8. `npm run lint && npm run build`, then smoke-test with `dev/mock-server.ts`
   before touching real hardware

## What `SimpleDevice` already handles for you

Line-oriented TCP has a handful of sharp edges that are easy to get wrong
the first time and annoying to debug on real hardware. This template's
`protocol/client.ts` + `protocol/framing.ts` handle them so a copy starts
correct:

- **Partial / merged chunks** — `LineBuffer` buffers across `onData` calls;
  a reply is never assumed to arrive in one TCP segment.
- **Multi-byte chars split across chunks** — one `TextDecoder` per
  connection with `{ stream: true }`, not a fresh decoder per chunk.
- **Unterminated stream** — `LineBuffer` caps at 64KB and errors out instead
  of buffering forever if a device never sends a line terminator.
- **Timeout → reply desync** — if a request times out, the device's reply
  still shows up on the wire later. It's discarded instead of being handed
  to the *next* request as if it were the answer.
- **Concurrent `connect()`** — multiple callers before the first completes
  share one in-flight attempt instead of opening N sockets.

If your protocol needs command queueing (only one in-flight request at a
time) or unsolicited/event lines from the device, add that in your copy —
this template intentionally stays single-request-at-a-time and drops
unsolicited lines, since not every driver needs more than that.

## Layout

```
src/protocol/            transport-agnostic core (SimpleDevice + seams)
src/agapi-transport.ts   agapi.net glue for the app
dev/node-transport.ts    node:net glue for tsx without Tauri
dev/mock-server.ts       fake device so you can demo offline
dev/control.ts           CLI: power on|off|?
```
