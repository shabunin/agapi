import React, { useEffect, useRef, useState } from 'react';
import { Radio, RefreshCw, Square } from 'lucide-react';
import { device, type NetworkStatus, type NetworkWatchHandle } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

export default function NetworkStatusTool({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const watchRef = useRef<NetworkWatchHandle | null>(null);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const refresh = () => {
    setBusy(true);
    setError(null);
    device
      .getNetworkStatus()
      .then((s) => setStatus(s))
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setBusy(false));
  };

  const stopWatch = () => {
    watchRef.current?.stop();
    watchRef.current = null;
    setWatching(false);
  };

  useEffect(() => stopWatch, []);

  const startWatch = () => {
    setError(null);
    device
      .watchNetwork((s) => {
        setStatus(s);
        pushLog(`${s.hasNetwork ? 'online' : 'offline'} — ${s.networkType}, ${s.addresses.length} address(es)`);
      })
      .then((handle) => {
        watchRef.current = handle;
        setWatching(true);
        pushLog('watching started');
      })
      .catch((e) => setError(e?.message || String(e)));
  };

  return (
    <ToolShell
      title="Network status"
      surface="agapi.device.getNetworkStatus"
      status="lab"
      onBack={onBack}
      examples={examplesFor('network-status')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-600 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Checking…' : 'Refresh'}
          </button>
          {!watching ? (
            <button
              type="button"
              onClick={startWatch}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
            >
              <Radio size={16} /> Watch
            </button>
          ) : (
            <button
              type="button"
              onClick={stopWatch}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm"
            >
              <Square size={14} /> Watching…
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {status && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium ${
                  status.hasNetwork
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-red-500/15 text-red-300'
                }`}
              >
                {status.hasNetwork ? 'online' : 'offline'}
              </span>
              <span className="text-gray-500 font-mono">{status.networkType}</span>
            </div>

            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-950/80 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Interface</th>
                    <th className="px-3 py-2">Family</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Netmask</th>
                  </tr>
                </thead>
                <tbody>
                  {status.addresses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-600 text-xs">
                        No non-loopback addresses
                      </td>
                    </tr>
                  ) : (
                    status.addresses.map((a, i) => (
                      <tr key={`${a.interface}-${a.address}-${i}`} className="border-t border-gray-800/80">
                        <td className="px-3 py-2 font-mono text-xs text-gray-300">{a.interface}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{a.family}</td>
                        <td className="px-3 py-2 font-mono text-xs text-emerald-400/90">{a.address}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{a.netmask}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(log.length > 0 || watching) && (
          <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
            {log.length ? log.join('\n') : '— waiting for changes —'}
          </pre>
        )}

        <p className="text-xs text-gray-600">
          Needs Tauri. `networkType` is a best-effort guess from interface names — no SSID
          (needs platform-specific Wi-Fi APIs we don't have a host for yet). Watch has no
          equivalent on Apple platforms yet (this project doesn't build for those today).
        </p>
      </div>
    </ToolShell>
  );
}
