/**
 * Control one speaker by IP:
 *
 *   npx tsx packages/sonos/dev/control.ts <ip> play|pause|stop|next|previous|state
 *   npx tsx packages/sonos/dev/control.ts <ip> volume [0-100]
 *   npx tsx packages/sonos/dev/control.ts <ip> mute on|off
 *   npx tsx packages/sonos/dev/control.ts <ip> queue|favorites
 *   npx tsx packages/sonos/dev/control.ts <ip> play-uri <uri> [metadata]
 *   npx tsx packages/sonos/dev/control.ts <ip> play-fav <index>
 */
import { SonosDevice } from '../src/protocol/client.js';
import { createNodeSoapTransport } from './node-transport.js';

const [ip, command, arg, arg2] = process.argv.slice(2);
if (!ip || !command) {
  console.error(
    'Usage: tsx control.ts <ip> <play|pause|stop|next|previous|state|volume|mute|queue|favorites|play-uri|play-fav> [arg]',
  );
  process.exit(1);
}

const device = new SonosDevice(ip, createNodeSoapTransport());

function printBrowse(
  label: string,
  items: {
    id: string;
    title?: string;
    creator?: string;
    description?: string;
    uri?: string;
    isContainer: boolean;
    resType?: string;
  }[],
  total: number,
) {
  console.log(`${label}: ${items.length}/${total}`);
  for (const [i, it] of items.entries()) {
    const kind = it.isContainer ? '📁' : '♪';
    const who = it.creator ?? it.description;
    const whoStr = who ? ` — ${who}` : '';
    const note = it.uri ? '' : it.resType === 'shortcut' ? ' (shortcut)' : ' (no uri)';
    console.log(`  [${i}] ${kind} ${it.title ?? it.id}${whoStr}${note}`);
  }
}

switch (command) {
  case 'play':
    await device.play();
    console.log('▶ playing');
    break;
  case 'pause':
    await device.pause();
    console.log('⏸ paused');
    break;
  case 'stop':
    await device.stop();
    console.log('■ stopped');
    break;
  case 'next':
    await device.next();
    console.log('⏭ next');
    break;
  case 'previous':
    await device.previous();
    console.log('⏮ previous');
    break;
  case 'state': {
    const s = await device.getTransportState();
    console.log(s);
    break;
  }
  case 'volume': {
    if (arg === undefined) {
      console.log(`volume: ${await device.getVolume()}`);
    } else {
      await device.setVolume(Number(arg));
      console.log(`volume → ${arg}`);
    }
    break;
  }
  case 'mute': {
    if (arg === 'on' || arg === 'off') {
      await device.setMute(arg === 'on');
      console.log(`mute → ${arg}`);
    } else {
      console.log(`mute: ${(await device.getMute()) ? 'on' : 'off'}`);
    }
    break;
  }
  case 'queue': {
    const r = await device.browseQueue();
    printBrowse('queue', r.items, r.total);
    break;
  }
  case 'favorites': {
    const r = await device.browseFavorites();
    printBrowse('favorites', r.items, r.total);
    break;
  }
  case 'play-uri': {
    if (!arg) {
      console.error('play-uri requires a URI');
      process.exit(1);
    }
    await device.playUri(arg, arg2 ?? '');
    console.log(`▶ play-uri ${arg}`);
    break;
  }
  case 'play-fav': {
    const idx = Number(arg);
    if (!Number.isFinite(idx) || idx < 0) {
      console.error('play-fav requires a non-negative index (from favorites list)');
      process.exit(1);
    }
    const r = await device.browseFavorites();
    const item = r.items[idx];
    if (!item) {
      console.error(`no favorite at index ${idx} (have ${r.items.length})`);
      process.exit(1);
    }
    await device.playItem(item);
    console.log(`▶ favorite [${idx}] ${item.title ?? item.id}`);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
