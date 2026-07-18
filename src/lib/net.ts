/**
 * Compatibility shim — implementation lives in @agapi/stdlib.
 * Prefer: import net from '@agapi/stdlib/net'
 */
export {
  net,
  NetworkManager,
  SocketAddress,
  isIP,
  isIPv4,
  isIPv6,
  EventEmitter,
  MockTcpSocket,
  MockTcpServer,
  MockUdpSocket,
  DefaultMockProvider,
  Socket,
} from '@agapi/stdlib/net';

export type {
  ITcpSocket,
  IUdpSocket,
  ITcpServer,
  INetworkProvider,
  NetEventPayload,
} from '@agapi/stdlib/net';

export { dgram } from '@agapi/stdlib/dgram';

import net from '@agapi/stdlib/net';
export default net;
