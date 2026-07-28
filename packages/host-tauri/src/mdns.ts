import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  MdnsBrowseEvent,
  MdnsBrowseHandle,
  MdnsHost,
  MdnsPublishHandle,
  MdnsPublishOptions,
  MdnsService,
} from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

interface WireService {
  name: string;
  serviceType: string;
  fullname: string;
  host: string;
  port: number;
  addresses: string[];
  txt: Record<string, string>;
}

interface WireEvent {
  id: string;
  event: string;
  serviceType?: string | null;
  fullname?: string | null;
  service?: WireService | null;
  error?: string | null;
}

function mapService(s: WireService): MdnsService {
  return {
    name: s.name,
    serviceType: s.serviceType,
    fullname: s.fullname,
    host: s.host,
    port: s.port,
    addresses: s.addresses ?? [],
    txt: s.txt ?? {},
  };
}

export class TauriMdnsHost implements MdnsHost {
  name = 'TauriMdnsHost';

  browse(serviceType: string, onEvent: (ev: MdnsBrowseEvent) => void): MdnsBrowseHandle {
    let browseId: string | null = null;
    let unlisten: UnlistenFn | null = null;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      const id = browseId;
      browseId = null;
      try {
        unlisten?.();
      } catch {
        /* ignore */
      }
      unlisten = null;
      if (id) {
        invoke('mdns_browse_stop', { browseId: id }).catch((err) => {
          console.warn('[mdns] browse stop:', err);
        });
      }
    };

    void (async () => {
      try {
        unlisten = await listen<WireEvent>('mdns-event', (event) => {
          const p = event.payload;
          if (!browseId || p.id !== browseId) return;

          const base = {
            serviceType: p.serviceType ?? undefined,
            fullname: p.fullname ?? undefined,
            service: p.service ? mapService(p.service) : undefined,
          };

          switch (p.event) {
            case 'started':
              onEvent({ type: 'started', ...base });
              break;
            case 'found':
              onEvent({ type: 'found', ...base });
              break;
            case 'resolved':
              onEvent({ type: 'resolved', ...base });
              break;
            case 'removed':
              onEvent({ type: 'removed', ...base });
              break;
            case 'stopped':
              onEvent({ type: 'stopped', ...base });
              break;
            case 'error':
              onEvent({
                type: 'error',
                ...base,
                error: new Error(p.error || 'mdns error'),
              });
              break;
            default:
              break;
          }
        });

        if (stopped) {
          try {
            unlisten();
          } catch {
            /* ignore */
          }
          return;
        }

        // Generate the id here so events emitted before the invoke resolves
        // (the Rust browse thread starts immediately) are not dropped.
        browseId = crypto.randomUUID();
        await invoke<string>('mdns_browse_start', { serviceType, browseId });
        if (stopped) {
          stop();
        }
      } catch (err) {
        onEvent({
          type: 'error',
          error: mapHostError(err, { syscall: 'mdns_browse' }),
        });
      }
    })();

    return { stop };
  }

  async publish(options: MdnsPublishOptions): Promise<MdnsPublishHandle> {
    try {
      const id = await invoke<string>('mdns_publish', {
        serviceType: options.type,
        instanceName: options.name,
        port: options.port,
        txt: options.txt ?? null,
      });
      return {
        id,
        stop: async () => {
          try {
            await invoke('mdns_unpublish', { publishId: id });
          } catch (err) {
            throw mapHostError(err, { syscall: 'mdns_unpublish' });
          }
        },
      };
    } catch (err) {
      throw mapHostError(err, { syscall: 'mdns_publish' });
    }
  }
}

export function createMdnsHost(): MdnsHost {
  return new TauriMdnsHost();
}
