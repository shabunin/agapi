/**
 * Execute gallery playground scripts against live window.agapi.
 * Not a secure sandbox — intentional local lab only.
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'sys';

export interface RunScriptResult {
  ok: boolean;
  error?: string;
}

function formatArg(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message || String(value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  try {
    return JSON.stringify(value, (_k, v) => {
      if (v instanceof Uint8Array) {
        return `<Uint8Array ${v.byteLength}>`;
      }
      if (typeof v === 'bigint') return v.toString();
      return v;
    }, 2);
  } catch {
    return String(value);
  }
}

function stripImports(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      // playground can't resolve ESM imports
      if (/^import\s+/.test(t)) return false;
      if (/^export\s+/.test(t)) return false;
      return true;
    })
    .join('\n');
}

/**
 * Run user/example source as async body with injected globals.
 * Available: agapi, CF, console, Buffer, net, dgram, http, dns, tls, mdns, crypto
 */
export async function runGalleryScript(
  source: string,
  onLog: (level: LogLevel, message: string) => void
): Promise<RunScriptResult> {
  const g = globalThis as any;
  const agapi = g.agapi;
  // Crypto-only snippets can run without full host; net/http still need agapi.
  const needsAgapi = /\bagapi\b|\bnet\b|\bdgram\b|\bhttp\b|\bdns\b|\btls\b|\bmdns\b|\bBuffer\b|\bCF\b/.test(
    source
  );
  if (needsAgapi && !agapi) {
    const msg =
      'agapi is not installed. Bootstrap installStdlib() first (Tauri host for real I/O).';
    onLog('error', msg);
    return { ok: false, error: msg };
  }

  const sandboxConsole = {
    log: (...args: unknown[]) => onLog('log', args.map(formatArg).join(' ')),
    info: (...args: unknown[]) => onLog('info', args.map(formatArg).join(' ')),
    warn: (...args: unknown[]) => onLog('warn', args.map(formatArg).join(' ')),
    error: (...args: unknown[]) => onLog('error', args.map(formatArg).join(' ')),
    debug: (...args: unknown[]) => onLog('debug', args.map(formatArg).join(' ')),
  };

  const body = stripImports(source);
  if (!body.trim()) {
    const msg = 'Nothing to run (empty or only import lines).';
    onLog('warn', msg);
    return { ok: false, error: msg };
  }

  // AsyncFunction so top-level await works in snippets
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<unknown>;

  try {
    const fn = new AsyncFunction(
      'agapi',
      'CF',
      'console',
      'Buffer',
      'net',
      'dgram',
      'http',
      'dns',
      'tls',
      'mdns',
      'crypto',
      `"use strict";\n${body}\n`
    );

    onLog('sys', '▶ run');
    const ret = await fn(
      agapi,
      g.CF ?? {},
      sandboxConsole,
      agapi?.Buffer,
      agapi?.net,
      agapi?.dgram,
      agapi?.http,
      agapi?.dns,
      agapi?.tls,
      agapi?.mdns,
      g.crypto
    );
    if (ret !== undefined) {
      onLog('log', `← ${formatArg(ret)}`);
    }
    onLog('sys', '■ done');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    onLog('error', msg);
    return { ok: false, error: msg };
  }
}
