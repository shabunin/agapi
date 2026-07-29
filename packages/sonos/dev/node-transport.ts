import { createSocket } from 'node:dgram';
import { createServer as createNodeHttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import type { DiscoverySocket } from '../src/protocol/discovery.js';
import type { SoapTransport } from '../src/protocol/client.js';
import {
  createEventServer,
  type EventServerOptions,
  type GenaHttpRequest,
  type SonosEventServer,
} from '../src/events.js';

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

/** GENA client via fetch — SUBSCRIBE/UNSUBSCRIBE need response headers (SID). */
export const nodeGenaRequest: GenaHttpRequest = async (opts) => {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: res.status, headers, body: await res.text() };
};

export function pickNodeLanIpv4(): string {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      const family = String(net.family);
      if ((family === 'IPv4' || family === '4') && !net.internal) {
        return net.address;
      }
    }
  }
  throw new Error('no LAN IPv4 — pass callbackHost explicitly');
}

/** GENA event server over node:http (tsx harness, no Tauri). */
export async function createNodeEventServer(
  opts: Omit<EventServerOptions, 'createServer' | 'httpRequest' | 'resolveCallbackHost'> & {
    resolveCallbackHost?: EventServerOptions['resolveCallbackHost'];
  } = {},
): Promise<SonosEventServer> {
  return createEventServer({
    ...opts,
    createServer: (listener) => createNodeHttpServer(listener),
    httpRequest: nodeGenaRequest,
    resolveCallbackHost: opts.callbackHost
      ? undefined
      : (opts.resolveCallbackHost ?? pickNodeLanIpv4),
    callbackHost: opts.callbackHost,
  });
}
