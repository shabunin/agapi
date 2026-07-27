import { getHost } from '../host';
import type { NetworkStatus, NetworkWatchHandle } from '../host';
import { mapHostError } from '../errors';

export type { NetworkAddress, NetworkStatus, NetworkWatchHandle } from '../host';

/**
 * Network status snapshot: `hasNetwork`, best-effort `networkType`
 * ('wifi' | 'ethernet' | 'other' | 'none'), and local `addresses`.
 *
 * ```js
 * const status = await agapi.device.getNetworkStatus();
 * if (status.hasNetwork) console.log(status.networkType, status.addresses);
 * ```
 */
export function getNetworkStatus(): Promise<NetworkStatus> {
  const host = getHost();
  if (!host?.device) {
    return Promise.reject(
      mapHostError(
        '@agapi/stdlib/device: no DeviceHost installed. Call installStdlib(createTauriHost()) in Tauri app bootstrap.',
        { syscall: 'getNetworkStatus' }
      )
    );
  }
  return host.device.getNetworkStatus().catch((err) => {
    throw mapHostError(err, { syscall: 'getNetworkStatus' });
  });
}

/**
 * Subscribe to network changes — Wi-Fi/Ethernet connect, disconnect,
 * address change. `onChange` fires with a fresh snapshot on every real
 * change (no spurious wakeups).
 *
 * ```js
 * const handle = await agapi.device.watchNetwork((status) => {
 *   console.log(status.hasNetwork, status.networkType);
 * });
 * // later: handle.stop();
 * ```
 */
export function watchNetwork(
  onChange: (status: NetworkStatus) => void
): Promise<NetworkWatchHandle> {
  const host = getHost();
  if (!host?.device?.watchNetwork) {
    return Promise.reject(
      mapHostError(
        '@agapi/stdlib/device: watchNetwork not provided by host. Call installStdlib(createTauriHost()) in Tauri app bootstrap.',
        { syscall: 'watchNetwork' }
      )
    );
  }
  return host.device.watchNetwork(onChange).catch((err) => {
    throw mapHostError(err, { syscall: 'watchNetwork' });
  });
}

const device = {
  getNetworkStatus,
  watchNetwork,
};

export default device;
