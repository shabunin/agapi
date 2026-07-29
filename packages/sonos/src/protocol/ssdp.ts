/**
 * SSDP (UPnP discovery) — Sonos speakers answer M-SEARCH requests sent to the
 * standard SSDP multicast group. No auth, no session, just a text request/
 * response pair over UDP.
 */

export const SSDP_MULTICAST_ADDRESS = '239.255.255.250';
export const SSDP_PORT = 1900;

const SONOS_SEARCH_TARGET = 'urn:schemas-upnp-org:device:ZonePlayer:1';

export function buildSearchRequest(): Uint8Array {
  const lines = [
    'M-SEARCH * HTTP/1.1',
    `HOST: ${SSDP_MULTICAST_ADDRESS}:${SSDP_PORT}`,
    'MAN: "ssdp:discover"',
    'MX: 3',
    `ST: ${SONOS_SEARCH_TARGET}`,
    '',
    '',
  ];
  return new TextEncoder().encode(lines.join('\r\n'));
}

export interface SsdpResponse {
  /** Sender IP — also the Sonos SOAP control endpoint (port 1400 always). */
  address: string;
  location?: string;
  usn?: string;
  st?: string;
}

/** Parses one M-SEARCH reply. Returns null for anything that isn't a Sonos ZonePlayer. */
export function parseSearchResponse(data: Uint8Array, address: string): SsdpResponse | null {
  const text = new TextDecoder().decode(data);
  const [statusLine, ...headerLines] = text.split('\r\n');
  if (!/^HTTP\/1\.\d 200/.test(statusLine ?? '')) return null;

  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    headers[line.slice(0, i).trim().toUpperCase()] = line.slice(i + 1).trim();
  }
  if (!headers.ST?.includes('ZonePlayer')) return null;

  return { address, location: headers.LOCATION, usn: headers.USN, st: headers.ST };
}
