import type { INetworkProvider, ITcpServer, ITcpSocket, IUdpSocket } from './net/types';

/**
 * Platform host injected into stdlib at bootstrap.
 * Applications never talk to Tauri directly — only through this.
 */
export interface NetHost extends INetworkProvider {
  /** Optional richer factories; defaults use INetworkProvider methods. */
}

export interface HttpHost {
  name: string;
  createServer(requestListener?: (req: any, res: any) => void): any;
  request(options: any, callback?: (res: any) => void): any;
  get(options: any, callback?: (res: any) => void): any;
  WebSocketServer?: new (options: { port: number }) => any;
}

export interface DnsLookupOptions {
  family?: number;
  hints?: number;
  all?: boolean;
  verbatim?: boolean;
  order?: 'ipv4first' | 'ipv6first' | 'verbatim';
}

export interface DnsLookupAddress {
  address: string;
  family: number;
}

export interface DnsHost {
  name: string;
  lookup(
    hostname: string,
    options?: DnsLookupOptions
  ): Promise<DnsLookupAddress | DnsLookupAddress[]>;
}

export interface TlsConnectOptions {
  host?: string;
  port?: number;
  servername?: string;
  rejectUnauthorized?: boolean;
  ALPNProtocols?: string[];
  path?: string;
}

export interface TlsHost {
  name: string;
  connect(options: TlsConnectOptions): ITcpSocket;
}

/** Resolved mDNS / DNS-SD service instance. */
export interface MdnsService {
  /** Instance name (e.g. "Living Room") */
  name: string;
  /** Service type, usually with `.local.` (e.g. `_http._tcp.local.`) */
  serviceType: string;
  /** Full DNS-SD name */
  fullname: string;
  /** Target hostname (often `*.local.`) */
  host: string;
  port: number;
  addresses: string[];
  txt: Record<string, string>;
}

export type MdnsBrowseEventType =
  | 'started'
  | 'found'
  | 'resolved'
  | 'removed'
  | 'stopped'
  | 'error';

export interface MdnsBrowseEvent {
  type: MdnsBrowseEventType;
  serviceType?: string;
  fullname?: string;
  service?: MdnsService;
  error?: Error;
}

export interface MdnsBrowseHandle {
  stop(): void;
}

export interface MdnsPublishOptions {
  type: string;
  name: string;
  port: number;
  txt?: Record<string, string>;
}

export interface MdnsPublishHandle {
  stop(): Promise<void> | void;
  readonly id: string;
}

export interface MdnsHost {
  name: string;
  browse(serviceType: string, onEvent: (ev: MdnsBrowseEvent) => void): MdnsBrowseHandle;
  publish(options: MdnsPublishOptions): Promise<MdnsPublishHandle>;
}

export interface AgapiHost {
  name: string;
  net: NetHost;
  http?: HttpHost;
  dns?: DnsHost;
  tls?: TlsHost;
  mdns?: MdnsHost;
}

/** Runtime slot set by installStdlib(). */
let currentHost: AgapiHost | null = null;

export function getHost(): AgapiHost | null {
  return currentHost;
}

export function setHost(host: AgapiHost | null): void {
  currentHost = host;
}

export type { INetworkProvider, ITcpServer, ITcpSocket, IUdpSocket };
