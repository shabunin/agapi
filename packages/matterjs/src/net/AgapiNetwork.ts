import { device, dgram } from '@agapi/stdlib';
import type { IUdpSocket } from '@agapi/stdlib/net';
import {
  InterfaceType,
  Network,
  type NetworkInterface,
  type NetworkInterfaceDetails,
  type UdpSocket,
  type UdpSocketOptions,
} from '@matter/general';
import { AgapiUdpSocket, type KnownInterface } from './AgapiUdpSocket.js';

/**
 * matter.js `Network` implementation backed by `@agapi/stdlib` (agapi.dgram +
 * agapi.device) instead of Node's `dgram` / `os.networkInterfaces()`.
 *
 * TCP is intentionally left unimplemented: `Network.createTcpListener` /
 * `connectTcp` already default to throwing "not supported on this platform"
 * in the base class, which is correct — Matter's core operational protocol
 * is UDP, and we're not implementing a Device role that would need TCP.
 *
 * Precondition: `installStdlib(createTauriHost())` must already have run —
 * this calls straight into `agapi.dgram` / `agapi.device`.
 */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * `if_addrs::get_if_addrs()` doesn't return a hardware MAC, but Matter's
 * GeneralDiagnostics.HardwareAddress attribute requires a fixed byte length
 * regardless (empty fails constraint validation and crashes node startup).
 * Synthesize a stable one per interface name, with the locally-administered
 * bit set — the same convention virtual NICs (Docker, VMs, …) use to mark
 * "not a real burned-in address," rather than lying with an all-zero one.
 */
function syntheticMac(seed: string): string {
  const h1 = fnv1a(seed);
  const h2 = fnv1a(`${seed}#2`, 0x9e3779b9);
  const bytes = [(h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, h1 & 0xff, (h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff];
  bytes[0] = (bytes[0] & 0xfc) | 0x02; // locally-administered + unicast bits
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(':');
}

export class AgapiNetwork extends Network {
  async getNetInterfaces(): Promise<NetworkInterface[]> {
    const status = await device.getNetworkStatus();
    const names = new Set(status.addresses.map((a) => a.interface));
    return [...names].map((name) => ({
      name,
      // agapi.device only guesses wifi/ethernet/other for the *whole host*
      // (see NetworkStatus.networkType) — no per-interface type today.
      type: InterfaceType.Unspecified,
    }));
  }

  async getIpMac(netInterface: string): Promise<NetworkInterfaceDetails | undefined> {
    const status = await device.getNetworkStatus();
    const addrs = status.addresses.filter((a) => a.interface === netInterface);
    if (addrs.length === 0) return undefined;
    return {
      // Synthetic, not a real hardware MAC (see syntheticMac() doc) —
      // if_addrs doesn't give us one, but Matter requires a fixed-length
      // value here regardless of that gap.
      mac: syntheticMac(netInterface),
      ipV4: addrs.filter((a) => a.family === 'IPv4').map((a) => a.address),
      ipV6: addrs.filter((a) => a.family === 'IPv6').map((a) => a.address),
    };
  }

  async createUdpSocket(options: UdpSocketOptions): Promise<UdpSocket> {
    // 'udp' (dual-stack) isn't distinguished by agapi.dgram — fall back to udp4.
    const type = options.type === 'udp6' ? 'udp6' : 'udp4';
    // matter.js's multicast sockets pass reuseAddress: true (several sockets
    // share the same mDNS port) — agapi.dgram only takes this at socket
    // creation time, not on bind(), so it has to go here.
    //
    // ipv6Only: true matches Node's own dgram default for 'udp6' sockets.
    // Our Rust udp_bind leaves IPV6_V6ONLY unset otherwise, and on Linux that
    // defaults to dual-stack — a udp6 wildcard bind on port P then silently
    // claims the IPv4 port-P space too, so matter.js's later same-port udp4
    // bind (it wants matching v4/v6 port numbers) fails EADDRINUSE even
    // though nothing else is actually using that port.
    const socket = dgram.createSocket({
      type,
      reuseAddr: options.reuseAddress,
      ipv6Only: type === 'udp6' ? true : undefined,
    }) as IUdpSocket;
    const port = options.listeningPort ?? 0;

    await new Promise<void>((resolve, reject) => {
      // matter.js's own mDNS multicast server treats a udp6 bind failure as
      // fatal (it requires IPv6, no IPv4 fallback — see
      // vendor/matter.js/packages/general/src/net/udp/UdpMulticastServer.ts).
      // If the host bind never calls back or errors, surface that loudly
      // after a timeout instead of hanging createUdpSocket() — and whatever
      // awaits it — forever with zero feedback.
      const timer = setTimeout(() => {
        reject(new Error(`UDP bind timed out (${type}, port ${port}) — is ${type === 'udp6' ? 'IPv6' : 'IPv4'} available on this host?`));
      }, 5000);
      socket.once('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
      // options.netInterface (required by matter.js for multicast) has no
      // equivalent bind-time knob in agapi.dgram today — membership is still
      // joined correctly via addMembership below, this only affects which
      // local address the OS picks for an unspecified bind.
      socket.bind(port, options.listeningAddress, () => {
        clearTimeout(timer);
        resolve();
      });
    });

    // Snapshot for AgapiUdpSocket's best-effort netInterface attribution
    // (see its onData() doc comment) — no interfaces means no attribution,
    // not a hard failure.
    const knownInterfaces: KnownInterface[] = await device
      .getNetworkStatus()
      .then((status) => status.addresses.map((a) => ({ interface: a.interface, family: a.family })))
      .catch(() => []);

    return new AgapiUdpSocket(socket, type, knownInterfaces);
  }
}
