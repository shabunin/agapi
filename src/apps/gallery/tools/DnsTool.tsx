import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { dns } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';

export default function DnsTool({ onBack }: { onBack: () => void }) {
  const [hostname, setHostname] = useState('example.com');
  const [family, setFamily] = useState<0 | 4 | 6>(0);
  const [all, setAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lookup = () => {
    setBusy(true);
    setError(null);
    setResult('');
    const opts: { family?: number; all?: boolean } = {};
    if (family === 4 || family === 6) opts.family = family;
    if (all) opts.all = true;

    dns.lookup(hostname, opts, (err, address, fam) => {
      setBusy(false);
      if (err) {
        const code = (err as any).code ? ` [${(err as any).code}]` : '';
        setError(`${err.message}${code}`);
        return;
      }
      if (all && Array.isArray(address)) {
        setResult(
          address
            .map((a: any) => `${a.address}  (family ${a.family})`)
            .join('\n')
        );
      } else {
        setResult(`${address}  (family ${fam ?? '?'})`);
      }
    });
  };

  return (
    <ToolShell title="DNS lookup" surface="agapi.dns.lookup" status="lab" onBack={onBack}>
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <label className="block text-xs text-gray-500">
          Hostname
          <input
            className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-4 items-center text-sm text-gray-300">
          <label className="flex items-center gap-2 cursor-pointer">
            Family
            <select
              className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-1.5 text-sm"
              value={family}
              onChange={(e) => setFamily(Number(e.target.value) as 0 | 4 | 6)}
            >
              <option value={0}>any</option>
              <option value={4}>IPv4</option>
              <option value={6}>IPv6</option>
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
              className="rounded border-gray-600"
            />
            all addresses
          </label>
        </div>

        <button
          type="button"
          onClick={lookup}
          disabled={busy || !hostname.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-600 text-sm font-medium disabled:opacity-50"
        >
          <Search size={16} />
          {busy ? 'Looking up…' : 'Lookup'}
        </button>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-sm font-mono text-emerald-300/90 whitespace-pre-wrap">
            {result}
          </pre>
        )}

        <p className="text-xs text-gray-600">
          Uses OS resolver via host.dns (Tauri). Mock host returns ENOTFOUND / no DnsHost.
        </p>
      </div>
    </ToolShell>
  );
}
