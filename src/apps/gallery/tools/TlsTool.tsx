import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Send, Shield } from 'lucide-react';
import { tls, Buffer } from '@agapi/stdlib';
import type { ITcpSocket } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

export default function TlsTool({ onBack }: { onBack: () => void }) {
  const [host, setHost] = useState('example.com');
  const [port, setPort] = useState('443');
  const [servername, setServername] = useState('example.com');
  const [rejectUnauthorized, setRejectUnauthorized] = useState(true);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('idle');
  const [input, setInput] = useState(
    'GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n'
  );
  const [log, setLog] = useState<string[]>([]);
  const sockRef = useRef<ITcpSocket | null>(null);

  const push = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-200), line]);
  }, []);

  const cleanup = useCallback(() => {
    try {
      sockRef.current?.destroy?.();
    } catch {
      /* ignore */
    }
    sockRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const connect = () => {
    cleanup();
    const p = parseInt(port, 10);
    if (!Number.isFinite(p)) {
      push('err: invalid port');
      return;
    }
    setStatus('connecting…');
    push(`tls.connect ${host}:${p} sni=${servername || host} rejectUnauthorized=${rejectUnauthorized}`);
    try {
      const s = tls.connect(
        {
          host,
          port: p,
          servername: servername || host,
          rejectUnauthorized,
        },
        () => {
          setConnected(true);
          setStatus('secure / connected');
          push('secureConnect / connect');
        }
      );
      sockRef.current = s;
      s.on('secureConnect', () => {
        setConnected(true);
        setStatus('secureConnect');
        push('event: secureConnect');
      });
      s.on('data', (chunk: any) => {
        const text =
          typeof chunk === 'string'
            ? chunk
            : new TextDecoder().decode(
                chunk instanceof Uint8Array
                  ? chunk
                  : Buffer.from(chunk as ArrayBufferView as any)
              );
        push(`← ${text.slice(0, 4000)}${text.length > 4000 ? '…' : ''}`);
      });
      s.on('error', (err: Error) => {
        const code = (err as any).code ? ` [${(err as any).code}]` : '';
        push(`err: ${err.message}${code}`);
        setStatus(`error${code}`);
      });
      s.on('close', () => {
        push('close');
        setConnected(false);
        setStatus('closed');
        sockRef.current = null;
      });
      s.on('end', () => push('end (peer half-close)'));
    } catch (e) {
      push(`err: ${e}`);
      setStatus('error');
    }
  };

  const send = () => {
    if (!sockRef.current) {
      push('err: not connected');
      return;
    }
    try {
      sockRef.current.write(input);
      push(`→ ${input.length} bytes`);
    } catch (e) {
      push(`err: ${e}`);
    }
  };

  return (
    <ToolShell
      title="TLS client"
      surface="agapi.tls.connect"
      status="lab"
      onBack={onBack}
      examples={examplesFor('tls')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-gray-500">
            Host
            <input
              className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Port
            <input
              className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </label>
          <label className="block text-xs text-gray-500">
            servername (SNI)
            <input
              className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
              value={servername}
              onChange={(e) => setServername(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 mt-6 cursor-pointer">
            <input
              type="checkbox"
              checked={rejectUnauthorized}
              onChange={(e) => setRejectUnauthorized(e.target.checked)}
              className="rounded border-gray-600"
            />
            rejectUnauthorized (uncheck for lab / self-signed)
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={connect}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-sm font-medium"
          >
            <Shield size={16} /> Connect TLS
          </button>
          <button
            type="button"
            onClick={cleanup}
            disabled={!connected && status === 'idle'}
            className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-900 disabled:opacity-40"
          >
            Disconnect
          </button>
          <span className="text-xs text-gray-500 font-mono ml-auto">{status}</span>
        </div>

        <label className="block text-xs text-gray-500">
          Payload to write after connect
          <textarea
            className="mt-1 w-full h-28 rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={send}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-600 text-sm font-medium"
          >
            <Send size={16} /> Write
          </button>
          <button
            type="button"
            onClick={() => setLog([])}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-400"
          >
            <Eraser size={16} /> Clear log
          </button>
        </div>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-xs font-mono text-gray-300 max-h-80 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>
      </div>
    </ToolShell>
  );
}
