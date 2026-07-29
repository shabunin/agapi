import { net } from '@agapi/stdlib';
import type { ITcpSocket } from '@agapi/stdlib/net/types';
import type { TcpConnection, TcpTransport } from './protocol/transport.js';

/**
 * TCP transport over `agapi.net` — used in the Tauri app / gallery.
 * Mirror of `dev/node-transport.ts`; keep them in lockstep when you extend the seam.
 */

function adaptSocket(socket: ITcpSocket): TcpConnection {
  return {
    write(data) {
      socket.write(data);
    },
    onData(cb) {
      socket.on('data', (chunk: Uint8Array | string | number[]) => {
        if (typeof chunk === 'string') {
          cb(new TextEncoder().encode(chunk));
        } else if (chunk instanceof Uint8Array) {
          cb(chunk);
        } else if (Array.isArray(chunk)) {
          cb(new Uint8Array(chunk));
        }
      });
    },
    onClose(cb) {
      // host-tauri's real socket emits both 'end' and 'close' on disconnect
      // (packages/host-tauri/src/net/socket.ts) — listen to 'close' only, it's
      // the one every backend (mock + tauri) guarantees.
      socket.on('close', () => cb());
    },
    onError(cb) {
      socket.on('error', (err: Error) => cb(err instanceof Error ? err : new Error(String(err))));
    },
    destroy() {
      try {
        socket.destroy?.();
      } catch {
        /* ignore */
      }
    },
  };
}

export function createAgapiTcpTransport(): TcpTransport {
  return {
    connect(host, port) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const socket = net.connect(port, host);
        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          socket.off?.('error', onErr);
          socket.off?.('connect', onConnect);
          socket.off?.('ready', onConnect);
          if (err) reject(err);
          else resolve(adaptSocket(socket));
        };
        const onErr = (err: Error) =>
          finish(err instanceof Error ? err : new Error(String(err)));
        const onConnect = () => finish();
        socket.on('error', onErr);
        socket.on('connect', onConnect);
        // Some hosts emit 'ready' instead of / in addition to 'connect'
        socket.on?.('ready', onConnect);
      });
    },
  };
}
