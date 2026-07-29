import { dgram, http } from '@agapi/stdlib';
import type { DiscoverySocket } from './protocol/discovery.js';
import type { SoapTransport } from './protocol/client.js';

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
  on(event: string, cb: (...args: any[]) => void): void;
}

function collectResponse(res: AgapiHttpResponse): Promise<{ status: number; body: string }> {
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
      resolve({
        status: res.statusCode ?? res.status ?? 0,
        body: new TextDecoder().decode(merged),
      });
    });
    res.on('error', reject);
  });
}

function agapiRequest(
  url: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; body: string }> {
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
      ),
    get: (url) => agapiRequest(url, 'GET', {}),
  };
}
