/**
 * Live GENA subscription against one speaker:
 *
 *   npx tsx packages/sonos/dev/events.ts <ip> [callbackHost] [port]
 *
 * Opens a CALLBACK HTTP server, SUBSCRIBEs AVTransport + RenderingControl,
 * prints every LastChange. Ctrl+C → UNSUBSCRIBE + close.
 *
 * Example:
 *   npx tsx packages/sonos/dev/events.ts 192.168.1.174
 *   # then pause/play or twist volume on the speaker — events stream here.
 */
import { SonosDevice } from '../src/protocol/client.js';
import { createNodeEventServer, createNodeSoapTransport } from './node-transport.js';

const [ip, callbackHost, portArg] = process.argv.slice(2);
if (!ip) {
  console.error('Usage: tsx events.ts <ip> [callbackHost] [port=3400]');
  process.exit(1);
}

const port = portArg ? Number(portArg) : 3400;
const device = new SonosDevice(ip, createNodeSoapTransport());
const desc = await device.getDescription().catch(() => ({} as { roomName?: string }));
console.log(`speaker ${desc.roomName ?? ip} @ ${ip}`);

const events = await createNodeEventServer({
  port,
  ...(callbackHost?.trim() ? { callbackHost: callbackHost.trim() } : {}),
  // Short lifetime so renew path is exercised if you leave it running.
  timeoutSeconds: 300,
});
console.log(`CALLBACK ${events.callbackBaseUrl}  (speaker must reach this host:port)`);
console.log(`GET ${events.callbackBaseUrl}/  → health`);

const sub = await events.subscribe(device, {
  onTransport: (c) => {
    const track = [c.trackTitle, c.trackArtist].filter(Boolean).join(' · ');
    console.log(
      `[AVT] ${c.transportState ?? '?'}${track ? ` — ${track}` : ''}${
        c.currentTrackURI ? `\n       uri ${c.currentTrackURI}` : ''
      }`,
    );
  },
  onVolume: (v) => console.log(`[RC]  volume ${v}`),
  onMute: (m) => console.log(`[RC]  mute ${m ? 'on' : 'off'}`),
  onError: (e, ctx) => console.error(`[err ${ctx.service}]`, e.message),
});

console.log('subscribed', sub.sids);
console.log('waiting for NOTIFY… (Ctrl+C to leave)');

const shutdown = async () => {
  console.log('\nunsubscribing…');
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  await events.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
