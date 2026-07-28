import React, { useState } from 'react';
import { Vibrate } from 'lucide-react';
import { haptics, type HapticsImpactStyle, type HapticsNotificationType } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

const IMPACT_STYLES: HapticsImpactStyle[] = ['light', 'medium', 'heavy', 'soft', 'rigid'];
const NOTIFICATION_TYPES: HapticsNotificationType[] = ['success', 'warning', 'error'];

export default function HapticsTool({ onBack }: { onBack: () => void }) {
  const [durationMs, setDurationMs] = useState('200');
  const [impactStyle, setImpactStyle] = useState<HapticsImpactStyle>('medium');
  const [notificationType, setNotificationType] = useState<HapticsNotificationType>('success');
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const run = (label: string, action: () => Promise<void>) => {
    action()
      .then(() => pushLog(`${label} → ok`))
      .catch((e) => pushLog(`${label} → err: ${e?.message || e}`));
  };

  return (
    <ToolShell
      title="Haptics"
      surface="agapi.haptics"
      status="lab"
      onBack={onBack}
      examples={examplesFor('haptics')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Vibrate size={16} className="text-fuchsia-400" /> Vibrate
          </h2>
          <div className="flex gap-2">
            <input
              className="w-28 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={durationMs}
              onChange={(e) => setDurationMs(e.target.value)}
              placeholder="ms"
            />
            <button
              type="button"
              onClick={() => run('vibrate', () => haptics.vibrate(parseInt(durationMs, 10) || 0))}
              className="px-4 py-2 rounded-lg bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-medium"
            >
              Vibrate
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200">Impact feedback</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg bg-gray-950 border border-gray-800 px-2 py-1.5 text-sm"
              value={impactStyle}
              onChange={(e) => setImpactStyle(e.target.value as HapticsImpactStyle)}
            >
              {IMPACT_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => run(`impact(${impactStyle})`, () => haptics.impact(impactStyle))}
              className="px-4 py-2 rounded-lg bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-medium"
            >
              Trigger
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200">Notification feedback</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg bg-gray-950 border border-gray-800 px-2 py-1.5 text-sm"
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value as HapticsNotificationType)}
            >
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                run(`notification(${notificationType})`, () => haptics.notification(notificationType))
              }
              className="px-4 py-2 rounded-lg bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-medium"
            >
              Trigger
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={() => run('selection', () => haptics.selection())}
          className="px-4 py-2 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
        >
          Selection feedback
        </button>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Mobile host preferred (Android/iOS); falls back to <code className="text-gray-500">navigator.vibrate</code>{' '}
          in a browser/desktop webview that has one. "There are no standards/requirements for
          vibration support on Android" per the plugin's own docs — results vary by device.
        </p>
      </div>
    </ToolShell>
  );
}
