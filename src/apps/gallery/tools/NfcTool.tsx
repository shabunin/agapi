import React, { useState } from 'react';
import { Nfc as NfcIcon, ScanLine, Send } from 'lucide-react';
import { nfc } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

export default function NfcTool({ onBack }: { onBack: () => void }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [uri, setUri] = useState('https://tauri.app');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const checkAvailable = () => {
    nfc
      .isAvailable()
      .then((a) => {
        setAvailable(a);
        pushLog(`isAvailable → ${a}`);
      })
      .catch((e) => pushLog(`err: ${e?.message || e}`));
  };

  const scan = () => {
    setBusy(true);
    nfc
      .scan({ type: 'ndef' })
      .then((tag) => {
        pushLog(
          `scan → id=[${tag.id.join(',')}] kinds=${tag.kind.join(',')} records=${tag.records.length}`
        );
      })
      .catch((e) => pushLog(`scan → err: ${e?.message || e}`))
      .finally(() => setBusy(false));
  };

  const write = () => {
    setBusy(true);
    nfc
      .write([nfc.uriRecord(uri)], { kind: { type: 'ndef' } })
      .then(() => pushLog(`write → wrote uriRecord(${uri})`))
      .catch((e) => pushLog(`write → err: ${e?.message || e}`))
      .finally(() => setBusy(false));
  };

  return (
    <ToolShell
      title="NFC"
      surface="agapi.nfc"
      status="lab"
      onBack={onBack}
      examples={examplesFor('nfc')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkAvailable}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium"
          >
            <NfcIcon size={16} /> Check availability
          </button>
          {available !== null && (
            <span className={`text-xs ${available ? 'text-emerald-400' : 'text-red-400'}`}>
              {String(available)}
            </span>
          )}
        </div>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <ScanLine size={16} className="text-violet-400" /> Scan (NDEF)
          </h2>
          <button
            type="button"
            onClick={scan}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium disabled:opacity-50"
          >
            Scan tag
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Send size={16} className="text-violet-400" /> Write URI record
          </h2>
          <input
            className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="https://…"
          />
          <button
            type="button"
            onClick={write}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium disabled:opacity-50"
          >
            Write
          </button>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Mobile only (Android/iOS) — desktop hosts don't have an NfcHost, so every button
          will error there. Scan/write block waiting for a tag to be presented.
        </p>
      </div>
    </ToolShell>
  );
}
