import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { arch, eol, exeExtension, family, hostname, locale, platform, type } from '@tauri-apps/plugin-os';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

interface OsInfo {
  platform: string;
  type: string;
  family: string;
  arch: string;
  eol: string;
  exeExtension: string;
  locale: string | null;
  hostname: string | null;
}

const ROWS: [label: string, key: keyof OsInfo][] = [
  ['Platform', 'platform'],
  ['Type', 'type'],
  ['Family', 'family'],
  ['Arch', 'arch'],
  ['EOL', 'eol'],
  ['Exe extension', 'exeExtension'],
  ['Locale', 'locale'],
  ['Hostname', 'hostname'],
];

export default function OsInfoTool({ onBack }: { onBack: () => void }) {
  const [info, setInfo] = useState<OsInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const [localeVal, hostnameVal] = await Promise.all([locale(), hostname()]);
      setInfo({
        platform: platform(),
        type: type(),
        family: family(),
        arch: arch(),
        eol: eol() === '\n' ? '\\n' : '\\r\\n',
        exeExtension: exeExtension() || '(none)',
        locale: localeVal,
        hostname: hostnameVal,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="OS info"
      surface="@tauri-apps/plugin-os"
      status="lab"
      onBack={onBack}
      examples={examplesFor('os-info')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Reading…' : 'Refresh'}
        </button>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {info && (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {ROWS.map(([label, key]) => (
                  <tr key={key} className="border-t border-gray-800/80 first:border-t-0">
                    <td className="px-3 py-2 text-xs text-gray-500">{label}</td>
                    <td className="px-3 py-2 font-mono text-xs text-rose-300/90">
                      {info[key] ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-600">
          Direct <code className="text-gray-500">@tauri-apps/plugin-os</code> probe — not
          wrapped in <code className="text-gray-500">agapi.*</code> yet (planned as part of
          the device-properties phase).
        </p>
      </div>
    </ToolShell>
  );
}
