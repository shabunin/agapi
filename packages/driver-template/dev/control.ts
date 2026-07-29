/**
 * Control SimpleDevice (real gear or mock-server):
 *
 *   npx tsx packages/driver-template/dev/control.ts <host> <port> power on|off|?
 *   npx tsx packages/driver-template/dev/control.ts 127.0.0.1 2300 power ?
 */
import { SimpleDevice } from '../src/protocol/client.js';
import { createNodeTcpTransport } from './node-transport.js';

const [host, portStr, cmd, arg] = process.argv.slice(2);
if (!host || !portStr || !cmd) {
  console.error('Usage: tsx control.ts <host> <port> power on|off|?');
  process.exit(1);
}

const port = Number(portStr);
const device = new SimpleDevice(createNodeTcpTransport(), { host, port });

await device.connect();
console.log(`connected ${host}:${port}`);

try {
  const action = `${cmd} ${arg ?? ''}`.trim().toLowerCase();
  if (action === 'power on' || action === 'on') {
    console.log(await device.powerOn());
  } else if (action === 'power off' || action === 'off') {
    console.log(await device.powerOff());
  } else if (action === 'power ?' || action === 'power?' || action === '?') {
    console.log(await device.queryPower());
  } else {
    console.log(await device.request(`${cmd}${arg !== undefined ? ` ${arg}` : ''}`));
  }
} finally {
  device.disconnect();
}
