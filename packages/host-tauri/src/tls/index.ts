import type { TlsHost, TlsConnectOptions } from '@agapi/stdlib/host';
import type { ITcpSocket } from '@agapi/stdlib/net';
import { TauriTlsSocket } from './socket';

export { TauriTlsSocket } from './socket';

export class TauriTlsHost implements TlsHost {
  name = 'TauriTlsHost';

  connect(options: TlsConnectOptions): ITcpSocket {
    const socket = new TauriTlsSocket();
    socket.startConnect(options);
    return socket;
  }
}

export function createTlsHost(): TlsHost {
  return new TauriTlsHost();
}
