import { dgram, device, http } from '@agapi/stdlib';
import type { DiscoverySocket } from './protocol/discovery.js';
import type { SoapTransport } from './protocol/client.js';
import {
  createEventServer,
  type EventServerOptions,
  type GenaHttpRequest,
  type SonosEventServer,
} from './events.js';

/**
 * Transports over `agapi.dgram` / `agapi.http` — the pair actually used inside
 * the app. `dev/` has the node:dgram + fetch equivalents for tsx-based
 * development against real speakers without launching Tauri.
 */

export function createAgapiDiscoverySocket(): Promise<DiscoverySocket> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.on('error', reject);
    // Bind to an ephemeral port first — M-SEARCH replies come back unicast to
    // whatever port the request left from, so the socket must be bound before
    // sending. No addMembership needed: we multicast *out*, replies are unicast.
    socket.bind(0, () => {
      resolve({
        send: (data, port, address) => socket.send(data, port, address),
        onMessage: (cb) => {
          socket.on('message', (msg: Uint8Array, rinfo: { address: string }) => cb(msg, rinfo));
        },
        close: () => socket.close(),
      });
    });
  });
}

interface AgapiHttpResponse {
  statusCode?: number;
  status?: number;
  headers?: Record<string, string | string[] | undefined>;
  on(event: string, cb: (...args: any[]) => void): void;
}

function collectResponse(
  res: AgapiHttpResponse,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    res.on('data', (chunk: Uint8Array | string) => {
      chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    });
    res.on('end', () => {
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers || {})) {
        if (v === undefined) continue;
        headers[k] = Array.isArray(v) ? (v[0] ?? '') : v;
      }
      resolve({
        status: res.statusCode ?? res.status ?? 0,
        headers,
        body: new TextDecoder().decode(merged),
      });
    });
    res.on('error', reject);
  });
}

function agapiRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ url, method, headers }, (res: AgapiHttpResponse) => {
      collectResponse(res).then(resolve, reject);
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

export function createAgapiSoapTransport(): SoapTransport {
  return {
    post: (url, soapAction, body) =>
      agapiRequest(
        url,
        'POST',
        {
          'Content-Type': 'text/xml; charset="utf-8"',
          // UPnP requires the action quoted, and some firmwares are strict.
          SOAPACTION: `"${soapAction}"`,
        },
        body,
      ).then(({ status, body: b }) => ({ status, body: b })),
    get: (url) =>
      agapiRequest(url, 'GET', {}).then(({ status, body }) => ({ status, body })),
  };
}

/** Arbitrary-method client for GENA SUBSCRIBE / UNSUBSCRIBE (needs response headers). */
export const agapiGenaRequest: GenaHttpRequest = (opts) =>
  agapiRequest(opts.url, opts.method, opts.headers ?? {}, opts.body);

/** Pick a non-loopback IPv4 from agapi.device for CALLBACK URLs. */
export async function pickAgapiLanIpv4(): Promise<string> {
  const status = await device.getNetworkStatus();
  const v4 = status.addresses.find((a) => a.family === 'IPv4' && !a.address.startsWith('127.'));
  if (!v4) {
    throw new Error(
      'no LAN IPv4 from agapi.device.getNetworkStatus() — pass callbackHost explicitly',
    );
  }
  return v4.address;
}

/**
 * GENA event server over `agapi.http.createServer` + `agapi.http.request`.
 * Speakers NOTIFY to `http://<this-machine-LAN-IP>:<port>/sonos-events/…`.
 */
export async function createAgapiEventServer(
  opts: Omit<EventServerOptions, 'createServer' | 'httpRequest' | 'resolveCallbackHost'> & {
    resolveCallbackHost?: EventServerOptions['resolveCallbackHost'];
  } = {},
): Promise<SonosEventServer> {
  return createEventServer({
    ...opts,
    createServer: (listener) => http.createServer(listener),
    httpRequest: agapiGenaRequest,
    resolveCallbackHost: opts.callbackHost
      ? undefined
      : (opts.resolveCallbackHost ?? pickAgapiLanIpv4),
    callbackHost: opts.callbackHost,
  });
}
