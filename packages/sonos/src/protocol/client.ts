import {
  AVTransport,
  ContentDirectory,
  RenderingControl,
  SONOS_OBJECT_IDS,
  buildSoapRequest,
  extractFault,
  extractTag,
  type SonosService,
} from './soap.js';
import { parseDidl, unescapeXml, type DidlItem } from './didl.js';

/**
 * Transport seam for SOAP calls — implemented over `fetch` in the node dev
 * harness and over `agapi.http` in the app. Must resolve (not reject) on
 * HTTP error statuses so UPnP faults in the body can be reported properly.
 */
export interface SoapTransport {
  post(url: string, soapAction: string, body: string): Promise<{ status: number; body: string }>;
  get(url: string): Promise<{ status: number; body: string }>;
}

export interface SonosTransportState {
  state: 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING' | string;
  trackTitle?: string;
  trackArtist?: string;
  trackAlbum?: string;
  trackUri?: string;
}

export interface BrowseResult {
  items: DidlItem[];
  total: number;
  /** How many items were returned in this page. */
  returned: number;
}

/** Every Sonos speaker serves its UPnP control endpoints on port 1400. */
export const SONOS_CONTROL_PORT = 1400;

export class SonosDevice {
  constructor(
    public readonly address: string,
    private readonly transport: SoapTransport,
  ) {}

  private async call(
    service: SonosService,
    action: string,
    args: Record<string, string | number> = {},
  ): Promise<string> {
    const req = buildSoapRequest(service, action, args);
    const url = `http://${this.address}:${SONOS_CONTROL_PORT}${req.path}`;
    const res = await this.transport.post(url, req.soapAction, req.body);
    const fault = extractFault(res.body);
    if (fault) throw new Error(`${action} failed: ${fault}`);
    if (res.status >= 400) throw new Error(`${action} failed: HTTP ${res.status}`);
    return res.body;
  }

  // InstanceID=0 everywhere: Sonos exposes a single AVTransport/Rendering
  // instance per zone; other IDs are a general-UPnP concept it doesn't use.

  play() {
    return this.call(AVTransport, 'Play', { InstanceID: 0, Speed: '1' });
  }

  pause() {
    return this.call(AVTransport, 'Pause', { InstanceID: 0 });
  }

  stop() {
    return this.call(AVTransport, 'Stop', { InstanceID: 0 });
  }

  next() {
    return this.call(AVTransport, 'Next', { InstanceID: 0 });
  }

  previous() {
    return this.call(AVTransport, 'Previous', { InstanceID: 0 });
  }

  /**
   * Point the zone at a stream/track URI and optionally attach DIDL metadata.
   * Favorites and some services (TuneIn) require CurrentURIMetaData — bare
   * URI alone is rejected. Empty string is fine for plain http streams.
   */
  setAVTransportURI(uri: string, metadata = '') {
    return this.call(AVTransport, 'SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: uri,
      CurrentURIMetaData: metadata,
    });
  }

  /** Set URI (+ optional DIDL metadata) then Play. */
  async playUri(uri: string, metadata = '') {
    await this.setAVTransportURI(uri, metadata);
    await this.play();
  }

  /**
   * Play a ContentDirectory item (queue entry, favorite, …). Uses
   * item.metadata when present — required for many Sonos Favorites.
   */
  async playItem(item: DidlItem) {
    if (!item.uri) throw new Error(`item "${item.title ?? item.id}" has no playable URI`);
    await this.playUri(item.uri, item.metadata ?? '');
  }

  async getTransportState(): Promise<SonosTransportState> {
    const infoXml = await this.call(AVTransport, 'GetTransportInfo', { InstanceID: 0 });
    const state = extractTag(infoXml, 'CurrentTransportState') ?? 'UNKNOWN';

    const positionXml = await this.call(AVTransport, 'GetPositionInfo', { InstanceID: 0 });
    // TrackMetaData is DIDL-Lite XML, but it arrives entity-escaped inside the
    // SOAP response, so unescape before pulling out dc:/upnp: fields.
    const meta = unescapeXml(extractTag(positionXml, 'TrackMetaData') ?? '');

    return {
      state,
      trackTitle: extractTag(meta, 'dc:title'),
      trackArtist: extractTag(meta, 'dc:creator'),
      trackAlbum: extractTag(meta, 'upnp:album'),
      trackUri: extractTag(positionXml, 'TrackURI'),
    };
  }

  /**
   * Browse a ContentDirectory container (queue, favorites, library folders).
   * Default ObjectIDs: `SONOS_OBJECT_IDS.queue` / `.favorites`.
   */
  async browse(objectId: string, start = 0, count = 100): Promise<BrowseResult> {
    const xml = await this.call(ContentDirectory, 'Browse', {
      ObjectID: objectId,
      BrowseFlag: 'BrowseDirectChildren',
      Filter: '*',
      StartingIndex: start,
      RequestedCount: count,
      SortCriteria: '',
    });
    const resultXml = unescapeXml(extractTag(xml, 'Result') ?? '');
    const items = parseDidl(resultXml);
    return {
      items,
      total: Number(extractTag(xml, 'TotalMatches') ?? items.length),
      returned: Number(extractTag(xml, 'NumberReturned') ?? items.length),
    };
  }

  browseQueue(start = 0, count = 100) {
    return this.browse(SONOS_OBJECT_IDS.queue, start, count);
  }

  browseFavorites(start = 0, count = 100) {
    return this.browse(SONOS_OBJECT_IDS.favorites, start, count);
  }

  /** Volume is 0–100. */
  async getVolume(): Promise<number> {
    const xml = await this.call(RenderingControl, 'GetVolume', {
      InstanceID: 0,
      Channel: 'Master',
    });
    return Number(extractTag(xml, 'CurrentVolume') ?? 0);
  }

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    return this.call(RenderingControl, 'SetVolume', {
      InstanceID: 0,
      Channel: 'Master',
      DesiredVolume: clamped,
    });
  }

  async getMute(): Promise<boolean> {
    const xml = await this.call(RenderingControl, 'GetMute', {
      InstanceID: 0,
      Channel: 'Master',
    });
    return extractTag(xml, 'CurrentMute') === '1';
  }

  setMute(mute: boolean) {
    return this.call(RenderingControl, 'SetMute', {
      InstanceID: 0,
      Channel: 'Master',
      DesiredMute: mute ? '1' : '0',
    });
  }

  /** Zone name + model, from the device description XML (plain GET, not SOAP). */
  async getDescription(): Promise<{ roomName?: string; modelName?: string }> {
    const res = await this.transport.get(
      `http://${this.address}:${SONOS_CONTROL_PORT}/xml/device_description.xml`,
    );
    return {
      roomName: extractTag(res.body, 'roomName'),
      modelName: extractTag(res.body, 'modelName'),
    };
  }
}
