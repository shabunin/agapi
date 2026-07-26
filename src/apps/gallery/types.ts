export type ToolStatus = 'live' | 'lab' | 'stub' | 'info';

export type GalleryToolId =
  | 'hub'
  | 'sockets'
  | 'tls'
  | 'http'
  | 'dns'
  | 'mdns'
  | 'camera'
  | 'bluetooth'
  | 'webrtc'
  | 'webcodecs';

export interface GalleryToolMeta {
  id: Exclude<GalleryToolId, 'hub'>;
  title: string;
  blurb: string;
  surface: string;
  status: ToolStatus;
  accent: string; // tailwind color token fragment e.g. 'cyan'
}
