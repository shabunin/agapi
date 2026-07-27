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
  /**
   * Replace `target.fetch` with the host's implementation (e.g. Tauri's
   * cert/proxy/timeout-capable fetch). No-op with a warning if the host
   * doesn't provide one (e.g. the browser mock host). Default: false.
   */
  replaceFetch?: boolean;
  /**
   * Replace `target.WebSocket` with the host's implementation. No-op with
   * a warning if the host doesn't provide one. Default: false.
   */
  replaceWebSocket?: boolean;
}

const STDLIB_VERSION = '0.0.1';

// Saved so uninstallStdlib() can put the real globals back.
let savedFetch: typeof fetch | undefined;
let savedWebSocket: typeof WebSocket | undefined;

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

  if (options.replaceFetch) {
    if (host.http?.fetch) {
      savedFetch = savedFetch ?? target.fetch;
      (target as any).fetch = host.http.fetch;
    } else {
      console.warn(`[stdlib] replaceFetch requested but host "${host.name}" has no http.fetch`);
    }
  }

  if (options.replaceWebSocket) {
    if (host.http?.WebSocket) {
      savedWebSocket = savedWebSocket ?? target.WebSocket;
      (target as any).WebSocket = host.http.WebSocket;
    } else {
      console.warn(`[stdlib] replaceWebSocket requested but host "${host.name}" has no http.WebSocket`);
    }
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
  if (savedFetch) {
    (target as any).fetch = savedFetch;
    savedFetch = undefined;
  }
  if (savedWebSocket) {
    (target as any).WebSocket = savedWebSocket;
    savedWebSocket = undefined;
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
