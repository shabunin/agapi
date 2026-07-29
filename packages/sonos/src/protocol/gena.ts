import { extractTag } from './soap.js';
import { unescapeXml } from './didl.js';
import { SONOS_CONTROL_PORT } from './client.js';

/**
 * GENA (UPnP eventing): the speaker POSTs NOTIFY to our CALLBACK URL whenever
 * AVTransport / RenderingControl state changes. No polling.
 *
 * Spec outline:
 *   SUBSCRIBE  …/Event  CALLBACK: <http://panel:port/…>  NT: upnp:event  TIMEOUT: Second-N
 *   → 200  SID: uuid:…  TIMEOUT: Second-N
 *   NOTIFY     our callback  with <e:propertyset> body (usually LastChange)
 *   renew:     SUBSCRIBE with SID (no CALLBACK/NT)
 *   leave:     UNSUBSCRIBE with SID
 */

export type GenaServiceName = 'AVTransport' | 'RenderingControl';

export interface GenaService {
  name: GenaServiceName;
  /** Path on the speaker (port 1400). */
  eventPath: string;
}

export const GENA_SERVICES: Record<GenaServiceName, GenaService> = {
  AVTransport: {
    name: 'AVTransport',
    eventPath: '/MediaRenderer/AVTransport/Event',
  },
  RenderingControl: {
    name: 'RenderingControl',
    eventPath: '/MediaRenderer/RenderingControl/Event',
  },
};

/** Default subscription lifetime we request from the speaker. */
export const DEFAULT_GENA_TIMEOUT_SECONDS = 1800;

/** Default local listen port for the CALLBACK server (must be reachable on LAN). */
export const DEFAULT_GENA_CALLBACK_PORT = 3400;

export function eventUrl(speakerAddress: string, service: GenaService): string {
  return `http://${speakerAddress}:${SONOS_CONTROL_PORT}${service.eventPath}`;
}

/** Case-insensitive header lookup (fetch / axum lower-case; some stacks do not). */
export function headerOf(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== want) continue;
    if (Array.isArray(v)) return v[0];
    return v;
  }
  return undefined;
}

/** Parse `Second-1800` / `Second-infinite` → seconds (infinite → fallback). */
export function parseTimeoutHeader(
  value: string | undefined,
  fallback = DEFAULT_GENA_TIMEOUT_SECONDS,
): number {
  if (!value) return fallback;
  if (/infinite/i.test(value)) return fallback;
  const m = /Second-(\d+)/i.exec(value);
  return m ? Number(m[1]) : fallback;
}

/**
 * Pull name/value pairs out of a GENA propertyset body.
 * Most Sonos services put everything inside a single `LastChange` property
 * whose value is (entity-escaped) event XML.
 */
export function parsePropertySet(body: string): Record<string, string> {
  const props: Record<string, string> = {};
  const re = /<e:property>\s*<([^/>\s]+)[^>]*>([\s\S]*?)<\/\1>\s*<\/e:property>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    props[m[1]] = m[2];
  }
  // Some stacks omit the e: prefix on property tags.
  if (Object.keys(props).length === 0) {
    const re2 = /<property>\s*<([^/>\s]+)[^>]*>([\s\S]*?)<\/\1>\s*<\/property>/g;
    while ((m = re2.exec(body)) !== null) {
      props[m[1]] = m[2];
    }
  }
  return props;
}

/**
 * Parse AVT / RenderingControl LastChange XML into a flat map of variable → val.
 * Only Master-channel RenderingControl values are kept (LF/RF ignored).
 *
 * Input may be raw or entity-escaped (`&lt;Event…`); we unescape once if needed.
 */
export function parseLastChange(lastChangeXml: string): Record<string, string> {
  let xml = lastChangeXml.trim();
  if (xml.includes('&lt;') || xml.includes('&amp;lt;')) {
    xml = unescapeXml(xml);
  }
  const out: Record<string, string> = {};
  // Self-closing: <TransportState val="PLAYING"/> or <Volume channel="Master" val="12"/>
  const re = /<([A-Za-z][A-Za-z0-9]*)\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const [, tag, attrs] = m;
    if (tag === 'Event' || tag === 'InstanceID') continue;
    const val = /(?:^|\s)val="([^"]*)"/.exec(attrs)?.[1];
    if (val === undefined) continue;
    const channel = /(?:^|\s)channel="([^"]*)"/.exec(attrs)?.[1];
    if (channel && channel !== 'Master') continue;
    out[tag] = unescapeXml(val);
  }
  return out;
}

export interface AvTransportChange {
  service: 'AVTransport';
  transportState?: string;
  currentTrackURI?: string;
  currentTrack?: number;
  trackTitle?: string;
  trackArtist?: string;
  trackAlbum?: string;
  /** All InstanceID variables from LastChange. */
  raw: Record<string, string>;
}

export interface RenderingControlChange {
  service: 'RenderingControl';
  volume?: number;
  mute?: boolean;
  raw: Record<string, string>;
}

export type SonosGenaChange = AvTransportChange | RenderingControlChange;

export function interpretLastChange(
  service: GenaServiceName,
  lastChangeXml: string,
): SonosGenaChange {
  const raw = parseLastChange(lastChangeXml);
  if (service === 'AVTransport') {
    const meta = raw.CurrentTrackMetaData ? unescapeXml(raw.CurrentTrackMetaData) : '';
    return {
      service: 'AVTransport',
      transportState: raw.TransportState,
      currentTrackURI: raw.CurrentTrackURI,
      currentTrack: raw.CurrentTrack !== undefined ? Number(raw.CurrentTrack) : undefined,
      trackTitle: extractTag(meta, 'dc:title') ?? undefined,
      trackArtist: extractTag(meta, 'dc:creator') ?? undefined,
      trackAlbum: extractTag(meta, 'upnp:album') ?? undefined,
      raw,
    };
  }
  return {
    service: 'RenderingControl',
    volume: raw.Volume !== undefined ? Number(raw.Volume) : undefined,
    mute: raw.Mute !== undefined ? raw.Mute === '1' : undefined,
    raw,
  };
}

/** Turn a NOTIFY body into a typed change (or null if not a LastChange event). */
export function interpretNotifyBody(
  service: GenaServiceName,
  body: string,
): SonosGenaChange | null {
  const props = parsePropertySet(body);
  const lastChange = props.LastChange;
  if (!lastChange) return null;
  return interpretLastChange(service, lastChange);
}
