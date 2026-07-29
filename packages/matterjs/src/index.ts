/**
 * @agapi/matterjs — Matter protocol driver, built on `matter.js` (vendored
 * for reference under vendor/matter.js) + `@agapi/stdlib` for transport.
 *
 * Controller role only (agapi commissions/controls existing Matter
 * accessories) — not a Device role, so no BLE advertising or Wifi/Thread
 * commissioning clusters. See docs/STDLIB_ROADMAP.md and environment.ts.
 */

export { createAgapiMatterEnvironment } from './environment.js';
export { createAgapiMatterController, type AgapiMatterControllerOptions } from './controller.js';
export { AgapiNetwork } from './net/AgapiNetwork.js';
export { AgapiUdpSocket } from './net/AgapiUdpSocket.js';
