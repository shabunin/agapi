import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, Square, Megaphone } from 'lucide-react';
import { mdns, type MdnsService } from '@agapi/stdlib';
import type { MdnsBrowseHandle, MdnsPublishHandle } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

interface Row {
  key: string;
  service: MdnsService;
  seenAt: string;
}

/**
 * Live mDNS browse + publish lab (Tauri host / mdns-sd).
 */
export default function MdnsTool({ onBack }: { onBack: () => void }) {
  const [serviceType, setServiceType] = useState('_http._tcp');
  const [browsing, setBrowsing] = useState(false);
  const [status, setStatus] = useState('idle');
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const browseRef = useRef<MdnsBrowseHandle | null>(null);

  const [pubType, setPubType] = useState('_agapi-demo._tcp');
  const [pubName, setPubName] = useState('agapi-gallery');
  const [pubPort, setPubPort] = useState('8080');
  const [publishing, setPublishing] = useState(false);
  const publishRef = useRef<MdnsPublishHandle | null>(null);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  }, []);

  const stopBrowse = useCallback(() => {
    browseRef.current?.stop();
    browseRef.current = null;
    setBrowsing(false);
    setStatus('idle');
  }, []);

  const stopPublish = useCallback(async () => {
    const h = publishRef.current;
    publishRef.current = null;
    setPublishing(false);
    if (h) {
      try {
        await h.stop();
        pushLog(`unpublished ${h.id}`);
      } catch (e) {
        pushLog(`unpublish err: ${e}`);
      }
    }
  }, [pushLog]);

  useEffect(() => {
    return () => {
      browseRef.current?.stop();
      void publishRef.current?.stop();
    };
  }, []);

  const startBrowse = () => {
    stopBrowse();
    setRows([]);
    setStatus('starting…');
    try {
      const handle = mdns.browse(serviceType.trim(), (ev) => {
        if (ev.type === 'started') {
          setBrowsing(true);
          setStatus(`browsing ${ev.serviceType || serviceType}`);
          pushLog(`browse started ${ev.serviceType || ''}`);
        } else if (ev.type === 'found') {
          pushLog(`found ${ev.fullname || ''}`);
        } else if (ev.type === 'resolved' && ev.service) {
          const s = ev.service;
          const key = s.fullname || `${s.name}.${s.serviceType}`;
          setRows((prev) => {
            const next = prev.filter((r) => r.key !== key);
            next.push({
              key,
              service: s,
              seenAt: new Date().toLocaleTimeString('en-GB'),
            });
            return next.sort((a, b) => a.service.name.localeCompare(b.service.name));
          });
          pushLog(
            `resolved ${s.name} → ${s.addresses.join(', ') || s.host}:${s.port}`
          );
        } else if (ev.type === 'removed') {
          const full = ev.fullname;
          if (full) {
            setRows((prev) => prev.filter((r) => r.key !== full && r.service.fullname !== full));
          }
          pushLog(`removed ${full || ''}`);
        } else if (ev.type === 'stopped') {
          setBrowsing(false);
          setStatus('stopped');
          pushLog('browse stopped');
        } else if (ev.type === 'error') {
          setStatus(`error: ${ev.error?.message || 'unknown'}`);
          pushLog(`err: ${ev.error?.message || ev.error}`);
        }
      });
      browseRef.current = handle;
    } catch (e) {
      setStatus(`error: ${e}`);
      pushLog(`err: ${e}`);
    }
  };

  const startPublish = async () => {
    await stopPublish();
    const port = parseInt(pubPort, 10);
    if (!Number.isFinite(port) || port <= 0) {
      pushLog('err: invalid publish port');
      return;
    }
    try {
      const h = await mdns.publish({
        type: pubType.trim(),
        name: pubName.trim() || 'agapi',
        port,
        txt: { path: '/', via: 'agapi-gallery' },
      });
      publishRef.current = h;
      setPublishing(true);
      pushLog(`published ${pubName} ${pubType} :${port} id=${h.id}`);
    } catch (e) {
      pushLog(`publish err: ${e}`);
      setStatus(`publish error: ${e}`);
    }
  };

  return (
    <ToolShell
      title="mDNS"
      surface="agapi.mdns"
      status="lab"
      onBack={onBack}
      examples={examplesFor('mdns')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Radio size={16} className="text-amber-400" /> Browse
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="_http._tcp"
              disabled={browsing}
            />
            {!browsing ? (
              <button
                type="button"
                onClick={startBrowse}
                className="px-4 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-sm font-medium"
              >
                Start
              </button>
            ) : (
              <button
                type="button"
                onClick={stopBrowse}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-sm"
              >
                <Square size={14} /> Stop
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Status: <span className="font-mono text-gray-400">{status}</span>
            {' · '}
            try <code className="text-gray-400">_http._tcp</code>,{' '}
            <code className="text-gray-400">_ssh._tcp</code>,{' '}
            <code className="text-gray-400">_googlecast._tcp</code>
          </p>

          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-950/80 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Host / port</th>
                  <th className="px-3 py-2">Addresses</th>
                  <th className="px-3 py-2 w-20">Seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-600 text-xs">
                      {browsing ? 'Waiting for services…' : 'Not browsing'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key} className="border-t border-gray-800/80 align-top">
                      <td className="px-3 py-2">
                        <div className="text-gray-100 font-medium">{r.service.name}</div>
                        <div className="text-[11px] font-mono text-gray-500 truncate max-w-[12rem]">
                          {r.service.serviceType}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-300">
                        {r.service.host}:{r.service.port}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-emerald-400/90">
                        {r.service.addresses.join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.seenAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Megaphone size={16} className="text-sky-400" /> Publish
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={pubType}
              onChange={(e) => setPubType(e.target.value)}
              placeholder="type"
              disabled={publishing}
            />
            <input
              className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={pubName}
              onChange={(e) => setPubName(e.target.value)}
              placeholder="instance name"
              disabled={publishing}
            />
            <input
              className="rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={pubPort}
              onChange={(e) => setPubPort(e.target.value)}
              placeholder="port"
              disabled={publishing}
            />
          </div>
          <div className="flex gap-2">
            {!publishing ? (
              <button
                type="button"
                onClick={() => void startPublish()}
                className="px-4 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-600 text-sm font-medium"
              >
                Advertise
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopPublish()}
                className="px-4 py-2 rounded-lg border border-gray-700 text-sm"
              >
                Stop advertising
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Open a second device / Avahi browser and look for{' '}
            <code className="text-gray-400">{pubType}</code>. Needs Tauri + LAN multicast.
          </p>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>
      </div>
    </ToolShell>
  );
}
