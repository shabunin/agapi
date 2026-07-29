/**
 * @agapi/driver-template — copy-paste starting point for a line-oriented TCP driver.
 *
 * Layout:
 *   src/protocol/            transport-agnostic core (SimpleDevice + seams)
 *   src/agapi-transport.ts   agapi.net glue for the app
 *   dev/node-transport.ts    node:net glue for tsx without Tauri
 *   dev/mock-server.ts       fake device so you can demo offline
 *   dev/control.ts           CLI: power on|off|?
 *
 * Commands (CRLF-terminated):
 *   power on   /  power off  /  power ?
 */

export type { TcpConnection, TcpTransport } from './protocol/transport.js';
export { LineBuffer, encodeLine } from './protocol/framing.js';
export {
  SimpleDevice,
  parsePowerReply,
  type PowerState,
  type SimpleDeviceOptions,
} from './protocol/client.js';
export { createAgapiTcpTransport } from './agapi-transport.js';
