import { extractTag } from './soap.js';

/**
 * DIDL-Lite — the XML list format UPnP ContentDirectory returns from Browse
 * (queue entries, favorites) and AVTransport uses for track metadata. Same
 * tag-matching approach as soap.ts: responses are flat and predictable, not
 * worth a real XML parser dependency.
 */

export interface DidlItem {
  id: string;
  /** True for <container> (playlist/folder), false for <item> (track/station). */
  isContainer: boolean;
  title?: string;
  creator?: string;
  album?: string;
  /** upnp:class, e.g. `object.item.audioItem.musicTrack`, `...sonos-favorite`. */
  upnpClass?: string;
  /**
   * Playable URI from <res>. Empty for some Sonos Favorites that are
   * "shortcuts" (artist / radio container) rather than instant-play tracks.
   */
  uri?: string;
  /**
   * Favorites only (r:resMD): escaped DIDL describing the *target* item —
   * must be passed as CurrentURIMetaData to SetAVTransportURI, or services
   * like TuneIn refuse the bare URI.
   */
  metadata?: string;
  /** Sonos favorite subtype: `instantPlay` (has uri) vs `shortcut` (container). */
  resType?: string;
  /** Human label from r:description (e.g. artist name under a favorite). */
  description?: string;
}

export function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function parseDidl(didlXml: string): DidlItem[] {
  const items: DidlItem[] = [];
  const re = /<(item|container)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(didlXml)) !== null) {
    const [, kind, attrs, body] = m;
    items.push({
      id: /id="([^"]*)"/.exec(attrs)?.[1] ?? '',
      isContainer: kind === 'container',
      title: opt(extractTag(body, 'dc:title')),
      creator: opt(extractTag(body, 'dc:creator')),
      album: opt(extractTag(body, 'upnp:album')),
      upnpClass: opt(extractTag(body, 'upnp:class')),
      uri: opt(extractTag(body, 'res')),
      metadata: opt(extractTag(body, 'r:resMD')),
      resType: opt(extractTag(body, 'r:type')),
      description: opt(extractTag(body, 'r:description')),
    });
  }
  return items;
}

function opt(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : unescapeXml(value);
}
