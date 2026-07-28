import React, { useState } from 'react';
import { Fingerprint, RefreshCw } from 'lucide-react';
import { biometric, type BiometricStatus } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

export default function BiometricTool({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [reason, setReason] = useState("Confirm it's you");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const checkStatus = () => {
    setBusy(true);
    biometric
      .checkStatus()
      .then((s) => {
        setStatus(s);
        pushLog(`checkStatus → available=${s.isAvailable} type=${s.biometryType}`);
      })
      .catch((e) => pushLog(`err: ${e?.message || e}`))
      .finally(() => setBusy(false));
  };

  const authenticate = () => {
    setBusy(true);
    biometric
      .authenticate(reason)
      .then(() => pushLog('authenticate → ok'))
      .catch((e) => pushLog(`authenticate → err: ${e?.message || e}`))
      .finally(() => setBusy(false));
  };

  return (
    <ToolShell
      title="Biometric"
      surface="agapi.biometric"
      status="lab"
      onBack={onBack}
      examples={examplesFor('biometrics')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <button
          type="button"
          onClick={checkStatus}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600/90 hover:bg-orange-600 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Check status
        </button>

        {status && (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-gray-800/80 first:border-t-0">
                  <td className="px-3 py-2 text-xs text-gray-500">Available</td>
                  <td className="px-3 py-2 font-mono text-xs text-orange-300/90">
                    {String(status.isAvailable)}
                  </td>
                </tr>
                <tr className="border-t border-gray-800/80">
                  <td className="px-3 py-2 text-xs text-gray-500">Type</td>
                  <td className="px-3 py-2 font-mono text-xs text-orange-300/90">
                    {status.biometryType}
                  </td>
                </tr>
                {status.error && (
                  <tr className="border-t border-gray-800/80">
                    <td className="px-3 py-2 text-xs text-gray-500">Error</td>
                    <td className="px-3 py-2 font-mono text-xs text-red-400">
                      {status.error} {status.errorCode ? `(${status.errorCode})` : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Fingerprint size={16} className="text-orange-400" /> Authenticate
          </h2>
          <label className="block text-xs text-gray-500">
            Reason
            <input
              className="mt-1 w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={authenticate}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-orange-600/90 hover:bg-orange-600 text-sm font-medium disabled:opacity-50"
          >
            Authenticate
          </button>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Mobile only (Android/iOS) — desktop hosts don't have a BiometricHost, so both
          buttons will error there. Needs a device with biometrics enrolled.
        </p>
      </div>
    </ToolShell>
  );
}
