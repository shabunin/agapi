import React, { useState } from 'react';
import { Bell, Send, ShieldCheck } from 'lucide-react';
import { notifications } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

export default function NotificationsTool({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = useState('agapi');
  const [body, setBody] = useState('Hello from the gallery');
  const [granted, setGranted] = useState<boolean | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const checkPermission = () => {
    notifications
      .isPermissionGranted()
      .then((g) => {
        setGranted(g);
        pushLog(`isPermissionGranted → ${g}`);
      })
      .catch((e) => pushLog(`err: ${e?.message || e}`));
  };

  const requestPermission = () => {
    notifications
      .requestPermission()
      .then((p) => {
        setGranted(p === 'granted');
        pushLog(`requestPermission → ${p}`);
      })
      .catch((e) => pushLog(`err: ${e?.message || e}`));
  };

  const send = () => {
    try {
      notifications.show({ title, body });
      pushLog(`show({ title: ${JSON.stringify(title)}, body: ${JSON.stringify(body)} })`);
    } catch (e) {
      pushLog(`err: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <ToolShell
      title="Notifications"
      surface="agapi.notifications"
      status="lab"
      onBack={onBack}
      examples={examplesFor('notifications')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <ShieldCheck size={16} className="text-sky-400" /> Permission
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkPermission}
              className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
            >
              Check
            </button>
            <button
              type="button"
              onClick={requestPermission}
              className="px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-600 text-sm font-medium"
            >
              Request
            </button>
          </div>
          {granted !== null && (
            <p className="text-xs text-gray-500">
              Granted:{' '}
              <span className={granted ? 'text-emerald-400' : 'text-red-400'}>
                {String(granted)}
              </span>
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Bell size={16} className="text-sky-400" /> Send
          </h2>
          <label className="block text-xs text-gray-500">
            Title
            <input
              className="mt-1 w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Body
            <input
              className="mt-1 w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={send}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-600 text-sm font-medium"
          >
            <Send size={14} /> Show notification
          </button>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Needs Tauri (desktop or mobile). Request permission before sending on the first run.
        </p>
      </div>
    </ToolShell>
  );
}
