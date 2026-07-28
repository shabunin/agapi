import { type as osType } from '@tauri-apps/plugin-os';
import type { AgapiHost, HttpHost, NetHost } from '@agapi/stdlib/host';
import { TauriNetworkProvider } from './net/provider';
import * as tauriHttp from './http/index';
import { createDnsHost } from './dns';
import { createTlsHost } from './tls/index';
import { createMdnsHost } from './mdns';
import { createDeviceHost } from './device';
import { createNotificationHost } from './notifications';
import { createBiometricHost } from './biometric';
import { createHapticsHost } from './haptics';
import { createNfcHost } from './nfc';
import { createFsHost } from './fs';

export { TauriNetworkProvider } from './net/provider';
export { TauriTcpSocket } from './net/socket';
export { TauriTcpServer } from './net/server';
export { TauriUdpSocket, createSocket as createUdpSocket } from './net/udp';
export { TauriTlsSocket } from './tls/index';
export { createDnsHost, TauriDnsHost } from './dns';
export { createTlsHost, TauriTlsHost } from './tls/index';
export { createMdnsHost, TauriMdnsHost } from './mdns';
export { createDeviceHost, TauriDeviceHost } from './device';
export { createNotificationHost, TauriNotificationHost } from './notifications';
export { createBiometricHost, TauriBiometricHost } from './biometric';
export { createHapticsHost, TauriHapticsHost } from './haptics';
export { createNfcHost, TauriNfcHost } from './nfc';
export { createFsHost, TauriFsHost } from './fs';
export * as tauriHttp from './http/index';
export { net as tauriNet, dgram as tauriDgram } from './net/index';

function createHttpHost(): HttpHost {
  return {
    name: 'TauriHttpHost',
    createServer: tauriHttp.createServer,
    request: tauriHttp.request,
    get: tauriHttp.get,
    WebSocketServer: tauriHttp.WebSocketServer,
    WebSocket: tauriHttp.WebSocket,
  };
}

/**
 * Build the Tauri platform host for installStdlib().
 */
export function createTauriHost(): AgapiHost {
  const netProvider = new TauriNetworkProvider();
  const net: NetHost = netProvider;

  // biometric/haptics/nfc aren't compiled into desktop builds at all (see
  // src-tauri/Cargo.toml's target.'cfg(android/ios)'.dependencies) — leaving
  // them undefined there is honest, not a workaround: their commands don't
  // exist to call.
  const isMobile = osType() === 'android' || osType() === 'ios';

  return {
    name: 'tauri',
    net,
    http: createHttpHost(),
    dns: createDnsHost(),
    tls: createTlsHost(),
    mdns: createMdnsHost(),
    device: createDeviceHost(),
    notifications: createNotificationHost(),
    biometric: isMobile ? createBiometricHost() : undefined,
    haptics: isMobile ? createHapticsHost() : undefined,
    nfc: isMobile ? createNfcHost() : undefined,
    fs: createFsHost(),
  };
}

export default createTauriHost;
