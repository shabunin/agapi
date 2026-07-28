import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { DeviceHost, NetworkStatus, NetworkWatchHandle } from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

interface NetworkStatusWire {
  hasNetwork: boolean;
  networkType: string;
  addresses: {
    address: string;
    family: string;
    interface: string;
    netmask: string;
  }[];
}

interface NetworkWatchEventWire {
  id: string;
  status: NetworkStatusWire;
}

function mapStatus(w: NetworkStatusWire): NetworkStatus {
  return {
    hasNetwork: w.hasNetwork,
    networkType: w.networkType as NetworkStatus['networkType'],
    addresses: w.addresses.map((a) => ({
      address: a.address,
      family: a.family as 'IPv4' | 'IPv6',
      interface: a.interface,
      netmask: a.netmask,
    })),
  };
}

export class TauriDeviceHost implements DeviceHost {
  name = 'TauriDeviceHost';

  async getNetworkStatus(): Promise<NetworkStatus> {
    try {
      const w = await invoke<NetworkStatusWire>('device_network_status');
      return mapStatus(w);
    } catch (err) {
      throw mapHostError(err, { syscall: 'getNetworkStatus' });
    }
  }

  async watchNetwork(onChange: (status: NetworkStatus) => void): Promise<NetworkWatchHandle> {
    // Listener registered before the start invoke resolves (before the
    // watch thread even spawns), so no event can arrive before we're
    // listening — the id is ours to pick, not something we wait to learn
    // back from Rust.
    const id = crypto.randomUUID();
    let unlisten: UnlistenFn | null = null;
    let stopped = false;

    unlisten = await listen<NetworkWatchEventWire>('plugin:device:network', (event) => {
      if (event.payload.id !== id) return;
      onChange(mapStatus(event.payload.status));
    });

    try {
      await invoke('device_watch_network_start', { watchId: id });
    } catch (err) {
      unlisten();
      throw mapHostError(err, { syscall: 'watchNetwork' });
    }

    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        unlisten?.();
      } catch {
        /* ignore */
      }
      invoke('device_watch_network_stop', { id }).catch((err) => {
        console.warn('[device] watch stop:', err);
      });
    };

    return { stop };
  }
}

export function createDeviceHost(): DeviceHost {
  return new TauriDeviceHost();
}
