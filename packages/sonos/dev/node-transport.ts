import { createSocket } from 'node:dgram';
import type { DiscoverySocket } from '../src/protocol/discovery.js';
import type { SoapTransport } from '../src/protocol/client.js';

/**
 * node:dgram / global fetch versions of the two transport seams — for running
 * dev/*.ts via tsx against real speakers without launching Tauri. Note how
 * little differs from src/agapi-transport.ts: that near-identity is the point
 * of keeping agapi.dgram/agapi.http Node-shaped.
 */

export function createNodeDiscoverySocket(): Promise<DiscoverySocket> {
  return new Promise((resolve, reject) => {
    const socket = createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('error', reject);
    socket.bind(0, () => {
      resolve({
        send: (data, port, address) => socket.send(data, port, address),
        onMessage: (cb) => {
          socket.on('message', (msg, rinfo) => cb(msg, rinfo));
        },
        close: () => socket.close(),
      });
    });
  });
}

export function createNodeSoapTransport(): SoapTransport {
  const doFetch = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    return { status: res.status, body: await res.text() };
  };
  return {
    post: (url, soapAction, body) =>
      doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPACTION: `"${soapAction}"`,
        },
        body,
      }),
    get: (url) => doFetch(url),
  };
}
