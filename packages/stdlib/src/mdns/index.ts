import { EventEmitter } from '../events';
import { getHost } from '../host';
import type {
  MdnsHost,
  MdnsService,
  MdnsBrowseHandle,
  MdnsPublishHandle,
  MdnsBrowseEvent,
  MdnsPublishOptions,
} from '../host';

export type { MdnsService, MdnsBrowseHandle, MdnsPublishHandle, MdnsBrowseEvent, MdnsPublishOptions };
export type { MdnsBrowseEventType } from '../host';

/**
 * Node-ish / CF-friendly mDNS façade.
 *
 * ```js
 * const b = agapi.mdns.browse('_http._tcp', (ev) => {
 *   if (ev.type === 'resolved') console.log(ev.service);
 * });
 * // later: b.stop();
 *
 * const p = await agapi.mdns.publish({
 *   type: '_agapi-demo._tcp',
 *   name: 'My Panel',
 *   port: 8080,
 *   txt: { path: '/' },
 * });
 * await p.stop();
 * ```
 */

export type MdnsBrowseCallback = (event: MdnsBrowseEvent) => void;

function requireMdnsHost(): MdnsHost {
  const host = getHost();
  if (!host?.mdns) {
    throw new Error(
      '@agapi/stdlib/mdns: no MdnsHost installed. Call installStdlib(createTauriHost()) in Tauri.'
    );
  }
  return host.mdns;
}

/**
 * Browse for DNS-SD services of the given type.
 * `serviceType` may be `_http._tcp` or `_http._tcp.local.`
 */
export function browse(serviceType: string, callback: MdnsBrowseCallback): MdnsBrowseHandle {
  if (typeof callback !== 'function') {
    throw new TypeError('mdns.browse requires a callback');
  }
  const host = requireMdnsHost();
  return host.browse(serviceType, callback);
}

/**
 * Advertise a service on the local network.
 */
export async function publish(options: MdnsPublishOptions): Promise<MdnsPublishHandle> {
  if (!options?.type || !options?.name || !options?.port) {
    throw new TypeError('mdns.publish requires type, name, and port');
  }
  const host = requireMdnsHost();
  return host.publish({
    type: options.type,
    name: options.name,
    port: options.port,
    txt: options.txt,
  });
}

/** EventEmitter helper that wraps browse. */
export class MdnsBrowser extends EventEmitter {
  private handle: MdnsBrowseHandle | null = null;

  start(serviceType: string): this {
    this.stop();
    this.handle = browse(serviceType, (ev) => {
      this.emit(ev.type, ev);
      this.emit('event', ev);
    });
    return this;
  }

  stop(): void {
    this.handle?.stop();
    this.handle = null;
  }
}

const mdns = {
  browse,
  publish,
  MdnsBrowser,
};

export default mdns;
