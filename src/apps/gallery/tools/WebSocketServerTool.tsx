import React, { useEffect, useRef, useState } from 'react';
import { Play, Radio, Square } from 'lucide-react';
import { http } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

interface ClientRow {
  id: string;
  url: string;
  connectedAt: string;
}

/**
 * Live WebSocket server lab: accept connections, list clients, broadcast.
 * Custom axum-based server (agapi.http.WebSocketServer) — not the official
 * Tauri websocket plugin, which is outbound-only (see WebSocket client tool).
 */
export default function WebSocketServerTool({ onBack }: { onBack: () => void }) {
  const [port, setPort] = useState('8081');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('idle');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [message, setMessage] = useState('hello from server');
  const [log, setLog] = useState<string[]>([]);

  const serverRef = useRef<any>(null);
  const connsRef = useRef<Map<string, any>>(new Map());

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const stop = () => {
    const server = serverRef.current;
    serverRef.current = null;
    connsRef.current.clear();
    setClients([]);
    setListening(false);
    setStatus('idle');
    if (server) {
      void server.close(() => pushLog('closed'));
    }
  };

  useEffect(() => stop, []);

  const start = () => {
    stop();
    const p = parseInt(port, 10);
    if (!Number.isFinite(p) || p <= 0) {
      pushLog('err: invalid port');
      setStatus('invalid port');
      return;
    }
    setStatus('starting…');
    try {
      const Ctor = http.WebSocketServer;
      const server = new Ctor({ port: p });

      server.on('listening', () => {
        setListening(true);
        setStatus(`listening on :${p}`);
        pushLog(`listening on :${p}`);
      });

      server.on('error', (err: any) => {
        const msg = err?.message || String(err);
        pushLog(`err: ${msg}`);
        setStatus(`error: ${msg}`);
        setListening(false);
      });

      server.on('connection', (conn: any) => {
        connsRef.current.set(conn.id, conn);
        setClients((prev) => [
          ...prev,
          { id: conn.id, url: conn.url, connectedAt: new Date().toLocaleTimeString('en-GB') },
        ]);
        pushLog(`connected ${conn.id} ${conn.url || ''}`);

        conn.on('message', (data: unknown) => {
          const text = typeof data === 'string' ? data : `<binary ${(data as any)?.length ?? ''}>`;
          pushLog(`recv[${conn.id}] ${text}`);
        });

        conn.on('close', () => {
          connsRef.current.delete(conn.id);
          setClients((prev) => prev.filter((c) => c.id !== conn.id));
          pushLog(`disconnected ${conn.id}`);
        });

        conn.on('error', (err: any) => {
          pushLog(`conn err[${conn.id}] ${err?.message || err}`);
        });
      });

      serverRef.current = server;
    } catch (e) {
      pushLog(`err: ${e}`);
      setStatus(`error: ${e}`);
    }
  };

  const broadcast = () => {
    if (!message) return;
    for (const conn of connsRef.current.values()) {
      conn.send(message);
    }
    pushLog(`broadcast → ${connsRef.current.size} client(s): ${message}`);
  };

  return (
    <ToolShell
      title="WebSocket server"
      surface="agapi.http.WebSocketServer"
      status="lab"
      onBack={onBack}
      examples={examplesFor('websocket-server')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="w-28 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8081"
              disabled={listening}
            />
            {!listening ? (
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600/90 hover:bg-pink-600 text-sm font-medium"
              >
                <Play size={14} /> Listen
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-sm"
              >
                <Square size={14} /> Stop
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Status: <span className="font-mono text-gray-400">{status}</span>
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Radio size={16} className="text-pink-400" /> Clients ({clients.length})
          </h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-950/80 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Id</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2 w-24">Connected</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-600 text-xs">
                      {listening ? 'Waiting for connections…' : 'Not listening'}
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className="border-t border-gray-800/80">
                      <td className="px-3 py-2 font-mono text-xs text-gray-300">{c.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-400 truncate max-w-[14rem]">
                        {c.url}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{c.connectedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="message to broadcast"
            />
            <button
              type="button"
              onClick={broadcast}
              disabled={!listening || clients.length === 0}
              className="px-4 py-2 rounded-lg bg-pink-600/90 hover:bg-pink-600 text-sm font-medium disabled:opacity-40"
            >
              Broadcast
            </button>
          </div>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Needs Tauri host. Custom axum-based server — outbound WS client is a separate
          tool backed by the official Tauri plugin.
        </p>
      </div>
    </ToolShell>
  );
}
