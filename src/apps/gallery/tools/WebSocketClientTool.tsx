import React, { useEffect, useRef, useState } from 'react';
import { Plug, Unplug } from 'lucide-react';
import { http } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

const STATE_LABEL: Record<number, string> = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED',
};

const STATE_CLASS: Record<number, string> = {
  0: 'text-amber-300',
  1: 'text-lime-300',
  2: 'text-amber-300',
  3: 'text-gray-500',
};

/**
 * Live WebSocket client lab. Toggles between `agapi.http.WebSocket`
 * (MDN-compatible, backed by @tauri-apps/plugin-websocket) and the plain
 * global `WebSocket` (browser/webview's own stack, untouched by stdlib) —
 * both expose the same onopen/onmessage/onerror/onclose shape. Dials out
 * to a remote server — the counterpart to the WebSocket server tool, which
 * accepts inbound connections instead.
 */
export default function WebSocketClientTool({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState('wss://ws.postman-echo.com/raw');
  const [useNative, setUseNative] = useState(false);
  const [readyState, setReadyState] = useState(3);
  const [message, setMessage] = useState('hello from agapi');
  const [log, setLog] = useState<string[]>([]);
  const wsRef = useRef<any>(null);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const disconnect = () => {
    wsRef.current?.close();
  };

  useEffect(() => disconnect, []);

  const connect = () => {
    disconnect();
    try {
      const Ctor = useNative ? WebSocket : http.WebSocket;
      const ws = new Ctor(url);
      wsRef.current = ws;
      setReadyState(ws.readyState);

      ws.onopen = () => {
        setReadyState(ws.readyState);
        pushLog('open');
      };
      ws.onmessage = (ev: MessageEvent) => {
        const data = ev.data;
        if (typeof data === 'string') {
          pushLog(`recv ${data}`);
        } else if (data instanceof Blob) {
          pushLog(`recv <blob ${data.size}b>`);
        } else if (data instanceof ArrayBuffer) {
          pushLog(`recv <binary ${data.byteLength}b>`);
        } else {
          pushLog(`recv ${String(data)}`);
        }
      };
      ws.onerror = () => {
        setReadyState(ws.readyState);
        pushLog('error');
      };
      ws.onclose = (ev: CloseEvent) => {
        setReadyState(ws.readyState);
        pushLog(`closed code=${ev.code} reason=${ev.reason || ''}`);
      };

      pushLog(`connecting ${url}`);
    } catch (e) {
      pushLog(`err: ${e}`);
    }
  };

  const send = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    ws.send(message);
    pushLog(`sent ${message}`);
  };

  const connected = readyState === 0 || readyState === 1;

  return (
    <ToolShell
      title="WebSocket client"
      surface={useNative ? 'WebSocket (browser)' : 'agapi.http.WebSocket'}
      status="lab"
      onBack={onBack}
      examples={examplesFor('websocket-client')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setUseNative(false)}
            disabled={connected}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
              !useNative
                ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40'
                : 'bg-gray-900/50 text-gray-500 border border-gray-800 hover:text-gray-300'
            }`}
          >
            agapi.http.WebSocket
          </button>
          <button
            type="button"
            onClick={() => setUseNative(true)}
            disabled={connected}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
              useNative
                ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40'
                : 'bg-gray-900/50 text-gray-500 border border-gray-800 hover:text-gray-300'
            }`}
          >
            WebSocket (browser)
          </button>
        </div>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://…"
              disabled={connected}
            />
            {!connected ? (
              <button
                type="button"
                onClick={connect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-600/90 hover:bg-lime-600 text-sm font-medium text-gray-950"
              >
                <Plug size={14} /> Connect
              </button>
            ) : (
              <button
                type="button"
                onClick={disconnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-sm"
              >
                <Unplug size={14} /> Disconnect
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            State:{' '}
            <span className={`font-mono ${STATE_CLASS[readyState] ?? 'text-gray-400'}`}>
              {STATE_LABEL[readyState] ?? readyState}
            </span>
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200">Send</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="message"
            />
            <button
              type="button"
              onClick={send}
              disabled={readyState !== 1}
              className="px-4 py-2 rounded-lg bg-lime-600/90 hover:bg-lime-600 text-sm font-medium text-gray-950 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-56 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          {useNative
            ? "Plain global WebSocket — the browser/webview's own stack, untouched by stdlib."
            : 'agapi.http.WebSocket — MDN-compatible, backed by @tauri-apps/plugin-websocket.'}{' '}
          Default URL is Postman's public WS echo endpoint. Both are outbound only.
        </p>
      </div>
    </ToolShell>
  );
}
