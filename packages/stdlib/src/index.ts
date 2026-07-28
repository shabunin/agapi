export { EventEmitter } from './events';
export { SystemError, mapHostError } from './errors';
export type { MapHostErrorOptions } from './errors';
export type {
  AgapiHost,
  NetHost,
  HttpHost,
  DeviceHost,
  NotificationHost,
  BiometricHost,
  HapticsHost,
  NfcHost,
  FsHost,
} from './host';
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
export {
  default as notifications,
  isPermissionGranted as notificationsIsPermissionGranted,
  requestPermission as notificationsRequestPermission,
  show as notificationsShow,
  onAction as notificationsOnAction,
} from './notifications/index';
export {
  default as biometric,
  checkStatus as biometricCheckStatus,
  isAvailable as biometricIsAvailable,
  authenticate as biometricAuthenticate,
} from './biometric/index';
export {
  default as haptics,
  vibrate as hapticsVibrate,
  impact as hapticsImpact,
  notification as hapticsNotification,
  selection as hapticsSelection,
} from './haptics/index';
export {
  default as nfc,
  isAvailable as nfcIsAvailable,
  scan as nfcScan,
  write as nfcWrite,
  textRecord as nfcTextRecord,
  uriRecord as nfcUriRecord,
} from './nfc/index';
export {
  default as fs,
  readFile as fsReadFile,
  readTextFile as fsReadTextFile,
  writeFile as fsWriteFile,
  appendFile as fsAppendFile,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  stat as fsStat,
  remove as fsRemove,
  exists as fsExists,
} from './fs/index';
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
  NotificationOptions,
  NotificationActionEvent,
  BiometricStatus,
  BiometryType,
  BiometricAuthOptions,
  HapticsImpactStyle,
  HapticsNotificationType,
  NfcTag,
  FsBaseDir,
  FsDirEntry,
  FsFileInfo,
} from './host';

// Re-export protocol payload type for convenience
export type { NetEventPayload } from '@agapi/host-protocol';
