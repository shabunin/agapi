import { LineBuffer, encodeLine } from './framing.js';
import type { TcpConnection, TcpTransport } from './transport.js';

/**
 * SimpleDevice — abstract line-oriented power switch used as a **driver template**.
 * Copy this package when starting a real brand protocol.
 *
 * Wire commands (always end with CRLF):
 *   power on\r\n   → device replies with a line (e.g. OK)
 *   power off\r\n  → …
 *   power ?\r\n    → power on | power off  (query)
 */

export type PowerState = 'on' | 'off' | 'unknown';

export interface SimpleDeviceOptions {
  host: string;
  port: number;
  /** Max wait for a reply line after a command. Default 3000 ms. */
  responseTimeoutMs?: number;
}

export class SimpleDevice {
  readonly host: string;
  readonly port: number;
  private readonly responseTimeoutMs: number;
  private conn: TcpConnection | null = null;
  private connecting: Promise<void> | null = null;
  private lines = new LineBuffer();
  // TextDecoder holds carry-over bytes for a multi-byte char split across chunks —
  // must be one instance for the connection's lifetime, not per-chunk.
  private decoder = new TextDecoder();
  private waiters: Array<{
    resolve: (line: string) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  // Replies still owed by the device for requests we've already given up on
  // (timed out). The wire is still FIFO, so the next line(s) in are those
  // late replies, not the answer to whatever's queued next — drop them
  // instead of misattributing them to the next real waiter.
  private stale = 0;

  constructor(
    private readonly transport: TcpTransport,
    opts: SimpleDeviceOptions,
  ) {
    this.host = opts.host;
    this.port = opts.port;
    this.responseTimeoutMs = opts.responseTimeoutMs ?? 3000;
  }

  get connected(): boolean {
    return this.conn !== null;
  }

  connect(): Promise<void> {
    if (this.conn) return Promise.resolve();
    // Coalesce concurrent callers onto one in-flight attempt — otherwise each
    // opens its own socket and only the last one ends up on `this.conn`.
    if (!this.connecting) {
      this.connecting = this.doConnect().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private async doConnect(): Promise<void> {
    const conn = await this.transport.connect(this.host, this.port);
    this.conn = conn;
    this.lines.clear();
    this.decoder = new TextDecoder();
    this.stale = 0;

    conn.onData((chunk) => {
      const text = this.decoder.decode(chunk, { stream: true });
      let lines: string[];
      try {
        lines = this.lines.push(text);
      } catch (err) {
        // Unterminated stream (see LineBuffer's MAX_BUFFERED_CHARS) — treat like
        // any other transport error rather than growing memory forever.
        this.failAll(err instanceof Error ? err : new Error(String(err)));
        conn.destroy();
        return;
      }
      for (const line of lines) {
        this.deliver(line);
      }
    });
    conn.onError((err) => {
      this.failAll(err);
    });
    conn.onClose(() => {
      if (this.conn !== conn) return; // stale handler from a superseded connection
      this.conn = null;
      this.failAll(new Error('connection closed'));
    });
  }

  disconnect(): void {
    this.failAll(new Error('disconnected'));
    this.conn?.destroy();
    this.conn = null;
    this.lines.clear();
  }

  /** Send raw line (CRLF added). Resolves with the next reply line. */
  async request(command: string): Promise<string> {
    if (!this.conn) throw new Error('not connected — call connect() first');
    const payload = encodeLine(command);
    const reply = this.waitForLine();
    this.conn.write(payload);
    return reply;
  }

  powerOn(): Promise<string> {
    return this.request('power on');
  }

  powerOff(): Promise<string> {
    return this.request('power off');
  }

  /**
   * Query power. Parses common reply shapes:
   *   "power on" / "power off" / "ON" / "OFF" / "1" / "0"
   */
  async queryPower(): Promise<{ state: PowerState; raw: string }> {
    const raw = await this.request('power ?');
    return { state: parsePowerReply(raw), raw };
  }

  private waitForLine(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer);
        if (i >= 0) this.waiters.splice(i, 1);
        this.stale++;
        reject(new Error(`timeout waiting for reply (${this.responseTimeoutMs}ms)`));
      }, this.responseTimeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private deliver(line: string) {
    if (this.stale > 0) {
      this.stale--; // late reply to an abandoned request — see `stale` above
      return;
    }
    const w = this.waiters.shift();
    if (!w) return; // unsolicited line — ignore for this template
    clearTimeout(w.timer);
    w.resolve(line);
  }

  private failAll(err: Error) {
    const pending = this.waiters.splice(0);
    for (const w of pending) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }
}

export function parsePowerReply(line: string): PowerState {
  const s = line.trim().toLowerCase();
  if (s === 'power on' || s === 'on' || s === '1' || s.endsWith(' on')) return 'on';
  if (s === 'power off' || s === 'off' || s === '0' || s.endsWith(' off')) return 'off';
  return 'unknown';
}
