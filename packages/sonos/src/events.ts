import {
  DEFAULT_GENA_CALLBACK_PORT,
  DEFAULT_GENA_TIMEOUT_SECONDS,
  GENA_SERVICES,
  eventUrl,
  headerOf,
  interpretNotifyBody,
  parseTimeoutHeader,
  type GenaServiceName,
  type SonosGenaChange,
} from './protocol/gena.js';
import type { SonosDevice } from './protocol/client.js';

/**
 * GENA event server — one LAN HTTP listener, many speaker subscriptions.
 *
 * ```ts
 * const events = await createEventServer({
 *   port: 3400,
 *   callbackHost: '192.168.1.50', // this machine's LAN IP
 *   createServer: (h) => http.createServer(h),
 *   httpRequest: nodeGenaRequest,
 * });
 *
 * const sub = await events.subscribe(device, {
 *   onChange: (change) => console.log(change),
 * });
 * // later:
 * await sub.unsubscribe();
 * await events.close();
 * ```
 *
 * Prefer the thin wrappers: `createAgapiEventServer` / node `createNodeEventServer`.
 */

export interface GenaHttpResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface GenaHttpRequest {
  (opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<GenaHttpResult>;
}

export interface HttpServerHandle {
  // Node's listen has many overloads; keep this loose so node:http and host-tauri both fit.
  listen(port: number, callback?: () => void): unknown;
  close(callback?: () => void): unknown;
  on?(event: string, listener: (...args: any[]) => void): void;
  off?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
}

export type CreateHttpServer = (
  requestListener: (req: any, res: any) => void,
) => HttpServerHandle;

export interface EventServerOptions {
  /**
   * Local TCP port for the CALLBACK server. Speakers must be able to open a
   * TCP connection to `callbackHost:port`. Default 3400 (not 0 — host-tauri
   * does not return the ephemeral port).
   */
  port?: number;
  /**
   * LAN IPv4 of *this* machine, used in CALLBACK URLs the speaker dials back.
   * Must be reachable from the speaker. Required unless `resolveCallbackHost` is set.
   */
  callbackHost?: string;
  /** Resolve LAN IP when `callbackHost` is omitted. */
  resolveCallbackHost?: () => string | Promise<string>;
  /** Requested subscription lifetime (UPnP TIMEOUT Second-N). Default 1800. */
  timeoutSeconds?: number;
  createServer: CreateHttpServer;
  httpRequest: GenaHttpRequest;
}

export interface SubscribeOptions {
  /** Defaults to both AVTransport + RenderingControl. */
  services?: GenaServiceName[];
  /** Fires for every parsed LastChange (transport or volume/mute). */
  onChange?: (change: SonosGenaChange, ctx: SubscribeContext) => void;
  onTransport?: (
    change: Extract<SonosGenaChange, { service: 'AVTransport' }>,
    ctx: SubscribeContext,
  ) => void;
  onVolume?: (volume: number, ctx: SubscribeContext) => void;
  onMute?: (mute: boolean, ctx: SubscribeContext) => void;
  /** Raw NOTIFY body when parsing fails or for debugging. */
  onNotify?: (info: { service: GenaServiceName; body: string; sid?: string }, ctx: SubscribeContext) => void;
  onError?: (err: Error, ctx: SubscribeContext) => void;
}

export interface SubscribeContext {
  device: SonosDevice;
  service: GenaServiceName;
}

export interface SonosEventSubscription {
  readonly device: SonosDevice;
  readonly services: GenaServiceName[];
  /** Active SIDs per service. */
  readonly sids: Readonly<Partial<Record<GenaServiceName, string>>>;
  unsubscribe(): Promise<void>;
}

export interface SonosEventServer {
  readonly port: number;
  readonly callbackHost: string;
  /** Base URL speakers call, e.g. `http://192.168.1.50:3400`. */
  readonly callbackBaseUrl: string;
  subscribe(device: SonosDevice, options?: SubscribeOptions): Promise<SonosEventSubscription>;
  /** Drop every subscription and stop the HTTP listener. */
  close(): Promise<void>;
}

interface RouteEntry {
  device: SonosDevice;
  service: GenaServiceName;
  sid?: string;
  handlers: SubscribeOptions;
  /** Parent subscription id (groups services for unsubscribe). */
  subId: string;
}

interface SubRecord {
  id: string;
  device: SonosDevice;
  services: GenaServiceName[];
  sids: Partial<Record<GenaServiceName, string>>;
  /** path keys registered under this sub */
  routeKeys: string[];
  renewTimers: ReturnType<typeof setTimeout>[];
  handlers: SubscribeOptions;
  closed: boolean;
}

function collectBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    // host-tauri IncomingMessage already has the full body and replays on 'data'.
    if (typeof req.on !== 'function') {
      resolve(typeof req.body === 'string' ? req.body : '');
      return;
    }
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array | string) => {
      chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    });
    req.on('end', () => {
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      resolve(new TextDecoder().decode(merged));
    });
    req.on('error', reject);
  });
}

