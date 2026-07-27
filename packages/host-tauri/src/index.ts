import type { AgapiHost, HttpHost, NetHost } from '@agapi/stdlib/host';
import { TauriNetworkProvider } from './net/provider';
import * as tauriHttp from './http/index';
import { createDnsHost } from './dns';
import { createTlsHost } from './tls/index';
import { createMdnsHost } from './mdns';

export { TauriNetworkProvider } from './net/provider';
export { TauriTcpSocket } from './net/socket';
export { TauriTcpServer } from './net/server';
export { TauriUdpSocket, createSocket as createUdpSocket } from './net/udp';
export { TauriTlsSocket } from './tls/index';
export { createDnsHost, TauriDnsHost } from './dns';
export { createTlsHost, TauriTlsHost } from './tls/index';
export { createMdnsHost, TauriMdnsHost } from './mdns';
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
    fetch: tauriHttp.fetch,
  };
}

/**
 * Build the Tauri platform host for installStdlib().
 */
export function createTauriHost(): AgapiHost {
  const netProvider = new TauriNetworkProvider();
  const net: NetHost = netProvider;

  return {
    name: 'tauri',
    net,
    http: createHttpHost(),
    dns: createDnsHost(),
    tls: createTlsHost(),
    mdns: createMdnsHost(),
  };
}

export default createTauriHost;
