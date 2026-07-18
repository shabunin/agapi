import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Cable,
  Circle,
  Eraser,
  Radio,
  Send,
  Server,
  Square,
  Trash2,
} from 'lucide-react';
import { net, dgram, Buffer } from '@agapi/stdlib';
import type { ITcpSocket, ITcpServer, IUdpSocket } from '@agapi/stdlib';

export interface NcAppProps {
  onBack?: () => void;
}

type Transport = 'tcp-client' | 'tcp-server' | 'udp';
type LineKind = 'rx' | 'tx' | 'sys' | 'err';

interface LogLine {
  id: number;
  t: string;
  kind: LineKind;
  text: string;
}

let logSeq = 0;

function nowTime() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function formatPayload(data: string | Uint8Array | ArrayBufferView, asHex: boolean): string {
  let u8: Uint8Array;
  if (typeof data === 'string') {
    return asHex ? Buffer.from(data).toString('hex') : data;
  }
  if (data instanceof Uint8Array) u8 = data;
  else u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (asHex) return Buffer.from(u8).toString('hex');
  try {
    return new TextDecoder().decode(u8);
  } catch {
    return Buffer.from(u8).toString('hex');
  }
}

/**
 * Minimal netcat-like console — uses only @agapi/stdlib (no CF / Pixi).
 */
