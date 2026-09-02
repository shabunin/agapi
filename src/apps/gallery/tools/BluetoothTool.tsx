import React, { useState } from 'react';
import { Bluetooth as BluetoothIcon, ScanSearch, Plug, ListTree, Send, Radio } from 'lucide-react';
import { bluetooth } from '@agapi/stdlib';
import type { BleDevice, BleService } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

export default function BluetoothTool({ onBack }: { onBack: () => void }) {
  const [adapterState, setAdapterState] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connected, setConnected] = useState<string | null>(null);
  const [services, setServices] = useState<BleService[]>([]);
  const [characteristic, setCharacteristic] = useState('');
  const [service, setService] = useState('');
  const [writeText, setWriteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-100), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };
  const fail = (label: string, e: any) => pushLog(`${label} → err: ${e?.message || e}`);

  const checkAdapter = () => {
    bluetooth
      .checkPermissions()
      .then((granted) => pushLog(`checkPermissions → ${granted}`))
      .catch((e) => fail('checkPermissions', e));
    bluetooth
      .getAdapterState()
      .then((s) => {
        setAdapterState(s);
        pushLog(`getAdapterState → ${s}`);
      })
      .catch((e) => fail('getAdapterState', e));
  };

  const scan = () => {
    setDevices([]);
    setBusy(true);
    bluetooth
      .startScan(
        (found) => {
          setDevices(found);
        },
        5000
      )
      .then(() => pushLog('startScan → done (5s)'))
      .catch((e) => fail('startScan', e))
      .finally(() => setBusy(false));
    bluetooth.onScanningChange(setScanning).catch(() => {});
  };

  const connect = (address: string) => {
    setBusy(true);
    bluetooth
      .connect(address, () => {
        pushLog(`disconnected from ${address}`);
        setConnected(null);
        setServices([]);
      })
      .then(() => {
        setConnected(address);
        pushLog(`connect(${address}) → connected`);
      })
      .catch((e) => fail('connect', e))
      .finally(() => setBusy(false));
  };

  const disconnect = () => {
    bluetooth
      .disconnect()
      .then(() => {
        pushLog('disconnect → ok');
        setConnected(null);
        setServices([]);
      })
      .catch((e) => fail('disconnect', e));
  };

  const loadServices = () => {
    if (!connected) return;
    setBusy(true);
    bluetooth
      .listServices(connected)
      .then((svcs) => {
        setServices(svcs);
        pushLog(`listServices → ${svcs.length} service(s)`);
      })
      .catch((e) => fail('listServices', e))
      .finally(() => setBusy(false));
  };

  const readChar = () => {
    if (!characteristic) return;
    bluetooth
      .readString(characteristic, service || undefined)
      .then((text) => pushLog(`read(${characteristic}) → "${text}"`))
      .catch((e) => fail('read', e));
  };

  const writeChar = () => {
    if (!characteristic) return;
    bluetooth
      .sendString(characteristic, writeText, undefined, service || undefined)
      .then(() => pushLog(`send(${characteristic}) → wrote "${writeText}"`))
      .catch((e) => fail('send', e));
  };

  const subscribeChar = () => {
    if (!characteristic) return;
    bluetooth
      .subscribeString(characteristic, service || null, (text) =>
        pushLog(`notify(${characteristic}) → "${text}"`)
      )
      .then(() => pushLog(`subscribe(${characteristic}) → listening`))
      .catch((e) => fail('subscribe', e));
  };

  return (
    <ToolShell
      title="Bluetooth"
      surface="agapi.bluetooth (client/central)"
      status="lab"
      onBack={onBack}
      examples={examplesFor('bluetooth')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkAdapter}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium"
          >
            <BluetoothIcon size={16} /> Check adapter
          </button>
          {adapterState !== null && (
            <span
              className={`text-xs ${adapterState === 'On' ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {adapterState}
            </span>
          )}
        </div>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <ScanSearch size={16} className="text-violet-400" /> Scan (5s)
            {scanning && <span className="text-[10px] text-emerald-400">scanning…</span>}
          </h2>
          <button
            type="button"
            onClick={scan}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium disabled:opacity-50"
          >
            Start scan
          </button>
          <ul className="space-y-1 max-h-40 overflow-auto">
            {devices.map((d) => (
              <li
                key={d.address}
                className="flex items-center justify-between gap-2 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs font-mono"
              >
                <span className="truncate">
                  {d.name || '(unnamed)'} · {d.address} · {d.rssi}dBm
                </span>
                <button
                  type="button"
                  onClick={() => connect(d.address)}
                  disabled={busy}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                >
                  <Plug size={12} /> connect
                </button>
              </li>
            ))}
            {devices.length === 0 && (
              <li className="text-xs text-gray-600">— no devices found yet —</li>
            )}
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <ListTree size={16} className="text-violet-400" /> Connection
          </h2>
          {connected ? (
            <div className="flex items-center justify-between gap-2 text-xs font-mono">
              <span className="text-emerald-400 truncate">connected: {connected}</span>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadServices}
                  disabled={busy}
                  className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                >
                  list services
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                >
                  disconnect
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600">— not connected — pick a device above —</p>
          )}
          {services.length > 0 && (
            <ul className="space-y-1 max-h-32 overflow-auto text-[11px] font-mono text-gray-400">
              {services.map((svc) => (
                <li key={svc.uuid}>
                  {svc.uuid}
                  <ul className="pl-3 text-gray-600">
                    {svc.characteristics.map((c) => (
                      <li key={c.uuid}>↳ {c.uuid}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Send size={16} className="text-violet-400" /> Characteristic read/write/notify
          </h2>
          <input
            className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={characteristic}
            onChange={(e) => setCharacteristic(e.target.value)}
            placeholder="characteristic UUID"
          />
          <input
            className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="service UUID (optional)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={readChar}
              className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium"
            >
              read
            </button>
            <button
              type="button"
              onClick={subscribeChar}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium"
            >
              <Radio size={12} /> subscribe
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={writeText}
              onChange={(e) => setWriteText(e.target.value)}
              placeholder="text to write"
            />
            <button
              type="button"
              onClick={writeChar}
              className="px-3 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-xs font-medium"
            >
              send
            </button>
          </div>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-40 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Central/client role only (community <code>tauri-plugin-blec</code>, btleplug-based) —
          scan, connect, GATT read/write/notify. Desktop (Windows/macOS/Linux) + Android; iOS
          isn&apos;t a build target in this project yet. Peripheral/server mode (advertising a
          GATT service of our own) isn&apos;t implemented — see STDLIB_ROADMAP.md C9.
        </p>
      </div>
    </ToolShell>
  );
}
