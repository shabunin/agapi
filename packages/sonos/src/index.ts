/**
 * @agapi/sonos — Sonos speaker driver (UPnP: SSDP + SOAP + GENA).
 *
 * Second real driver after @agapi/matterjs, and deliberately the simple one:
 * no crypto, no commissioning — everything runs on stdlib surfaces that
 * already shipped (`agapi.dgram` for SSDP, `agapi.http` for SOAP + GENA
 * callback server). Protocol core (src/protocol/) is transport-agnostic;
 * dev/ has node:dgram + fetch / node:http for tsx against real speakers.
 *
 * Eventing: `createAgapiEventServer()` → `events.subscribe(device, { onChange })`.
 * The speaker POSTs NOTIFY to our CALLBACK URL (must be reachable on the LAN).
 */

export {
  SonosDevice,
  SONOS_CONTROL_PORT,
  type SoapTransport,
  type SonosTransportState,
  type BrowseResult,
} from './protocol/client.js';
export { SONOS_OBJECT_IDS } from './protocol/soap.js';
export { parseDidl, type DidlItem } from './protocol/didl.js';
export {
  GENA_SERVICES,
  DEFAULT_GENA_CALLBACK_PORT,
  DEFAULT_GENA_TIMEOUT_SECONDS,
  parseLastChange,
  interpretNotifyBody,
  type GenaServiceName,
  type SonosGenaChange,
  type AvTransportChange,
  type RenderingControlChange,
} from './protocol/gena.js';
export {
  createEventServer,
  type SonosEventServer,
  type SonosEventSubscription,
  type SubscribeOptions,
  type EventServerOptions,
  type SubscribeContext,
} from './events.js';
export { discover, type DiscoverySocket } from './protocol/discovery.js';
export { type SsdpResponse } from './protocol/ssdp.js';
export {
  createAgapiDiscoverySocket,
  createAgapiSoapTransport,
  createAgapiEventServer,
  pickAgapiLanIpv4,
  agapiGenaRequest,
} from './agapi-transport.js';

import { SonosDevice } from './protocol/client.js';
import { discover } from './protocol/discovery.js';
import type { SsdpResponse } from './protocol/ssdp.js';
import { createAgapiDiscoverySocket, createAgapiSoapTransport } from './agapi-transport.js';

/** Discover speakers via agapi.dgram and return ready-to-use SonosDevice instances. */
export async function discoverSonos(
  onDevice?: (device: SsdpResponse) => void,
  timeoutMs = 5000,
): Promise<SonosDevice[]> {
  const socket = await createAgapiDiscoverySocket();
  const soap = createAgapiSoapTransport();
  const found = await discover(socket, (d) => onDevice?.(d), timeoutMs);
  return found.map((d) => new SonosDevice(d.address, soap));
}
