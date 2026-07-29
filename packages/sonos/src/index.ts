/**
 * @agapi/sonos — Sonos speaker driver (UPnP: SSDP discovery + SOAP control).
 *
 * Second real driver after @agapi/matterjs, and deliberately the simple one:
 * no crypto, no commissioning — everything runs on stdlib surfaces that
 * already shipped (`agapi.dgram` multicast for SSDP, `agapi.http` for SOAP).
 * Protocol core (src/protocol/) is transport-agnostic; dev/ has node:dgram +
 * fetch transports for tsx-based development against real speakers.
 *
 * GENA eventing (speaker pushes state changes to an `agapi.http.createServer`
 * callback) is the planned second stage — v1 is discovery + polling control.
 */

export { SonosDevice, SONOS_CONTROL_PORT, type SoapTransport, type SonosTransportState } from './protocol/client.js';
export { discover, type DiscoverySocket } from './protocol/discovery.js';
export { type SsdpResponse } from './protocol/ssdp.js';
export { createAgapiDiscoverySocket, createAgapiSoapTransport } from './agapi-transport.js';

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
