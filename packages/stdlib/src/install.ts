import type { AgapiHost } from './host';
import { setHost } from './host';
import { net } from './net/manager';
import { dgram } from './dgram/index';
import http from './http/index';
import dns from './dns/index';
import tls from './tls/index';
import mdns from './mdns/index';
import { Buffer } from './buffer';
import { processShim } from './process';

/** Single runtime surface exposed as `globalThis.agapi` / `window.agapi`. */
export interface AgapiRuntime {
  net: typeof net;
  dgram: typeof dgram;
  http: typeof http;
  dns: typeof dns;
  tls: typeof tls;
  mdns: typeof mdns;
  Buffer: typeof Buffer;
  process: typeof processShim;
  /** Active host name (`tauri`, `mock`, …). */
  host: string;
  /** stdlib package version string. */
  version: string;
}

export interface InstallOptions {
  /**
   * Attach `target.agapi` for CF project scripts (classic non-module scripts).
   * Defaults to true.
   */
  globals?: boolean;
  /** Global object to attach to (default: globalThis). */
  target?: typeof globalThis;
}

const STDLIB_VERSION = '0.0.1';

// No replaceFetch/replaceWebSocket here: stdlib never overwrites browser
// globals. Tauri's own IPC (invoke()) sends commands via the page's global
// fetch() to a custom ipc:// protocol, so replacing fetch with agapi.http's
// (which itself calls invoke()) recurses forever and hangs every invoke()
// call. WebSocket replacement doesn't have that specific conflict, but for
// the same reason (don't touch what the host runtime relies on) it stays
// explicit: use `agapi.http.WebSocket` / `new agapi.http.WebSocket(url)`.

/**
 * Bind a platform host into stdlib and expose a single global: `window.agapi`.
 *
 * Project scripts (no ESM import) use e.g. `agapi.net.connect(...)`.
 * Application packages keep using `import { net } from '@agapi/stdlib'`.
 */
export function installStdlib(host: AgapiHost, options: InstallOptions = {}): void {
  setHost(host);
  net.setProvider(host.net);

  const target = options.target ?? globalThis;
  const useGlobals = options.globals !== false;
  if (useGlobals) {
    const runtime: AgapiRuntime = {
      net,
      dgram,
      http,
      dns,
      tls,
      mdns,
      Buffer,
      process: processShim,
      host: host.name,
      version: STDLIB_VERSION,
    };
    (target as any).agapi = runtime;
  }

  console.log(`[stdlib] installed host "${host.name}" → globalThis.agapi`);
}

export function uninstallStdlib(options: InstallOptions = {}): void {
  setHost(null);
  // leave mock provider as default on net — setProvider stays until next install
  const target = options.target ?? globalThis;
  if (options.globals !== false) {
    delete (target as any).agapi;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var agapi: AgapiRuntime | undefined;

  interface Window {
    agapi: AgapiRuntime;
  }
}

export {};
