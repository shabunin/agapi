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
  /** MDN-compatible `WebSocket` client (outbound only). */
  WebSocket?: new (url: string, protocols?: string | string[]) => any;
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

/** One local address on a non-loopback interface. */
export interface NetworkAddress {
  address: string;
  family: 'IPv4' | 'IPv6';
  interface: string;
  netmask: string;
}

/**
 * Network status snapshot. `networkType` and the absence of an `ssid` field
 * are honest best-effort limits, not oversights: distinguishing Wi-Fi from
 * Ethernet and reading the SSID both need platform-specific APIs (nl80211,
 * NEHotspotNetwork, WinRT, …) that no host implements yet.
 */
export interface NetworkStatus {
  hasNetwork: boolean;
  networkType: 'wifi' | 'ethernet' | 'other' | 'none';
  addresses: NetworkAddress[];
}

export interface NetworkWatchHandle {
  stop(): void;
}

export interface DeviceHost {
  name: string;
  getNetworkStatus(): Promise<NetworkStatus>;
  /**
   * Subscribe to network changes (Wi-Fi/Ethernet connect, disconnect,
   * address change). Calls `onChange` with a fresh snapshot whenever the OS
   * reports a real change. Optional: not every host backs this (e.g. no
   * `IfChangeNotifier` equivalent on Apple platforms yet).
   */
  watchNetwork?(onChange: (status: NetworkStatus) => void): Promise<NetworkWatchHandle>;
}

/** Loosely typed on purpose (matches `attachments`/`actions`/`schedule`, … from the host plugin). */
export interface NotificationOptions {
  title: string;
  body?: string;
  channelId?: string;
  icon?: string;
  sound?: string;
  [key: string]: any;
}

export interface NotificationActionEvent {
  notification: NotificationOptions & { id?: number };
  actionId?: string;
}

export interface NotificationHost {
  name: string;
  isPermissionGranted(): Promise<boolean>;
  requestPermission(): Promise<NotificationPermission>;
  show(options: NotificationOptions | string): void;
  /** Fires when the user taps the notification or one of its action buttons. */
  onAction(callback: (event: NotificationActionEvent) => void): Promise<() => void>;
}

export type BiometryType = 'none' | 'touchId' | 'faceId' | 'iris';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: BiometryType;
  error?: string;
  errorCode?: string;
}

export interface BiometricAuthOptions {
  allowDeviceCredential?: boolean;
  cancelTitle?: string;
  fallbackTitle?: string;
  title?: string;
  subtitle?: string;
  confirmationRequired?: boolean;
  maxAttempts?: number;
}

export interface BiometricHost {
  name: string;
  checkStatus(): Promise<BiometricStatus>;
  authenticate(reason: string, options?: BiometricAuthOptions): Promise<void>;
}

export type HapticsImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type HapticsNotificationType = 'success' | 'warning' | 'error';

export interface HapticsHost {
  name: string;
  vibrate(durationMs: number): Promise<void>;
  impactFeedback(style: HapticsImpactStyle): Promise<void>;
  notificationFeedback(type: HapticsNotificationType): Promise<void>;
  selectionFeedback(): Promise<void>;
}

/**
 * Loosely typed on purpose — scan/write cover NDEF and raw tag tech lists
 * with a fairly deep type tree upstream (ScanKind/TechKind/NFCRecord); not
 * worth re-declaring in full for a stdlib facade this thin.
 */
export interface NfcTag {
  id: number[];
  kind: string[];
  records: any[];
}

export interface NfcHost {
  name: string;
  isAvailable(): Promise<boolean>;
  scan(scanType: any, options?: any): Promise<NfcTag>;
  write(records: any[], options?: any): Promise<void>;
  textRecord(text: string, id?: string | number[], language?: string): any;
  uriRecord(uri: string, id?: string | number[]): any;
}

export interface AgapiHost {
  name: string;
  net: NetHost;
  http?: HttpHost;
  dns?: DnsHost;
  tls?: TlsHost;
  mdns?: MdnsHost;
  device?: DeviceHost;
  notifications?: NotificationHost;
  biometric?: BiometricHost;
  haptics?: HapticsHost;
  nfc?: NfcHost;
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
