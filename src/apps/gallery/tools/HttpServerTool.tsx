import React, { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { http } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

interface ReqRow {
  key: string;
  method: string;
  url: string;
  headerCount: number;
  at: string;
}

/**
 * Live HTTP server lab: listen, inspect incoming requests, reply with a
 * canned status/body/content-type (editable while the server is running).
 */
export default function HttpServerTool({ onBack }: { onBack: () => void }) {
  const [port, setPort] = useState('8080');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('idle');
  const [statusCode, setStatusCode] = useState('200');
  const [contentType, setContentType] = useState('application/json');
  const [responseBody, setResponseBody] = useState('{\n  "ok": true\n}');
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const serverRef = useRef<any>(null);
  const seqRef = useRef(0);
  // Kept fresh so an in-flight server always replies with the latest edits,
  // not whatever the fields held at the moment `start()` was clicked.
  const statusCodeRef = useRef(statusCode);
  const contentTypeRef = useRef(contentType);
  const responseBodyRef = useRef(responseBody);
  useEffect(() => {
    statusCodeRef.current = statusCode;
  }, [statusCode]);
  useEffect(() => {
    contentTypeRef.current = contentType;
  }, [contentType]);
  useEffect(() => {
    responseBodyRef.current = responseBody;
  }, [responseBody]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const stop = () => {
    const server = serverRef.current;
    serverRef.current = null;
    setListening(false);
    setStatus('idle');
    if (server) {
      server.close(() => pushLog('closed'));
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
      const server = http.createServer((req: any, res: any) => {
        const key = `req-${++seqRef.current}`;
        setRows((prev) => [
          {
            key,
            method: req.method,
            url: req.url,
            headerCount: Object.keys(req.headers || {}).length,
            at: new Date().toLocaleTimeString('en-GB'),
          },
          ...prev.slice(0, 49),
        ]);
        pushLog(`${req.method} ${req.url}`);

        const code = parseInt(statusCodeRef.current, 10) || 200;
        res.writeHead(code, { 'Content-Type': contentTypeRef.current || 'text/plain' });
        res.end(responseBodyRef.current);
      });
      server.on('error', (err: any) => {
        const msg = err?.message || String(err);
        pushLog(`err: ${msg}`);
        setStatus(`error: ${msg}`);
        setListening(false);
      });
      server.listen(p, () => {
        setListening(true);
        setStatus(`listening on :${p}`);
        pushLog(`listening on :${p}`);
      });
      serverRef.current = server;
    } catch (e) {
      pushLog(`err: ${e}`);
      setStatus(`error: ${e}`);
    }
  };

  return (
    <ToolShell
      title="HTTP server"
      surface="agapi.http.createServer"
      status="lab"
      onBack={onBack}
      examples={examplesFor('http-server')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="w-28 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8080"
              disabled={listening}
            />
            {!listening ? (
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-sm font-medium"
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
          <h2 className="text-sm font-semibold text-gray-200">Canned response</h2>
          <p className="text-xs text-gray-500">
            Every request gets this reply. Edit while the server is running — the next
            request picks up the change.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={statusCode}
              onChange={(e) => setStatusCode(e.target.value)}
              placeholder="status (200)"
            />
            <input
              className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              placeholder="Content-Type"
            />
          </div>
          <textarea
            className="w-full h-24 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={responseBody}
            onChange={(e) => setResponseBody(e.target.value)}
            placeholder="response body"
          />
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200">Incoming requests</h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-950/80 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 w-20">Method</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2 w-24">Headers</th>
                  <th className="px-3 py-2 w-20">Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-600 text-xs">
                      {listening ? 'Waiting for requests…' : 'Not listening'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key} className="border-t border-gray-800/80">
                      <td className="px-3 py-2 font-mono text-xs text-blue-300">{r.method}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-300 truncate max-w-[16rem]">
                        {r.url}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.headerCount}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">Needs Tauri host for a real listen socket.</p>
      </div>
    </ToolShell>
  );
}
