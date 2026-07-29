/**
 * Sonos control is plain UPnP SOAP: HTTP POST to port 1400 with an XML
 * envelope and a SOAPACTION header. No auth, no session.
 */

export interface SoapRequest {
  /** e.g. `/MediaRenderer/AVTransport/Control` */
  path: string;
  /** e.g. `urn:schemas-upnp-org:service:AVTransport:1#Play` */
  soapAction: string;
  body: string;
}

export interface SonosService {
  serviceType: string;
  controlPath: string;
}

export const AVTransport: SonosService = {
  serviceType: 'urn:schemas-upnp-org:service:AVTransport:1',
  controlPath: '/MediaRenderer/AVTransport/Control',
};

export const RenderingControl: SonosService = {
  serviceType: 'urn:schemas-upnp-org:service:RenderingControl:1',
  controlPath: '/MediaRenderer/RenderingControl/Control',
};

/** ContentDirectory lives on the MediaServer device (same host:1400). */
export const ContentDirectory: SonosService = {
  serviceType: 'urn:schemas-upnp-org:service:ContentDirectory:1',
  controlPath: '/MediaServer/ContentDirectory/Control',
};

/** Well-known ContentDirectory ObjectIDs used by Sonos. */
export const SONOS_OBJECT_IDS = {
  /** Current play queue. */
  queue: 'Q:0',
  /** Sonos Favorites (app-saved radio stations, playlists, tracks). */
  favorites: 'FV:2',
} as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSoapRequest(
  service: SonosService,
  action: string,
  args: Record<string, string | number> = {},
): SoapRequest {
  const argsXml = Object.entries(args)
    .map(([k, v]) => `<${k}>${escapeXml(String(v))}</${k}>`)
    .join('');
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
    's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    `<s:Body><u:${action} xmlns:u="${service.serviceType}">${argsXml}</u:${action}></s:Body>` +
    '</s:Envelope>';
  return {
    path: service.controlPath,
    soapAction: `${service.serviceType}#${action}`,
    body,
  };
}

/**
 * Pulls named values out of a SOAP response without a full XML parser —
 * UPnP responses are flat (`<CurrentVolume>25</CurrentVolume>`), so a tag
 * match is enough and keeps the driver dependency-free.
 */
export function extractTag(xml: string, tag: string): string | undefined {
  // Require a boundary after the tag name so `upnp:album` does not match
  // `upnp:albumArtURI` (the old `<tag[^>]*>` form treated the longer name as a match).
  const m = xml.match(new RegExp(`<${tag}(?=[\\s>/])[^>]*>([\\s\\S]*?)</${tag}>`));
  return m?.[1];
}

/** UPnP SOAP faults come back as HTTP 500 with an <errorCode> in the body. */
export function extractFault(xml: string): string | undefined {
  const code = extractTag(xml, 'errorCode');
  const desc = extractTag(xml, 'errorDescription');
  if (!code && !desc) return undefined;
  return `UPnP error ${code ?? '?'}${desc ? ` (${desc})` : ''}`;
}
