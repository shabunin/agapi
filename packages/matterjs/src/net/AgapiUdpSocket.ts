import type { IUdpSocket } from '@agapi/stdlib/net';
import { ChannelType, MAX_UDP_MESSAGE_SIZE, type UdpSocket, type UdpSocketOptions } from '@matter/general';

export interface KnownInterface {
  interface: string;
  family: 'IPv4' | 'IPv6';
}

/**
 * Wraps agapi's Node-`dgram`-shaped {@link IUdpSocket} (from `@agapi/stdlib/dgram`)
 * as matter.js's own {@link UdpSocket} interface — the one real adapter matter.js
 * needs on top of agapi (Crypto/Time already self-install, see environment.ts).
 */
export class AgapiUdpSocket implements UdpSocket {
  readonly maxPayloadSize = MAX_UDP_MESSAGE_SIZE;

  constructor(
    private readonly socket: IUdpSocket,
    private readonly type: UdpSocketOptions['type'],
    // Snapshot from agapi.device.getNetworkStatus(), used only to guess which
    // local interface a packet arrived on — see onData()'s comment.
    private readonly knownInterfaces: KnownInterface[] = [],
  ) {}

  /**
   * agapi.dgram's message event doesn't report which local interface a
   * packet arrived on (rinfo has no such field) — but matter.js's own
   * UdpMulticastServer.onMessage() silently *drops every packet* where
   * netInterface is undefined (see
   * vendor/matter.js/packages/general/src/net/udp/UdpMulticastServer.ts:134).
   * Without this, raw mDNS (agapi.mdns / mdns-sd) sees a device fine while
   * matter.js's own scanner sees nothing — not a transport problem, matter.js
   * just throws away every reply. Best-effort fix: attribute the packet to
   * the first known interface with a matching address family. Wrong when a
   * host has multiple active interfaces on the same subnet (can't
   * distinguish them from the packet alone), but always non-undefined.
   */
  private guessInterface(family?: string): string | undefined {
    const wantIpv6 = family === 'IPv6';
    const match = this.knownInterfaces.find((i) => (wantIpv6 ? i.family === 'IPv6' : i.family === 'IPv4'));
    return match?.interface ?? this.knownInterfaces[0]?.interface;
  }

  get port(): number {
    return this.socket.address?.().port ?? 0;
  }

  supports(type: ChannelType, address?: string): boolean {
    if (type !== ChannelType.UDP) return false;
    if (!address) return true;
    const isIpv6 = address.includes(':');
    if (this.type === 'udp6') return isIpv6;
    if (this.type === 'udp4') return !isIpv6;
    return true; // 'udp' — dual-stack socket
  }

  addMembership(address: string): void {
    this.socket.addMembership(address);
  }

  dropMembership(address: string): void {
    this.socket.dropMembership(address);
  }

  onData(listener: UdpSocket.Callback) {
    const handler = (data: Uint8Array, rinfo: { address: string; port: number; family?: string }) => {
      listener(this.guessInterface(rinfo.family), rinfo.address, rinfo.port, data);
    };
    this.socket.on('message', handler);
    return {
      close: async () => {
        this.socket.off('message', handler);
      },
    };
  }

  send(host: string, port: number, data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.send(data, port, host, (err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.close(() => resolve());
    });
  }
}
