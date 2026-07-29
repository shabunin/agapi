/**
 * Control one speaker by IP:
 *
 *   npx tsx packages/sonos/dev/control.ts <ip> play|pause|stop|next|previous|state
 *   npx tsx packages/sonos/dev/control.ts <ip> volume [0-100]
 *   npx tsx packages/sonos/dev/control.ts <ip> mute on|off
 */
import { SonosDevice } from '../src/protocol/client.js';
import { createNodeSoapTransport } from './node-transport.js';

const [ip, command, arg] = process.argv.slice(2);
if (!ip || !command) {
  console.error('Usage: tsx control.ts <ip> <play|pause|stop|next|previous|state|volume|mute> [arg]');
  process.exit(1);
}

const device = new SonosDevice(ip, createNodeSoapTransport());

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
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
