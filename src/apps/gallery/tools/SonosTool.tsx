import React, { useRef, useState } from 'react';
import { Pause, Play, RefreshCw, SkipBack, SkipForward, Speaker, Square, Volume2, VolumeX } from 'lucide-react';
import { SonosDevice, discoverSonos, type SonosTransportState } from '@agapi/sonos';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

/**
 * Real Sonos control via @agapi/sonos — SSDP discovery over agapi.dgram,
 * UPnP SOAP control over agapi.http. Like the Matter tool, this legitimately
 * finds nothing unless real speakers are on the LAN.
 */

interface SpeakerRow {
  device: SonosDevice;
  roomName: string;
  modelName: string;
  state: SonosTransportState;
  volume: number;
  mute: boolean;
}

async function loadRow(device: SonosDevice): Promise<SpeakerRow> {
  const [desc, state, volume, mute] = await Promise.all([
    device.getDescription(),
    device.getTransportState(),
    device.getVolume(),
    device.getMute(),
  ]);
  return {
    device,
    roomName: desc.roomName ?? device.address,
    modelName: desc.modelName ?? 'Sonos',
    state,
    volume,
    mute,
  };
}

export default function SonosTool({ onBack }: { onBack: () => void }) {
  const [discovering, setDiscovering] = useState(false);
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // address of speaker with an in-flight command
  // Volume slider values are local until released — avoids a SOAP call per pixel.
  const pendingVolume = useRef<Record<string, number>>({});

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-40), line]);

  const refreshRow = async (device: SonosDevice) => {
    try {
      const row = await loadRow(device);
      setSpeakers((prev) => prev.map((r) => (r.device.address === device.address ? row : r)));
    } catch (e: any) {
      pushLog(`refresh ${device.address} failed → ${e?.message ?? e}`);
    }
  };

  const discover = async () => {
    setDiscovering(true);
    setSpeakers([]);
    pushLog('SSDP M-SEARCH sent, collecting replies (5s)…');
    try {
      const devices = await discoverSonos((d) => pushLog(`reply from ${d.address}`));
      pushLog(`discovery done — ${devices.length} speaker(s)`);
      const rows = await Promise.all(
        devices.map((d) =>
          loadRow(d).catch((e: any) => {
            pushLog(`describe ${d.address} failed → ${e?.message ?? e}`);
            return null;
          }),
        ),
      );
      setSpeakers(rows.filter((r): r is SpeakerRow => r !== null));
    } catch (e: any) {
      pushLog(`discovery failed → ${e?.message ?? e}`);
      console.error('[SonosTool] discovery failed', e);
    } finally {
      setDiscovering(false);
    }
  };

  const run = async (row: SpeakerRow, label: string, action: () => Promise<unknown>) => {
    setBusy(row.device.address);
    try {
      await action();
      pushLog(`${row.roomName}: ${label}`);
      await refreshRow(row.device);
    } catch (e: any) {
      pushLog(`${row.roomName}: ${label} failed → ${e?.message ?? e}`);
      console.error(`[SonosTool] ${label} failed`, e);
    } finally {
      setBusy(null);
    }
  };

  const transportButtons = (row: SpeakerRow) => {
    const isBusy = busy === row.device.address;
    const playing = row.state.state === 'PLAYING';
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(row, 'previous', () => row.device.previous())}
          className="p-1.5 rounded-md bg-gray-700/70 hover:bg-gray-600 disabled:opacity-50"
          title="Previous track"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            playing
              ? run(row, 'pause', () => row.device.pause())
              : run(row, 'play', () => row.device.play())
          }
          className="p-1.5 rounded-md bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(row, 'stop', () => row.device.stop())}
          className="p-1.5 rounded-md bg-gray-700/70 hover:bg-gray-600 disabled:opacity-50"
          title="Stop"
        >
          <Square size={14} />
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(row, 'next', () => row.device.next())}
          className="p-1.5 rounded-md bg-gray-700/70 hover:bg-gray-600 disabled:opacity-50"
          title="Next track"
        >
          <SkipForward size={14} />
        </button>
      </div>
    );
  };

  return (
    <ToolShell
      title="Sonos"
      surface="@agapi/sonos · agapi.dgram + agapi.http"
      status="lab"
      onBack={onBack}
      examples={examplesFor('sonos')}
    >
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Second real driver after Matter — and the simple one: SSDP discovery is one multicast
          M-SEARCH over <code className="text-gray-300">agapi.dgram</code>, control is unauthenticated
          UPnP SOAP over <code className="text-gray-300">agapi.http</code> (port 1400). No pairing, no
          crypto. GENA eventing (push state updates) is the planned next stage.
        </p>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Speaker size={16} className="text-emerald-400" /> Speakers
          </h2>
          <button
            type="button"
            disabled={discovering}
            onClick={discover}
            className="px-4 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
          >
            {discovering ? 'Discovering (5s)…' : 'Discover speakers'}
          </button>

          <div className="space-y-2">
            {speakers.length === 0 && (
              <p className="text-xs text-gray-600">No speakers found yet.</p>
            )}
            {speakers.map((row) => (
              <div
                key={row.device.address}
                className="rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2 text-xs text-gray-300 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-200">{row.roomName}</span>
                    <span className="text-gray-500"> · {row.modelName}</span>
                    <span className="text-gray-600 font-mono"> · {row.device.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {transportButtons(row)}
                    <button
                      type="button"
                      disabled={busy === row.device.address}
                      onClick={() => refreshRow(row.device)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 disabled:opacity-50"
                      title="Refresh state"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                <div className="text-gray-500">
                  {row.state.state}
                  {row.state.trackTitle && (
                    <span className="text-gray-400">
                      {' — '}
                      {row.state.trackTitle}
                      {row.state.trackArtist ? ` · ${row.state.trackArtist}` : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === row.device.address}
                    onClick={() =>
                      run(row, row.mute ? 'unmute' : 'mute', () => row.device.setMute(!row.mute))
                    }
                    className="p-1.5 rounded-md bg-gray-700/70 hover:bg-gray-600 disabled:opacity-50"
                    title={row.mute ? 'Unmute' : 'Mute'}
                  >
                    {row.mute ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={row.volume}
                    onChange={(e) => {
                      pendingVolume.current[row.device.address] = Number(e.target.value);
                    }}
                    onMouseUp={() => {
                      const v = pendingVolume.current[row.device.address];
                      if (v !== undefined) run(row, `volume ${v}`, () => row.device.setVolume(v));
                    }}
                    onTouchEnd={() => {
                      const v = pendingVolume.current[row.device.address];
                      if (v !== undefined) run(row, `volume ${v}`, () => row.device.setVolume(v));
                    }}
                    className="flex-1 accent-emerald-400"
                  />
                  <span className="w-8 text-right font-mono text-gray-400">{row.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>
      </div>
    </ToolShell>
  );
}
