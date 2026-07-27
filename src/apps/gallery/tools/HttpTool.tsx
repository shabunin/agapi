import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { http } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;

/**
 * HTTP client lab on agapi.http (host-backed in Tauri).
 */
export default function HttpTool({ onBack }: { onBack: () => void }) {
  const [method, setMethod] = useState<(typeof METHODS)[number]>('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [headersText, setHeadersText] = useState('{\n  "Accept": "application/json"\n}');
  const [body, setBody] = useState('');
  /** false = accept invalid cert/hostname (default for local gear) */
  const [rejectUnauthorized, setRejectUnauthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState('');
  const [respHeaders, setRespHeaders] = useState('');
  const [respBody, setRespBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setBusy(true);
    setError(null);
    setStatusLine('');
    setRespHeaders('');
    setRespBody('');

    let headers: Record<string, string> = {};
    try {
      headers = headersText.trim() ? JSON.parse(headersText) : {};
    } catch (e) {
      setError(`Headers JSON: ${e}`);
      setBusy(false);
      return;
    }

    try {
      const req = http.request(
        {
          url,
          method,
          headers,
          rejectUnauthorized,
        },
        (res: any) => {
          const chunks: Uint8Array[] = [];
          res.on('data', (chunk: Uint8Array | string) => {
            if (typeof chunk === 'string') {
              chunks.push(new TextEncoder().encode(chunk));
            } else {
              chunks.push(chunk);
            }
          });
          res.on('end', () => {
            const total = chunks.reduce((n, c) => n + c.length, 0);
            const buf = new Uint8Array(total);
            let o = 0;
            for (const c of chunks) {
              buf.set(c, o);
              o += c.length;
            }
            const text = new TextDecoder().decode(buf);
            setStatusLine(`${res.statusCode ?? '?'} ${res.statusMessage ?? ''}`.trim());
            setRespHeaders(
              Object.entries(res.headers || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')
            );
            setRespBody(text.slice(0, 200_000));
            setBusy(false);
          });
        }
      );

      req.on('error', (err: Error) => {
        setError(err.message || String(err));
        setBusy(false);
      });

      if (body && method !== 'GET' && method !== 'HEAD') {
        req.write(body);
      }
      req.end();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="HTTP"
      surface="agapi.http.request"
      status="lab"
      onBack={onBack}
      examples={examplesFor('http')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium disabled:opacity-50"
          >
            <Send size={16} />
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-3 rounded-xl bg-gray-900/50 border border-gray-800">
          <input
            type="checkbox"
            checked={!rejectUnauthorized}
            onChange={(e) => setRejectUnauthorized(!e.target.checked)}
            className="rounded border-gray-600"
          />
          <span>
            <span className="font-medium">Skip certificate verification</span>
            <span className="block text-xs text-gray-500">
              rejectUnauthorized: false — accept self-signed / hostname mismatch
            </span>
          </span>
        </label>

        <label className="block text-xs text-gray-500">
          Headers (JSON object)
          <textarea
            className="mt-1 w-full h-24 rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
          />
        </label>

        <label className="block text-xs text-gray-500">
          Body
          <textarea
            className="mt-1 w-full h-24 rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="raw body for POST/PUT/…"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {statusLine && (
          <div className="text-sm font-mono text-violet-300">{statusLine}</div>
        )}

        {respHeaders && (
          <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-xs font-mono text-gray-400 overflow-auto max-h-40 whitespace-pre-wrap">
            {respHeaders}
          </pre>
        )}

        {respBody && (
          <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-xs font-mono text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
            {respBody}
          </pre>
        )}

        <p className="text-xs text-gray-600">
          Needs Tauri. Skip verification only disables cert checks — not broken TLS
          ciphers.
        </p>
      </div>
    </ToolShell>
  );
}
