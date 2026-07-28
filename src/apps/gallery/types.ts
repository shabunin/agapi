export type ToolStatus = 'live' | 'lab' | 'stub' | 'info';

export type GalleryGroup = 'network' | 'device' | 'browser';

export type GalleryToolId =
  | 'hub'
  | 'sockets'
  | 'tls'
  | 'http'
  | 'http-server'
  | 'websocket-server'
  | 'websocket-client'
  | 'dns'
  | 'mdns'
  | 'network-status'
  | 'os-info'
  | 'bluetooth'
  | 'sensors'
  | 'haptics'
  | 'notifications'
  | 'fs'
  | 'nfc'
  | 'biometrics'
  | 'webrtc'
  | 'webcodecs'
  | 'crypto'
  | 'web-animations'
  | 'gestures';

export interface GalleryToolMeta {
  id: Exclude<GalleryToolId, 'hub'>;
  title: string;
  blurb: string;
  surface: string;
  status: ToolStatus;
  accent: string; // tailwind color token fragment e.g. 'cyan'
  group: GalleryGroup;
}