export default function NcApp({ onBack }: NcAppProps) {
  const [transport, setTransport] = useState<Transport>('tcp-client');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('9000');
  const [localPort, setLocalPort] = useState('0');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('idle');
  const [input, setInput] = useState('');
  const [hexMode, setHexMode] = useState(false);
  const [appendNewline, setAppendNewline] = useState(true);
  const [lines, setLines] = useState<LogLine[]>([]);

  const tcpSocketRef = useRef<ITcpSocket | null>(null);
  const tcpServerRef = useRef<ITcpServer | null>(null);
  const clientsRef = useRef<Set<ITcpSocket>>(new Set());
  const udpSocketRef = useRef<IUdpSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const hexModeRef = useRef(hexMode);
  hexModeRef.current = hexMode;

  const pushLog = useCallback((kind: LineKind, text: string) => {
    setLines((prev) => {
      const next = [
        ...prev,
        { id: ++logSeq, t: nowTime(), kind, text },
      ];
      // cap log
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const cleanup = useCallback(() => {
    try {
      tcpSocketRef.current?.destroy?.();
    } catch { /* ignore */ }
    tcpSocketRef.current = null;

    for (const c of clientsRef.current) {
      try {
        c.destroy?.();
      } catch { /* ignore */ }
    }
    clientsRef.current.clear();

    try {
      tcpServerRef.current?.close?.();
    } catch { /* ignore */ }
    tcpServerRef.current = null;

    try {
      udpSocketRef.current?.close?.();
    } catch { /* ignore */ }
    udpSocketRef.current = null;

    setConnected(false);
    setStatus('idle');
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const bindTcpClientEvents = (sock: ITcpSocket) => {
    sock.on('connect', () => {
      setConnected(true);
      setStatus(`tcp connected ${sock.remoteAddress}:${sock.remotePort}`);
      pushLog('sys', `Connected to ${sock.remoteAddress}:${sock.remotePort}`);
    });
    sock.on('data', (chunk: any) => {
      pushLog('rx', formatPayload(chunk, hexModeRef.current));
    });
    sock.on('error', (err: Error) => {
      const code = (err as any).code ? ` [${(err as any).code}]` : '';
      pushLog('err', `${err.message}${code}`);
      setStatus(`error${code}`);
    });
    sock.on('close', () => {
      pushLog('sys', 'Connection closed');
      setConnected(false);
      setStatus('closed');
      tcpSocketRef.current = null;
    });
    sock.on('end', () => {
      pushLog('sys', 'Peer half-closed (end)');
    });
  };

  const openSession = () => {
    cleanup();
    const p = parseInt(port, 10);
    if (!Number.isFinite(p) || p < 0 || p > 65535) {
      pushLog('err', 'Invalid port');
      return;
    }

    if (transport === 'tcp-client') {
      pushLog('sys', `TCP connect ${host}:${p} …`);
      setStatus('connecting…');
      try {
        const sock = net.connect(p, host);
        tcpSocketRef.current = sock;
        bindTcpClientEvents(sock);
      } catch (e) {
        pushLog('err', String(e));
      }
      return;
    }

    if (transport === 'tcp-server') {
      pushLog('sys', `TCP listen 0.0.0.0:${p} …`);
      setStatus('listening…');
      try {
        const server = net.createServer((client) => {
          clientsRef.current.add(client);
          const peer = `${client.remoteAddress}:${client.remotePort}`;
          pushLog('sys', `Client connected ${peer}`);
          setConnected(true);
          setStatus(`tcp server · clients=${clientsRef.current.size}`);

          client.on('data', (chunk: any) => {
            pushLog('rx', `[${peer}] ${formatPayload(chunk, hexModeRef.current)}`);
          });
          client.on('error', (err: Error) => {
            pushLog('err', `[${peer}] ${err.message}`);
          });
          client.on('close', () => {
            clientsRef.current.delete(client);
            pushLog('sys', `Client closed ${peer}`);
            setStatus(`tcp server · clients=${clientsRef.current.size}`);
            if (clientsRef.current.size === 0) setConnected(false);
          });
        });

        server.on('error', (err: Error) => {
          const code = (err as any).code ? ` [${(err as any).code}]` : '';
          pushLog('err', `Server error: ${err.message}${code}`);
          setStatus(`error${code}`);
        });
        server.on('listening', () => {
          const addr = server.address();
          pushLog('sys', `Listening on ${addr?.address}:${addr?.port}`);
          setStatus(`listening ${addr?.port}`);
          setConnected(true);
        });
        server.listen(p, '0.0.0.0');
        tcpServerRef.current = server;
      } catch (e) {
        pushLog('err', String(e));
      }
      return;
    }

    // UDP
    const lp = parseInt(localPort, 10) || 0;
    pushLog('sys', `UDP bind localPort=${lp || 'ephemeral'} …`);
    setStatus('binding…');
    try {
      const sock = dgram.createSocket('udp4');
      udpSocketRef.current = sock;

      sock.on('listening', () => {
        const a = sock.address?.();
        pushLog('sys', `UDP bound ${a?.address ?? '?'}:${a?.port ?? '?'}`);
        setStatus(`udp bound ${a?.port ?? lp}`);
        setConnected(true);
      });
      sock.on('message', (msg: any, rinfo: any) => {
        pushLog(
          'rx',
          `[${rinfo?.address}:${rinfo?.port}] ${formatPayload(msg, hexModeRef.current)}`
        );
      });
      sock.on('error', (err: Error) => {
        const code = (err as any).code ? ` [${(err as any).code}]` : '';
        pushLog('err', `UDP error: ${err.message}${code}`);
        setStatus(`error${code}`);
      });
      sock.on('close', () => {
        pushLog('sys', 'UDP closed');
        setConnected(false);
        setStatus('closed');
      });

      // bind overload: bind(port, address?, cb) or bind(port, cb)
      if (lp > 0) sock.bind(lp, '0.0.0.0');
      else sock.bind(0, '0.0.0.0');
    } catch (e) {
      pushLog('err', String(e));
    }
  };

  const sendPayload = () => {
    if (!input.length && !appendNewline) return;

    let payload: string | Uint8Array = input;
    if (hexMode) {
      const clean = input.replace(/[^0-9a-fA-F]/g, '');
      if (clean.length % 2 !== 0) {
        pushLog('err', 'Hex payload must have even length');
        return;
      }
      payload = Buffer.from(clean, 'hex');
    } else if (appendNewline) {
      payload = input + '\n';
    }

    const display = formatPayload(
      typeof payload === 'string' ? payload : payload,
      hexMode
    );

    try {
      if (transport === 'tcp-client' && tcpSocketRef.current) {
        tcpSocketRef.current.write(payload as any);
        pushLog('tx', display);
      } else if (transport === 'tcp-server') {
        if (clientsRef.current.size === 0) {
          pushLog('err', 'No connected clients');
          return;
        }
        for (const c of clientsRef.current) {
          c.write(payload as any);
        }
        pushLog('tx', `[broadcast×${clientsRef.current.size}] ${display}`);
      } else if (transport === 'udp' && udpSocketRef.current) {
        const p = parseInt(port, 10);
        const buf =
          typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(payload);
        udpSocketRef.current.send(buf, 0, buf.length, p, host, (err) => {
          if (err) pushLog('err', `send: ${err.message}`);
        });
        pushLog('tx', `→ ${host}:${p} ${display}`);
      } else {
        pushLog('err', 'Not connected / not listening');
        return;
      }
      setInput('');
    } catch (e) {
      pushLog('err', String(e));
    }
  };

  const kindColor: Record<LineKind, string> = {
    rx: 'text-emerald-400',
    tx: 'text-sky-400',
    sys: 'text-gray-500',
    err: 'text-red-400',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center gap-3 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={() => {
              cleanup();
              onBack();
            }}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <TerminalIcon />
          <div>
            <h1 className="font-semibold text-lg leading-tight">NC Console</h1>
            <p className="text-xs text-gray-500">stdlib net / dgram · no CF</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-gray-700 bg-gray-800 text-gray-400'
            }`}
          >
            <Circle size={8} className={connected ? 'fill-emerald-400' : 'fill-gray-600'} />
            {status}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Controls */}
        <aside className="md:w-80 border-b md:border-b-0 md:border-r border-gray-800 p-4 space-y-4 shrink-0 overflow-auto">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transport</label>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {(
                [
                  { id: 'tcp-client' as const, label: 'TCP Client', icon: Cable },
                  { id: 'tcp-server' as const, label: 'TCP Server', icon: Server },
                  { id: 'udp' as const, label: 'UDP', icon: Radio },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  disabled={connected && transport !== id}
                  onClick={() => setTransport(id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    transport === id
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  } disabled:opacity-40`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {(transport === 'tcp-client' || transport === 'udp') && (
              <div>
                <label className="text-xs text-gray-500">Host / remote</label>
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  disabled={connected && transport !== 'udp'}
                  className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-600"
                  placeholder="127.0.0.1"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">
                {transport === 'tcp-server' ? 'Listen port' : 'Port'}
              </label>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={connected && transport !== 'udp'}
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-600"
              />
            </div>
            {transport === 'udp' && (
              <div>
                <label className="text-xs text-gray-500">Local bind port (0 = ephemeral)</label>
                <input
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  disabled={connected}
                  className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-600"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!connected ? (
              <button
                type="button"
                onClick={openSession}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                {transport === 'tcp-server' ? 'Listen' : transport === 'udp' ? 'Bind' : 'Connect'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  cleanup();
                  pushLog('sys', 'Closed by user');
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                <Square size={14} />
                Close
              </button>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={hexMode}
                onChange={(e) => setHexMode(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500"
              />
              Hex mode (send/display)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={appendNewline}
                onChange={(e) => setAppendNewline(e.target.checked)}
                disabled={hexMode}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500"
              />
              Append \\n on send
            </label>
          </div>

          <button
            type="button"
            onClick={() => setLines([])}
            className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 text-sm py-2"
          >
            <Trash2 size={14} />
            Clear log
          </button>
        </aside>

        {/* Terminal */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 overflow-auto p-3 font-mono text-xs md:text-sm leading-relaxed bg-black/40">
            {lines.length === 0 && (
              <p className="text-gray-600 italic">
                Log empty. Choose transport, open a socket, then send data.
                Requires Tauri host for real sockets (mock in plain browser).
              </p>
            )}
            {lines.map((l) => (
              <div key={l.id} className="flex gap-2 hover:bg-white/[0.02] px-1 rounded">
                <span className="text-gray-600 shrink-0 select-none">{l.t}</span>
                <span className={`shrink-0 w-7 font-bold ${kindColor[l.kind]}`}>
                  {l.kind.toUpperCase()}
                </span>
                <span className={`break-all whitespace-pre-wrap ${kindColor[l.kind]}`}>
                  {l.text}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          <form
            className="border-t border-gray-800 p-3 flex gap-2 bg-gray-900/50"
            onSubmit={(e) => {
              e.preventDefault();
              sendPayload();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                hexMode ? 'hex bytes e.g. 48656c6c6f' : 'type payload and Enter…'
              }
              className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-cyan-600"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="flex items-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white px-5 rounded-xl font-medium shrink-0"
            >
              <Send size={16} />
              Send
            </button>
            <button
              type="button"
              onClick={() => setInput('')}
              className="p-3 rounded-xl border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600"
              title="Clear input"
            >
              <Eraser size={16} />
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

function TerminalIcon() {
  return (
    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
      <Radio size={18} />
    </div>
  );
}
