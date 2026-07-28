import React, { useEffect, useRef, useState } from 'react';
import { Radar, X } from 'lucide-react';
import { createAgapiMatterController } from '@agapi/matterjs';
import type { CommissioningController } from '@project-chip/matter.js';
import type { NodeCommissioningOptions } from '@project-chip/matter.js';
import type { CommissionableDevice, CommissionableDeviceIdentifiers } from '@matter/protocol';
import { Seconds } from '@matter/general';
import { EndpointNumber, ManualPairingCodeCodec } from '@matter/types';
import { ColorControl, LevelControl, OnOff } from '@matter/types/clusters';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

/**
 * Real discovery + commissioning via matter.js, running its full mDNS
 * scanner and PASE/CASE protocol stack over agapi.dgram/agapi.device
 * (see packages/matterjs — the only adapter matter.js needed was Network;
 * Crypto/Time self-install). Not a stub: discovery legitimately returns
 * nothing if no Matter device is on the LAN, same as the sockets/TLS tools
 * needing a real endpoint.
 */

type ControllerStatus = 'idle' | 'starting' | 'ready' | 'error';

// Not exported from @project-chip/matter.js's package root (only from an
// internal module) — derive it structurally instead of importing the name.
type PairedNodeDetails = ReturnType<CommissioningController['getCommissionedNodesDetails']>[number];

/**
 * Two layers of error-wrapping to see through here, both from matter.js:
 *
 * 1. Its Construction system wraps a crashed dependency's *second and later*
 *    consumer in a generic CrashedDependencyError ("X unavailable due to
 *    initialization error") — only the very first caller sees the real
 *    cause (vendor/matter.js/packages/general/src/util/Construction.ts:587-604).
 *    Chained on `.cause`.
 *
 * 2. Compiled `using`/`await using` disposal stacks (TC39 Explicit Resource
 *    Management) throw a `SuppressedError` when a disposal callback itself
 *    throws while unwinding after an earlier error — its default message is
 *    the unhelpful "An error was suppressed during disposal", with the two
 *    real errors on `.error` (thrown during disposal) and `.suppressed`
 *    (the original error being unwound).
 *
 * Walk all three properties instead of showing just the outer message.
 */
function describeError(e: unknown): string {
  const parts: string[] = [];
  let current: unknown = e;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      const extra = current as Error & { cause?: unknown; error?: unknown; suppressed?: unknown };
      if (extra.suppressed !== undefined) {
        parts.push(`[suppressed: ${describeError(extra.suppressed)}]`);
      }
      current = extra.error ?? extra.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(' ← caused by: ');
}

interface ControlDevice {
  endpointNumber: number;
  typeName: string;
  /** undefined = no OnOff cluster on this endpoint (e.g. a sensor-only device). */
  onOff?: boolean;
  /** true = this endpoint has a ColorControl cluster (hue/saturation supported). */
  hasColor: boolean;
  /** true = this endpoint has a LevelControl cluster (brightness supported). */
  hasLevel: boolean;
}

/**
 * Matter's ColorControl cluster uses hue/saturation on a 0–254 scale (not
 * 0–360°/0–100%, and not 0–255 — 254 is deliberately the max, see
 * MatterSpecification §3.2.7.2/3.2.7.3), so an HTML `<input type="color">`
 * hex value needs converting: hex → RGB → HSV → scaled to 0–254.
 */
function hexToMatterHueSaturation(hex: string): { hue: number; saturation: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hueDeg = 0;
  if (delta !== 0) {
    if (max === r) hueDeg = ((g - b) / delta) % 6;
    else if (max === g) hueDeg = (b - r) / delta + 2;
    else hueDeg = (r - g) / delta + 4;
    hueDeg *= 60;
    if (hueDeg < 0) hueDeg += 360;
  }
  const saturationPct = max === 0 ? 0 : delta / max;

  return {
    hue: Math.round((hueDeg / 360) * 254),
    saturation: Math.round(saturationPct * 254),
  };
}

