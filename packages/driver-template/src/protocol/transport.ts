/**
 * Transport seams for a line-oriented TCP device.
 * Protocol code never imports agapi / node / tauri — only these shapes.
 */

/** One live TCP connection (already connected). */
export interface TcpConnection {
  write(data: string | Uint8Array): void;
  /** Subscribe to inbound chunks (may be partial lines). */
  onData(cb: (chunk: Uint8Array) => void): void;
  onClose(cb: (err?: Error) => void): void;
  onError(cb: (err: Error) => void): void;
  destroy(): void;
}

/** Factory: open a connection to host:port. */
export interface TcpTransport {
  connect(host: string, port: number): Promise<TcpConnection>;
}
