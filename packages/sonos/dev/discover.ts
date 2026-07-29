/**
 * Discover Sonos speakers on the LAN and print name/model/state per device.
 *
 *   npx tsx packages/sonos/dev/discover.ts
 */
import { discover } from '../src/protocol/discovery.js';
import { SonosDevice } from '../src/protocol/client.js';
import { createNodeDiscoverySocket, createNodeSoapTransport } from './node-transport.js';

const socket = await createNodeDiscoverySocket();
console.log('M-SEARCH sent, collecting replies for 5s…');

const found = await discover(socket, (d) => console.log(`  reply from ${d.address} (${d.usn ?? '?'})`));

if (found.length === 0) {
  console.log('No Sonos speakers found.');
  process.exit(1);
}

const soap = createNodeSoapTransport();
for (const { address } of found) {
  const device = new SonosDevice(address, soap);
  const [desc, state, volume, mute] = await Promise.all([
    device.getDescription(),
    device.getTransportState(),
    device.getVolume(),
    device.getMute(),
  ]);
  console.log(
    `\n${desc.roomName ?? '?'} — ${desc.modelName ?? '?'} @ ${address}\n` +
      `  state: ${state.state}, volume: ${volume}${mute ? ' (muted)' : ''}\n` +
      `  track: ${state.trackTitle ?? '—'}${state.trackArtist ? ` — ${state.trackArtist}` : ''}`,
  );
}
