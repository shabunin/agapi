/**
 * Compatibility shim — prefer @agapi/host-tauri
 */
export {
  TauriNetworkProvider,
  TauriTcpSocket,
  TauriTcpServer,
  TauriUdpSocket,
  createTauriHost,
  tauriNet as net,
  tauriDgram as dgram,
} from '@agapi/host-tauri';

export { SocketAddress, isIP, isIPv4, isIPv6 } from '@agapi/stdlib/net';
