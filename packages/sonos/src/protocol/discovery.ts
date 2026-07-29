import { buildSearchRequest, parseSearchResponse, SSDP_MULTICAST_ADDRESS, SSDP_PORT, type SsdpResponse } from './ssdp.js';

/**
 * Minimal transport seam — just enough for SSDP send/receive. Node's
 * `dgram.Socket` and `agapi.dgram`'s `IUdpSocket` both satisfy this directly.
 */
export interface DiscoverySocket {
  send(data: Uint8Array, port: number, address: string): void;
  onMessage(cb: (data: Uint8Array, rinfo: { address: string }) => void): void;
  close(): void;
}

/** Sends one M-SEARCH, collects replies for `timeoutMs`, then closes the socket. */
export function discover(
  socket: DiscoverySocket,
  onDevice: (device: SsdpResponse) => void,
  timeoutMs = 5000,
): Promise<SsdpResponse[]> {
  return new Promise((resolve) => {
    const found = new Map<string, SsdpResponse>();
    socket.onMessage((data, rinfo) => {
      const res = parseSearchResponse(data, rinfo.address);
      if (res && !found.has(res.address)) {
        found.set(res.address, res);
        onDevice(res);
      }
    });
    socket.send(buildSearchRequest(), SSDP_PORT, SSDP_MULTICAST_ADDRESS);
    setTimeout(() => {
      socket.close();
      resolve([...found.values()]);
    }, timeoutMs);
  });
}
