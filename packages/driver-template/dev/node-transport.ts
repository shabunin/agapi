import { createConnection } from 'node:net';
import type { TcpConnection, TcpTransport } from '../src/protocol/transport.js';

/**
 * node:net implementation of TcpTransport — for `tsx` harnesses without Tauri.
 * Keep behaviour aligned with `src/agapi-transport.ts`.
 */

export function createNodeTcpTransport(): TcpTransport {
  return {
    connect(host, port) {
      return new Promise((resolve, reject) => {
        const socket = createConnection({ host, port }, () => {
          socket.off('error', onErr);
          resolve(adapt(socket));
        });
        const onErr = (err: Error) => {
          socket.off('error', onErr);
          reject(err);
        };
        socket.once('error', onErr);
      });
    },
  };
}

function adapt(socket: import('node:net').Socket): TcpConnection {
  return {
    write(data) {
      socket.write(data);
    },
    onData(cb) {
      socket.on('data', (chunk: Buffer) => {
        cb(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });
    },
    onClose(cb) {
      socket.on('close', () => cb());
    },
    onError(cb) {
      socket.on('error', (err) => cb(err));
    },
    destroy() {
      socket.destroy();
    },
  };
}