export default function MatterTool({ onBack }: { onBack: () => void }) {
  const controllerRef = useRef<CommissioningController | null>(null);
  const [status, setStatus] = useState<ControllerStatus>('idle');
  const [log, setLog] = useState<string[]>([]);

  const [discovering, setDiscovering] = useState(false);
  const [devices, setDevices] = useState<CommissionableDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CommissionableDevice | null>(null);

  const [pairingCode, setPairingCode] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [commissioning, setCommissioning] = useState(false);

  const [commissionedNodes, setCommissionedNodes] = useState<PairedNodeDetails[]>([]);
  const [uncommissioning, setUncommissioning] = useState<Set<string>>(new Set());
  const [persistent, setPersistent] = useState(true);

  const [connectedNodeId, setConnectedNodeId] = useState<PairedNodeDetails['nodeId'] | null>(null);
  const [controlDevices, setControlDevices] = useState<ControlDevice[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [togglingEndpoint, setTogglingEndpoint] = useState<number | null>(null);
  const [colorPickers, setColorPickers] = useState<Record<number, string>>({});
  const [settingColorEndpoint, setSettingColorEndpoint] = useState<number | null>(null);
  const [levelPickers, setLevelPickers] = useState<Record<number, number>>({});
  const [settingLevelEndpoint, setSettingLevelEndpoint] = useState<number | null>(null);
  const [windowTimeout, setWindowTimeout] = useState('900');
  const [openingWindow, setOpeningWindow] = useState<string | null>(null);

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-60), line]);

  const refreshCommissionedNodes = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setCommissionedNodes(controller.getCommissionedNodesDetails());
  };

  useEffect(() => {
    return () => {
      controllerRef.current?.close().catch(() => {});
    };
  }, []);

  const startController = async () => {
    setStatus('starting');
    pushLog('starting controller…');
    try {
      const controller = await createAgapiMatterController({
        id: 'agapi-gallery',
        label: 'agapi gallery',
        persistent,
      });
      controllerRef.current = controller;
      setStatus('ready');
      pushLog('controller ready');
      refreshCommissionedNodes(); // re-shows anything already commissioned this session
    } catch (e: any) {
      setStatus('error');
      pushLog(`start failed → ${describeError(e)}`);
      console.error('[MatterTool] start failed', e);
    }
  };

  const discover = async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setDiscovering(true);
    setDevices([]);
    pushLog('discovering (15s)…');
    try {
      const found = await controller.discoverCommissionableDevices(
        {},
        { ble: false, onIpNetwork: true },
        (device) => {
          setDevices((prev) => (prev.some((d) => d.deviceIdentifier === device.deviceIdentifier) ? prev : [...prev, device]));
          pushLog(`found ${device.deviceIdentifier} (D=${device.D}${device.DN ? `, "${device.DN}"` : ''})`);
        },
        Seconds(15),
      );
      pushLog(`discovery done — ${found.length} device(s)`);
    } catch (e: any) {
      pushLog(`discovery error → ${describeError(e)}`);
      console.error('[MatterTool] discovery error', e);
    } finally {
      setDiscovering(false);
    }
  };

  const commission = async () => {
    const controller = controllerRef.current;
    if (!controller || !pairingCode.trim()) return;
    setCommissioning(true);
    pushLog(
      selectedDevice
        ? `commissioning ${selectedDevice.deviceIdentifier} with code ${pairingCode.trim()}…`
        : `commissioning with code ${pairingCode.trim()}…`,
    );
    try {
      const { shortDiscriminator, passcode } = ManualPairingCodeCodec.decode(pairingCode.trim());

      // A device picked from Discover already gives us its exact instance —
      // target that directly instead of re-broadcasting a discriminator-only
      // discovery (which could in theory match a different device with the
      // same short discriminator).
      const identifierData: CommissionableDeviceIdentifiers = selectedDevice
        ? { instanceId: selectedDevice.deviceIdentifier }
        : { shortDiscriminator };

      const options: NodeCommissioningOptions = {
        discovery: {
          identifierData,
          discoveryCapabilities: { ble: false, onIpNetwork: true },
        },
        passcode,
        commissioning: {
          regulatoryLocation: 1, // Outdoor — most restrictive, safe default
          regulatoryCountryCode: 'XX',
          ...(wifiSsid.trim() && wifiPassword.trim()
            ? { wifiNetwork: { wifiSsid: wifiSsid.trim(), wifiCredentials: wifiPassword.trim() } }
            : {}),
        },
      };

      const nodeId = await controller.commissionNode(options);
      pushLog(`commissioned → nodeId ${nodeId}`);
      setSelectedDevice(null);
      setPairingCode('');
      refreshCommissionedNodes();
    } catch (e: any) {
      pushLog(`commission failed → ${describeError(e)}`);
      console.error('[MatterTool] commission failed', e);
    } finally {
      setCommissioning(false);
    }
  };

  const connect = async (nodeId: PairedNodeDetails['nodeId']) => {
    const controller = controllerRef.current;
    if (!controller) return;
    setConnecting(true);
    setConnectedNodeId(null);
    setControlDevices([]);
    pushLog(`connecting to node ${nodeId}…`);
    try {
      const node = await controller.getNode(nodeId);
      // getDevices() excludes the root endpoint (0) — that's identity/admin
      // clusters (BasicInformation, OperationalCredentials, ...), not
      // controllable device functionality.
      const endpoints = node.getDevices();
      const list = await Promise.all(
        endpoints.map(async (ep): Promise<ControlDevice> => {
          const endpointNumber = Number(ep.number ?? -1);
          const typeName = ep.getDeviceTypes()[0]?.name ?? 'unknown';
          const onOffClient = ep.getClusterClient(OnOff);
          const onOff = onOffClient ? await onOffClient.getOnOffAttribute().catch(() => undefined) : undefined;
          const hasColor = ep.getClusterClient(ColorControl) !== undefined;
          const hasLevel = ep.getClusterClient(LevelControl) !== undefined;
          return { endpointNumber, typeName, onOff, hasColor, hasLevel };
        }),
      );
      setConnectedNodeId(nodeId);
      setControlDevices(list);
      setColorPickers(Object.fromEntries(list.filter((d) => d.hasColor).map((d) => [d.endpointNumber, '#ffffff'])));
      setLevelPickers(Object.fromEntries(list.filter((d) => d.hasLevel).map((d) => [d.endpointNumber, 100])));
      pushLog(`connected — ${list.length} endpoint(s)`);
    } catch (e: any) {
      pushLog(`connect failed → ${describeError(e)}`);
      console.error('[MatterTool] connect failed', e);
    } finally {
      setConnecting(false);
    }
  };

  const toggleEndpoint = async (endpointNumber: number) => {
    const controller = controllerRef.current;
    if (!controller || connectedNodeId === null) return;
    setTogglingEndpoint(endpointNumber);
    try {
      const node = await controller.getNode(connectedNodeId);
      const onOffClient = node.getClusterClientForDevice(EndpointNumber(endpointNumber), OnOff);
      if (!onOffClient) throw new Error(`Endpoint ${endpointNumber} has no OnOff cluster`);
      await onOffClient.toggle();
      const onOff = await onOffClient.getOnOffAttribute().catch(() => undefined);
      setControlDevices((prev) => prev.map((d) => (d.endpointNumber === endpointNumber ? { ...d, onOff } : d)));
      pushLog(`endpoint ${endpointNumber} → ${onOff ? 'on' : 'off'}`);
    } catch (e: any) {
      pushLog(`toggle failed → ${describeError(e)}`);
      console.error('[MatterTool] toggle failed', e);
    } finally {
      setTogglingEndpoint(null);
    }
  };

  const setColor = async (endpointNumber: number) => {
    const controller = controllerRef.current;
    if (!controller || connectedNodeId === null) return;
    const hex = colorPickers[endpointNumber] ?? '#ffffff';
    setSettingColorEndpoint(endpointNumber);
    try {
      const node = await controller.getNode(connectedNodeId);
      const colorClient = node.getClusterClientForDevice(EndpointNumber(endpointNumber), ColorControl);
      if (!colorClient) throw new Error(`Endpoint ${endpointNumber} has no ColorControl cluster`);
      const { hue, saturation } = hexToMatterHueSaturation(hex);
      await colorClient.moveToHueAndSaturation({
        hue,
        saturation,
        transitionTime: 0,
        optionsMask: {},
        optionsOverride: {},
      });
      pushLog(`endpoint ${endpointNumber} → color ${hex} (hue ${hue}, sat ${saturation})`);
    } catch (e: any) {
      pushLog(`set color failed → ${describeError(e)}`);
      console.error('[MatterTool] set color failed', e);
    } finally {
      setSettingColorEndpoint(null);
    }
  };

  const setLevel = async (endpointNumber: number) => {
    const controller = controllerRef.current;
    if (!controller || connectedNodeId === null) return;
    const percent = levelPickers[endpointNumber] ?? 100;
    setSettingLevelEndpoint(endpointNumber);
    try {
      const node = await controller.getNode(connectedNodeId);
      const levelClient = node.getClusterClientForDevice(EndpointNumber(endpointNumber), LevelControl);
      if (!levelClient) throw new Error(`Endpoint ${endpointNumber} has no LevelControl cluster`);
      // LevelControl's CurrentLevel is 1–254, not 0–100% (0 is reserved —
      // "off" is handled by the OnOff cluster, not level 0). Scale the
      // slider's percent onto that range.
      const level = Math.max(1, Math.round((percent / 100) * 254));
      // moveToLevelWithOnOff (vs. plain moveToLevel) also turns the light on
      // if it's off — matches how real smart-home apps treat a brightness
      // slider (dragging it up implies "on").
      await levelClient.moveToLevelWithOnOff({
        level,
        transitionTime: 0,
        optionsMask: {},
        optionsOverride: {},
      });
      const onOffClient = node.getClusterClientForDevice(EndpointNumber(endpointNumber), OnOff);
      const onOff = onOffClient ? await onOffClient.getOnOffAttribute().catch(() => undefined) : undefined;
      setControlDevices((prev) => prev.map((d) => (d.endpointNumber === endpointNumber ? { ...d, onOff } : d)));
      pushLog(`endpoint ${endpointNumber} → brightness ${percent}% (level ${level})`);
    } catch (e: any) {
      pushLog(`set brightness failed → ${describeError(e)}`);
      console.error('[MatterTool] set brightness failed', e);
    } finally {
      setSettingLevelEndpoint(null);
    }
  };

  /**
   * Adds a second admin (e.g. a phone's Matter app) to a device we already
   * commissioned, without touching our own fabric — this is the real
   * "multi-admin" flow every ecosystem's "share device" button uses. Once
   * commissioned, a device closes its commissioning window (no more
   * _matterc._udp advertisement — that's a security feature, not a bug),
   * so a second controller can't discover it until an *already-connected*
   * admin (us) explicitly reopens one via AdministratorCommissioning.
   *
   * Basic reuses the device's original fixed passcode (same code printed on
   * it / used the first time) — simplest, but means whoever you hand it to
   * gets the permanent code. Enhanced generates a fresh one-time
   * passcode+discriminator instead, better if you don't want to hand out
   * the permanent one.
   */
  const openCommissioningWindow = async (nodeId: PairedNodeDetails['nodeId'], enhanced: boolean) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const key = String(nodeId);
    const timeoutSeconds = parseInt(windowTimeout, 10) || 900;
    setOpeningWindow(key);
    pushLog(`opening ${enhanced ? 'enhanced' : 'basic'} commissioning window for node ${nodeId} (${timeoutSeconds}s)…`);
    try {
      const node = await controller.getNode(nodeId);
      if (enhanced) {
        const { manualPairingCode } = await node.openEnhancedCommissioningWindow(timeoutSeconds);
        pushLog(`enhanced window open (${timeoutSeconds}s) — new pairing code for the second admin: ${manualPairingCode}`);
      } else {
        await node.openBasicCommissioningWindow(timeoutSeconds);
        pushLog(`basic window open (${timeoutSeconds}s) — reuse the original pairing code on the second admin`);
      }
    } catch (e: any) {
      pushLog(`open commissioning window failed → ${describeError(e)}`);
      console.error('[MatterTool] open commissioning window failed', e);
    } finally {
      setOpeningWindow(null);
    }
  };

  const uncommission = async (nodeId: PairedNodeDetails['nodeId']) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const key = String(nodeId);
    setUncommissioning((prev) => new Set(prev).add(key));
    pushLog(`uncommissioning node ${nodeId}…`);
    try {
      // Graceful path: ask the device to forget our fabric first. If that
      // fails (device offline/unreachable), controller.removeNode(nodeId,
      // false) force-clears our local records without waiting on the device.
      const node = await controller.getNode(nodeId);
      await node.decommission();
      pushLog(`uncommissioned node ${nodeId}`);
    } catch (e: any) {
      pushLog(`uncommission failed → ${describeError(e)}`);
      console.error('[MatterTool] uncommission failed', e);
    } finally {
      setUncommissioning((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      refreshCommissionedNodes();
    }
  };

  return (
    <ToolShell
      title="Matter"
      surface="@agapi/matterjs · @project-chip/matter.js"
      status="lab"
      onBack={onBack}
      examples={examplesFor('matter')}
    >
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          <code className="text-gray-300">cf-runtime</code>'s roadmap files Matter under a sibling driver package,
          not stdlib. <code className="text-gray-300">@agapi/matterjs</code> wraps upstream{' '}
          <code className="text-gray-300">matter.js</code> — Crypto and Time already work anywhere with{' '}
          <code className="text-gray-300">crypto.subtle</code>; the only real adapter is <code className="text-gray-300">Network</code>,
          built on <code className="text-gray-300">agapi.dgram</code> / <code className="text-gray-300">agapi.device</code>. On-network
          commissioning only — no BLE pairing yet (see docs/STDLIB_ROADMAP.md C9).
        </p>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Radar size={16} className="text-violet-400" /> Controller
          </h2>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={persistent}
              disabled={status === 'starting' || status === 'ready'}
              onChange={(e) => setPersistent(e.target.checked)}
            />
            Persist fabric / commissioned devices to <code className="text-gray-500">agapi.fs</code> (survives
            restart)
          </label>
          <button
            type="button"
            disabled={status === 'starting' || status === 'ready'}
            onClick={startController}
            className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 disabled:opacity-50 text-sm font-medium"
          >
            {status === 'ready' ? 'Controller ready' : status === 'starting' ? 'Starting…' : 'Start controller'}
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200">Discover</h2>
          <button
            type="button"
            disabled={status !== 'ready' || discovering}
            onClick={discover}
            className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 disabled:opacity-50 text-sm font-medium"
          >
            {discovering ? 'Discovering (15s)…' : 'Discover devices'}
          </button>
          <div className="space-y-1.5">
            {devices.length === 0 && <p className="text-xs text-gray-600">No devices found yet.</p>}
            {devices.map((d) => (
              <div
                key={d.deviceIdentifier}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300"
              >
                <div className="min-w-0 truncate">
                  <span className="font-mono">{d.deviceIdentifier}</span>
                  <span className="text-gray-500"> · D={d.D}</span>
                  {d.DN && <span className="text-gray-500"> · "{d.DN}"</span>}
                  {d.VP && <span className="text-gray-500"> · VP={d.VP}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDevice(d)}
                  className="shrink-0 px-2.5 py-1 rounded-md bg-violet-600/80 hover:bg-violet-600 text-[11px] font-medium"
                >
                  Commission
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200">Commission</h2>
          {selectedDevice && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-700/50 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200">
              <span className="font-mono truncate">
                Target: {selectedDevice.deviceIdentifier} (D={selectedDevice.D})
              </span>
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="shrink-0 p-0.5 rounded hover:bg-violet-500/20"
                title="Clear target — discover by discriminator instead"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="space-y-2">
            <input
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="Manual pairing code (e.g. 34970112332)"
            />
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="Wi-Fi SSID (optional)"
              />
              <input
                className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="Wi-Fi password (optional)"
                type="password"
              />
            </div>
            <button
              type="button"
              disabled={status !== 'ready' || commissioning || !pairingCode.trim()}
              onClick={commission}
              className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 disabled:opacity-50 text-sm font-medium"
            >
              {commissioning ? 'Commissioning…' : 'Commission'}
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Commissioned devices</h2>
            <button
              type="button"
              onClick={refreshCommissionedNodes}
              disabled={status !== 'ready'}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-1.5">
            {commissionedNodes.length === 0 && <p className="text-xs text-gray-600">None yet, this session.</p>}
            {commissionedNodes.map((n) => {
              const key = String(n.nodeId);
              const busy = uncommissioning.has(key);
              const windowBusy = openingWindow === key;
              return (
                <div key={key} className="rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2 text-xs text-gray-300 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate">
                      <span className="font-mono">{key}</span>
                      {n.advertisedName && <span className="text-gray-500"> · "{n.advertisedName}"</span>}
                      {n.operationalAddress && <span className="text-gray-600"> · {n.operationalAddress}</span>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={connecting}
                        onClick={() => connect(n.nodeId)}
                        className="px-2.5 py-1 rounded-md bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50 text-[11px] font-medium"
                      >
                        {connecting && connectedNodeId === null ? 'Connecting…' : 'Connect'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => uncommission(n.nodeId)}
                        className="px-2.5 py-1 rounded-md border border-rose-800 text-rose-300 hover:bg-rose-900/40 disabled:opacity-50 text-[11px] font-medium"
                      >
                        {busy ? 'Uncommissioning…' : 'Uncommission'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 shrink-0">Add 2nd admin (e.g. phone):</span>
                    <input
                      type="number"
                      min={60}
                      value={windowTimeout}
                      onChange={(e) => setWindowTimeout(e.target.value)}
                      className="w-16 rounded-md bg-gray-950 border border-gray-800 px-1.5 py-1 text-[11px] font-mono"
                      title="Commissioning window timeout, seconds"
                    />
                    <span className="text-gray-600 shrink-0">s</span>
                    <button
                      type="button"
                      disabled={windowBusy}
                      onClick={() => openCommissioningWindow(n.nodeId, false)}
                      className="px-2 py-1 rounded-md border border-sky-800 text-sky-300 hover:bg-sky-900/40 disabled:opacity-50 text-[11px] font-medium"
                      title="Reopen pairing using the original passcode"
                    >
                      {windowBusy ? '…' : 'Basic'}
                    </button>
                    <button
                      type="button"
                      disabled={windowBusy}
                      onClick={() => openCommissioningWindow(n.nodeId, true)}
                      className="px-2 py-1 rounded-md border border-sky-800 text-sky-300 hover:bg-sky-900/40 disabled:opacity-50 text-[11px] font-medium"
                      title="Reopen pairing using a freshly generated passcode"
                    >
                      {windowBusy ? '…' : 'Enhanced (new code)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-600">
            {persistent
              ? 'Persisted to agapi.fs — survives a reload as long as "Persist" stayed checked when the controller started.'
              : 'In-memory only ("Persist" was unchecked) — this list resets on reload.'}
          </p>
        </section>

        {connectedNodeId !== null && (
          <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-gray-200">
              Control — node <span className="font-mono">{String(connectedNodeId)}</span>
            </h2>
            <div className="space-y-1.5">
              {controlDevices.length === 0 && (
                <p className="text-xs text-gray-600">No non-root endpoints found on this node.</p>
              )}
              {controlDevices.map((d) => (
                <div key={d.endpointNumber} className="rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2 text-xs text-gray-300 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate">
                      <span className="font-mono">#{d.endpointNumber}</span>
                      <span className="text-gray-500"> · {d.typeName}</span>
                    </div>
                    {d.onOff !== undefined ? (
                      <button
                        type="button"
                        disabled={togglingEndpoint === d.endpointNumber}
                        onClick={() => toggleEndpoint(d.endpointNumber)}
                        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                          d.onOff ? 'bg-emerald-600/90 hover:bg-emerald-600' : 'bg-gray-700 hover:bg-gray-600'
                        } disabled:opacity-50`}
                      >
                        {togglingEndpoint === d.endpointNumber ? '…' : d.onOff ? 'On — toggle off' : 'Off — toggle on'}
                      </button>
                    ) : (
                      <span className="shrink-0 text-gray-600 text-[11px]">no OnOff cluster</span>
                    )}
                  </div>
                  {d.hasColor && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorPickers[d.endpointNumber] ?? '#ffffff'}
                        onChange={(e) =>
                          setColorPickers((prev) => ({ ...prev, [d.endpointNumber]: e.target.value }))
                        }
                        className="h-7 w-10 rounded border border-gray-700 bg-transparent p-0.5"
                      />
                      <button
                        type="button"
                        disabled={settingColorEndpoint === d.endpointNumber}
                        onClick={() => setColor(d.endpointNumber)}
                        className="px-2.5 py-1 rounded-md bg-fuchsia-600/90 hover:bg-fuchsia-600 disabled:opacity-50 text-[11px] font-medium"
                      >
                        {settingColorEndpoint === d.endpointNumber ? 'Setting…' : 'Set color'}
                      </button>
                    </div>
                  )}
                  {d.hasLevel && (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={levelPickers[d.endpointNumber] ?? 100}
                        onChange={(e) =>
                          setLevelPickers((prev) => ({ ...prev, [d.endpointNumber]: Number(e.target.value) }))
                        }
                        className="flex-1 accent-amber-400"
                      />
                      <span className="w-9 text-right font-mono text-gray-400">
                        {levelPickers[d.endpointNumber] ?? 100}%
                      </span>
                      <button
                        type="button"
                        disabled={settingLevelEndpoint === d.endpointNumber}
                        onClick={() => setLevel(d.endpointNumber)}
                        className="px-2.5 py-1 rounded-md bg-amber-600/90 hover:bg-amber-600 disabled:opacity-50 text-[11px] font-medium"
                      >
                        {settingLevelEndpoint === d.endpointNumber ? 'Setting…' : 'Set brightness'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-600">
              Color sends hue/saturation via <code className="text-gray-500">moveToHueAndSaturation</code> (hex → 0–254
              scale, not 0–360°/0–100%). Brightness sends <code className="text-gray-500">moveToLevelWithOnOff</code>{' '}
              (0–100% slider → Matter's 1–254 <code className="text-gray-500">CurrentLevel</code> range).
            </p>
          </section>
        )}

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>
      </div>
    </ToolShell>
  );
}
