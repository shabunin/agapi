import React, { useRef, useState } from 'react';
import { Cable, Power, PowerOff, HelpCircle } from 'lucide-react';
import {
  SimpleDevice,
  createAgapiTcpTransport,
  type PowerState,
} from '@agapi/driver-template';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

/**
 * Lab for @agapi/driver-template — SimpleDevice (abstract power switch).
 * Point at dev/mock-server.ts (default 127.0.0.1:2300) or any gear that
 * speaks `power on|off|?\r\n`.
 */

export default function SimpleDeviceTool({ onBack }: { onBack: () => void }) {
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('2300');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [power, setPower] = useState<PowerState>('unknown');
  const [log, setLog] = useState<string[]>([]);
  const deviceRef = useRef<SimpleDevice | null>(null);

  const pushLog = (line: string) =>
    setLog((prev) => [...prev.slice(-50), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);

  const connect = async () => {
    setBusy(true);
    try {
      deviceRef.current?.disconnect();
      const device = new SimpleDevice(createAgapiTcpTransport(), {
        host: host.trim(),
        port: Number(port) || 2300,
      });
      await device.connect();
      deviceRef.current = device;
      setConnected(true);
      pushLog(`connected ${host}:${port}`);
    } catch (e: any) {
      pushLog(`connect failed → ${e?.message ?? e}`);
      setConnected(false);
      deviceRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    deviceRef.current?.disconnect();
    deviceRef.current = null;
    setConnected(false);
    setPower('unknown');
    pushLog('disconnected');
  };

  const run = async (label: string, fn: (d: SimpleDevice) => Promise<unknown>) => {
    const d = deviceRef.current;
    if (!d) {
      pushLog('not connected');
      return;
    }
    setBusy(true);
    try {
      const result = await fn(d);
      pushLog(`${label} → ${typeof result === 'string' ? result : JSON.stringify(result)}`);
    } catch (e: any) {
      pushLog(`${label} failed → ${e?.message ?? e}`);
      if (
        String(e?.message ?? e).includes('closed') ||
        String(e?.message ?? e).includes('disconnect')
      ) {
        setConnected(false);
        deviceRef.current = null;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="SimpleDevice"
      surface="@agapi/driver-template · agapi.net"
      status="lab"
      onBack={onBack}
      examples={examplesFor('simple-device')}
    >
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Starter package for line-oriented TCP drivers. Protocol core is transport-agnostic;
          this UI uses <code className="text-gray-300">createAgapiTcpTransport()</code>. Offline
          demo:{' '}
          <code className="text-gray-300">
            npx tsx packages/driver-template/dev/mock-server.ts
          </code>{' '}
          then connect to 127.0.0.1:2300.
        </p>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Cable size={16} className="text-cyan-400" /> Connection
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={connected}
              className="flex-1 min-w-[8rem] px-2 py-1.5 rounded-md bg-gray-950 border border-gray-700 text-xs font-mono text-gray-200 disabled:opacity-50"
              placeholder="host"
            />
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={connected}
              className="w-20 px-2 py-1.5 rounded-md bg-gray-950 border border-gray-700 text-xs font-mono text-gray-200 disabled:opacity-50"
              placeholder="port"
            />
            {!connected ? (
              <button
                type="button"
                disabled={busy || !host.trim()}
                onClick={() => void connect()}
                className="px-3 py-1.5 rounded-md bg-cyan-700/90 hover:bg-cyan-600 disabled:opacity-50 text-xs font-medium"
              >
                Connect
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={disconnect}
                className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-xs font-medium"
              >
                Disconnect
              </button>
            )}
            <span
              className={`text-[10px] uppercase tracking-wide ${
                connected ? 'text-emerald-400' : 'text-gray-600'
              }`}
            >
              {connected ? 'online' : 'offline'}
              {power !== 'unknown' ? ` · power ${power}` : ''}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!connected || busy}
              onClick={() =>
                void run('power on', async (d) => {
                  const r = await d.powerOn();
                  setPower('on');
                  return r;
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-xs"
            >
              <Power size={14} /> power on
            </button>
            <button
              type="button"
              disabled={!connected || busy}
              onClick={() =>
                void run('power off', async (d) => {
                  const r = await d.powerOff();
                  setPower('off');
                  return r;
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-800/80 hover:bg-rose-700 disabled:opacity-40 text-xs"
            >
              <PowerOff size={14} /> power off
            </button>
            <button
              type="button"
              disabled={!connected || busy}
              onClick={() =>
                void run('power ?', async (d) => {
                  const r = await d.queryPower();
                  setPower(r.state);
                  return r;
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-700/80 hover:bg-gray-600 disabled:opacity-40 text-xs"
            >
              <HelpCircle size={14} /> power ?
            </button>
          </div>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>
      </div>
    </ToolShell>
  );
}
