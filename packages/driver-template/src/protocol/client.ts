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
  private lines = new LineBuffer();
  private waiters: Array<{
    resolve: (line: string) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

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

  async connect(): Promise<void> {
    if (this.conn) return;
    const conn = await this.transport.connect(this.host, this.port);
    this.conn = conn;
    this.lines.clear();

    conn.onData((chunk) => {
      const text = new TextDecoder().decode(chunk);
      for (const line of this.lines.push(text)) {
        this.deliver(line);
      }
    });
    conn.onError((err) => {
      this.failAll(err);
    });
    conn.onClose(() => {
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
        reject(new Error(`timeout waiting for reply (${this.responseTimeoutMs}ms)`));
      }, this.responseTimeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private deliver(line: string) {
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
