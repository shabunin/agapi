import {
  AVTransport,
  RenderingControl,
  buildSoapRequest,
  extractFault,
  extractTag,
  type SonosService,
} from './soap.js';

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

  async getTransportState(): Promise<SonosTransportState> {
    const infoXml = await this.call(AVTransport, 'GetTransportInfo', { InstanceID: 0 });
    const state = extractTag(infoXml, 'CurrentTransportState') ?? 'UNKNOWN';

    const positionXml = await this.call(AVTransport, 'GetPositionInfo', { InstanceID: 0 });
    // TrackMetaData is DIDL-Lite XML, but it arrives entity-escaped inside the
    // SOAP response, so unescape before pulling out dc:/upnp: fields.
    const metaEscaped = extractTag(positionXml, 'TrackMetaData') ?? '';
    const meta = metaEscaped
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    return {
      state,
      trackTitle: extractTag(meta, 'dc:title'),
      trackArtist: extractTag(meta, 'dc:creator'),
      trackAlbum: extractTag(meta, 'upnp:album'),
      trackUri: extractTag(positionXml, 'TrackURI'),
    };
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
