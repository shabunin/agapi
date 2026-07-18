import type { AgapiHost } from './host';
import { setHost } from './host';
import { net } from './net/manager';
import { dgram } from './dgram/index';
import http from './http/index';
import { installBufferGlobal } from './buffer';
import { installProcessGlobal } from './process';

export interface InstallOptions {
  /**
   * Attach Node-shaped globals for CF project scripts.
   * Defaults to true in browser/webview environments.
   */
  globals?: boolean;
  /** Also install global Buffer / process (default true when globals is true). */
  nodeGlobals?: boolean;
  /** Global object to attach to (default: globalThis). */
  target?: typeof globalThis;
}

/**
 * Bind a platform host into stdlib and optionally expose window.net/http/dgram.
 */
export function installStdlib(host: AgapiHost, options: InstallOptions = {}): void {
  setHost(host);
  net.setProvider(host.net);

  const target = options.target ?? globalThis;
  const useGlobals = options.globals !== false;
  if (useGlobals) {
    const g = target as any;
    g.net = net;
    g.dgram = dgram;
    g.http = http;
    g.__AGAPI_HOST__ = host.name;

    if (options.nodeGlobals !== false) {
      installBufferGlobal(target);
      installProcessGlobal(target);
    }
  }

  console.log(`[stdlib] installed host "${host.name}"`);
}

export function uninstallStdlib(options: InstallOptions = {}): void {
  setHost(null);
  // leave mock provider as default on net — setProvider stays until next install
  const g = (options.target ?? globalThis) as any;
  if (options.globals !== false) {
    delete g.net;
    delete g.dgram;
    delete g.http;
    delete g.__AGAPI_HOST__;
  }
}
