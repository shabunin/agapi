export { EventEmitter } from './events';
export { SystemError, mapHostError } from './errors';
export type { MapHostErrorOptions } from './errors';
export type { AgapiHost, NetHost, HttpHost, DeviceHost } from './host';
export { getHost, setHost } from './host';
export { installStdlib, uninstallStdlib } from './install';
export type { InstallOptions, AgapiRuntime } from './install';

export { Buffer, toUint8Array, installBufferGlobal } from './buffer';
export type { BufferEncoding } from './buffer';
export { processShim as process, installProcessGlobal } from './process';

export {
  net,
  NetworkManager,
  SocketAddress,
  isIP,
  isIPv4,
  isIPv6,
  DefaultMockProvider,
} from './net/index';
export type { ITcpSocket, IUdpSocket, ITcpServer, INetworkProvider } from './net/types';
export { dgram } from './dgram/index';
export { default as http, createServer, request, get } from './http/index';
export { default as dns, lookup as dnsLookup, lookupAsync } from './dns/index';
export { default as tls, connect as tlsConnect } from './tls/index';
export {
  default as mdns,
  browse as mdnsBrowse,
  publish as mdnsPublish,
  MdnsBrowser,
} from './mdns/index';
export { default as device, getNetworkStatus, watchNetwork } from './device/index';
export type {
  DnsLookupAddress,
  DnsLookupOptions,
  DnsHost,
  TlsHost,
  TlsConnectOptions,
  MdnsHost,
  MdnsService,
  MdnsBrowseHandle,
  MdnsPublishHandle,
  MdnsBrowseEvent,
  MdnsBrowseEventType,
  MdnsPublishOptions,
  NetworkAddress,
  NetworkStatus,
  NetworkWatchHandle,
} from './host';

// Re-export protocol payload type for convenience
export type { NetEventPayload } from '@agapi/host-protocol';