function listenServer(server: HttpServerHandle, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    const onErr = (e: Error) => finish(e);
    server.on?.('error', onErr);
    try {
      const result = server.listen(port, () => finish());
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(() => finish(), finish);
      }
    } catch (e) {
      finish(e as Error);
    }
  });
}

function closeServer(server: HttpServerHandle): Promise<void> {
  return new Promise((resolve) => {
    try {
      const result = server.close(() => resolve());
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).then(() => resolve(), () => resolve());
      }
    } catch {
      resolve();
    }
  });
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export async function createEventServer(options: EventServerOptions): Promise<SonosEventServer> {
  const port = options.port ?? DEFAULT_GENA_CALLBACK_PORT;
  const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_GENA_TIMEOUT_SECONDS;
  // Treat empty string as "unset" so CLI callers can pass `callbackHost || undefined`.
  const explicitHost = options.callbackHost?.trim() || undefined;
  const callbackHost =
    explicitHost ??
    (options.resolveCallbackHost ? await options.resolveCallbackHost() : undefined);
  if (!callbackHost) {
    throw new Error(
      'createEventServer: callbackHost is required (LAN IP of this machine) so speakers can NOTIFY back',
    );
  }

  const routes = new Map<string, RouteEntry>();
  const subs = new Map<string, SubRecord>();

  const server = options.createServer((req, res) => {
    void handleRequest(req, res);
  });

  await listenServer(server, port);

  const callbackBaseUrl = `http://${callbackHost}:${port}`;

  async function handleRequest(req: any, res: any) {
    const method = String(req.method || 'GET').toUpperCase();
    const url = String(req.url || '/');
    const path = url.split('?')[0] ?? url;

    // GET / — tiny health for gallery docs ("is my callback up?")
    if (method === 'GET' && (path === '/' || path === '')) {
      res.writeHead?.(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end?.(
        `agapi/sonos GENA callback\nbase: ${callbackBaseUrl}\nsubs: ${subs.size}\n`,
      );
      return;
    }

    if (method !== 'NOTIFY') {
      res.writeHead?.(404, { 'Content-Type': 'text/plain' });
      res.end?.('not found');
      return;
    }

    // Path: /sonos-events/<subId>/<service>
    const m = /^\/sonos-events\/([^/]+)\/(AVTransport|RenderingControl)\/?$/.exec(path);
    if (!m) {
      res.writeHead?.(404, { 'Content-Type': 'text/plain' });
      res.end?.('unknown callback path');
      return;
    }
    const [, subId, serviceName] = m;
    const service = serviceName as GenaServiceName;
    const key = routeKey(subId, service);
    const route = routes.get(key);

    // Always 200 quickly — GENA resends aggressively on failure.
    res.writeHead?.(200, { 'Content-Type': 'text/plain' });
    res.end?.('OK');

    if (!route) return;

    try {
      const body = await collectBody(req);
      const sid = headerOf(req.headers || {}, 'SID');
      const ctx: SubscribeContext = { device: route.device, service };
      route.handlers.onNotify?.({ service, body, sid }, ctx);

      const change = interpretNotifyBody(service, body);
      if (!change) return;

      route.handlers.onChange?.(change, ctx);
      if (change.service === 'AVTransport') {
        route.handlers.onTransport?.(change, ctx);
      } else {
        if (change.volume !== undefined) route.handlers.onVolume?.(change.volume, ctx);
        if (change.mute !== undefined) route.handlers.onMute?.(change.mute, ctx);
      }
    } catch (e) {
      route.handlers.onError?.(e instanceof Error ? e : new Error(String(e)), {
        device: route.device,
        service,
      });
    }
  }

  function routeKey(subId: string, service: GenaServiceName) {
    return `${subId}:${service}`;
  }

  async function genaSubscribe(
    device: SonosDevice,
    service: GenaServiceName,
    callbackUrl: string,
  ): Promise<{ sid: string; timeoutSec: number }> {
    const svc = GENA_SERVICES[service];
    const url = eventUrl(device.address, svc);
    const res = await options.httpRequest({
      method: 'SUBSCRIBE',
      url,
      headers: {
        CALLBACK: `<${callbackUrl}>`,
        NT: 'upnp:event',
        TIMEOUT: `Second-${timeoutSeconds}`,
      },
    });
    if (res.status >= 400) {
      throw new Error(
        `SUBSCRIBE ${service} @ ${device.address} failed: HTTP ${res.status} ${res.body.slice(0, 200)}`,
      );
    }
    const sid = headerOf(res.headers, 'SID');
    if (!sid) {
      throw new Error(
        `SUBSCRIBE ${service} @ ${device.address}: response missing SID header`,
      );
    }
    const timeoutSec = parseTimeoutHeader(headerOf(res.headers, 'TIMEOUT'), timeoutSeconds);
    return { sid, timeoutSec };
  }

  async function genaRenew(
    device: SonosDevice,
    service: GenaServiceName,
    sid: string,
  ): Promise<number> {
    const svc = GENA_SERVICES[service];
    const url = eventUrl(device.address, svc);
    const res = await options.httpRequest({
      method: 'SUBSCRIBE',
      url,
      headers: {
        SID: sid,
        TIMEOUT: `Second-${timeoutSeconds}`,
      },
    });
    if (res.status >= 400) {
      throw new Error(`renew ${service} @ ${device.address} failed: HTTP ${res.status}`);
    }
    return parseTimeoutHeader(headerOf(res.headers, 'TIMEOUT'), timeoutSeconds);
  }

  async function genaUnsubscribe(
    device: SonosDevice,
    service: GenaServiceName,
    sid: string,
  ): Promise<void> {
    const svc = GENA_SERVICES[service];
    const url = eventUrl(device.address, svc);
    try {
      await options.httpRequest({
        method: 'UNSUBSCRIBE',
        url,
        headers: { SID: sid },
      });
    } catch {
      // best-effort on teardown
    }
  }

  function scheduleRenew(sub: SubRecord, service: GenaServiceName, timeoutSec: number) {
    // Renew at 50% of lifetime — safe margin before speaker drops the SID.
    const delayMs = Math.max(5_000, Math.floor(timeoutSec * 0.5 * 1000));
    const timer = setTimeout(() => {
      void (async () => {
        if (sub.closed) return;
        const sid = sub.sids[service];
        if (!sid) return;
        try {
          const next = await genaRenew(sub.device, service, sid);
          scheduleRenew(sub, service, next);
        } catch (e) {
          sub.handlers.onError?.(e instanceof Error ? e : new Error(String(e)), {
            device: sub.device,
            service,
          });
        }
      })();
    }, delayMs);
    sub.renewTimers.push(timer);
  }

  async function subscribe(
    device: SonosDevice,
    handlers: SubscribeOptions = {},
  ): Promise<SonosEventSubscription> {
    const services = handlers.services ?? (['AVTransport', 'RenderingControl'] as GenaServiceName[]);
    const subId = randomId();
    const sub: SubRecord = {
      id: subId,
      device,
      services: [...services],
      sids: {},
      routeKeys: [],
      renewTimers: [],
      handlers,
      closed: false,
    };
    subs.set(subId, sub);

    try {
      for (const service of services) {
        const callbackUrl = `${callbackBaseUrl}/sonos-events/${subId}/${service}`;
        const key = routeKey(subId, service);
        routes.set(key, { device, service, handlers, subId });
        sub.routeKeys.push(key);

        const { sid, timeoutSec } = await genaSubscribe(device, service, callbackUrl);
        sub.sids[service] = sid;
        const route = routes.get(key);
        if (route) route.sid = sid;
        scheduleRenew(sub, service, timeoutSec);
      }
    } catch (e) {
      await unsubscribeRecord(sub);
      throw e;
    }

    return {
      get device() {
        return device;
      },
      get services() {
        return sub.services;
      },
      get sids() {
        return { ...sub.sids };
      },
      unsubscribe: () => unsubscribeRecord(sub),
    };
  }

  async function unsubscribeRecord(sub: SubRecord): Promise<void> {
    if (sub.closed) return;
    sub.closed = true;
    for (const t of sub.renewTimers) clearTimeout(t);
    sub.renewTimers = [];
    for (const service of sub.services) {
      const sid = sub.sids[service];
      if (sid) await genaUnsubscribe(sub.device, service, sid);
    }
    for (const key of sub.routeKeys) routes.delete(key);
    subs.delete(sub.id);
  }

  async function close(): Promise<void> {
    const all = [...subs.values()];
    for (const sub of all) {
      await unsubscribeRecord(sub);
    }
    await closeServer(server);
  }

  return {
    port,
    callbackHost,
    callbackBaseUrl,
    subscribe,
    close,
  };
}
