import React, { useRef, useState } from 'react';
import {
  ListMusic,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Speaker,
  Square,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SonosDevice,
  createAgapiSoapTransport,
  discoverSonos,
  type DidlItem,
  type SonosTransportState,
} from '@agapi/sonos';
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

type BrowseKind = 'queue' | 'favorites';

interface BrowsePanel {
  address: string;
  kind: BrowseKind;
  items: DidlItem[];
  total: number;
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
  const [ipInput, setIpInput] = useState('');
  const [uriInput, setUriInput] = useState('');
  const [browse, setBrowse] = useState<BrowsePanel | null>(null);
  // Volume slider values are local until released — avoids a SOAP call per pixel.
  const pendingVolume = useRef<Record<string, number>>({});

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-40), line]);

  const upsertSpeaker = (row: SpeakerRow) => {
    setSpeakers((prev) => {
      const i = prev.findIndex((r) => r.device.address === row.device.address);
      if (i < 0) return [...prev, row];
      const next = prev.slice();
      next[i] = row;
      return next;
    });
  };

  const refreshRow = async (device: SonosDevice) => {
    try {
      const row = await loadRow(device);
      upsertSpeaker(row);
    } catch (e: any) {
      pushLog(`refresh ${device.address} failed → ${e?.message ?? e}`);
    }
  };

  const discover = async () => {
    setDiscovering(true);
    setBrowse(null);
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

  const addByIp = async () => {
    const ip = ipInput.trim();
    if (!ip) return;
    setBusy(ip);
    pushLog(`add by IP ${ip}…`);
    try {
      const device = new SonosDevice(ip, createAgapiSoapTransport());
      const row = await loadRow(device);
      upsertSpeaker(row);
      pushLog(`added ${row.roomName} (${row.modelName}) @ ${ip}`);
      setIpInput('');
    } catch (e: any) {
      pushLog(`add ${ip} failed → ${e?.message ?? e}`);
      console.error('[SonosTool] add by IP failed', e);
    } finally {
      setBusy(null);
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

  const loadBrowse = async (row: SpeakerRow, kind: BrowseKind) => {
    setBusy(row.device.address);
    try {
      const result =
        kind === 'queue' ? await row.device.browseQueue() : await row.device.browseFavorites();
      setBrowse({ address: row.device.address, kind, items: result.items, total: result.total });
      pushLog(`${row.roomName}: ${kind} ${result.items.length}/${result.total}`);
    } catch (e: any) {
      pushLog(`${row.roomName}: browse ${kind} failed → ${e?.message ?? e}`);
      console.error(`[SonosTool] browse ${kind} failed`, e);
    } finally {
      setBusy(null);
    }
  };

  const playBrowseItem = async (row: SpeakerRow, item: DidlItem) => {
    await run(row, `play ${item.title ?? item.id}`, () => row.device.playItem(item));
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
          Second real driver after Matter — SSDP discovery over{' '}
          <code className="text-gray-300">agapi.dgram</code>, SOAP control over{' '}
          <code className="text-gray-300">agapi.http</code> (port 1400). Add by IP skips discovery
          (fixed-config panels). Queue / Favorites use ContentDirectory Browse; play-by-URI uses
          SetAVTransportURI. Spotify-in-catalog (SMAPI) and speaker grouping are later stages.
        </p>

        <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Speaker size={16} className="text-emerald-400" /> Speakers
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={discovering}
              onClick={discover}
              className="px-4 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
            >
              {discovering ? 'Discovering (5s)…' : 'Discover speakers'}
            </button>
            <div className="flex items-center gap-1.5 flex-1 min-w-[12rem]">
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addByIp();
                }}
                placeholder="192.168.1.174"
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-gray-950 border border-gray-700 text-xs font-mono text-gray-200 placeholder:text-gray-600"
              />
              <button
                type="button"
                disabled={!ipInput.trim() || busy !== null}
                onClick={() => void addByIp()}
                className="px-3 py-1.5 rounded-md bg-gray-700/80 hover:bg-gray-600 disabled:opacity-50 text-xs font-medium"
              >
                Add by IP
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {speakers.length === 0 && (
              <p className="text-xs text-gray-600">No speakers yet — Discover or Add by IP.</p>
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

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy === row.device.address}
                    onClick={() => void loadBrowse(row, 'queue')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700/70 hover:bg-gray-600 disabled:opacity-50"
                  >
                    <ListMusic size={12} /> Queue
                  </button>
                  <button
                    type="button"
                    disabled={busy === row.device.address}
                    onClick={() => void loadBrowse(row, 'favorites')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700/70 hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Star size={12} /> Favorites
                  </button>
                  <input
                    type="text"
                    value={uriInput}
                    onChange={(e) => setUriInput(e.target.value)}
                    placeholder="http://… or x-sonosapi-stream:…"
                    className="flex-1 min-w-[8rem] px-2 py-1 rounded-md bg-gray-950 border border-gray-700 font-mono text-[11px] text-gray-200 placeholder:text-gray-600"
                  />
                  <button
                    type="button"
                    disabled={busy === row.device.address || !uriInput.trim()}
                    onClick={() =>
                      run(row, `play-uri ${uriInput.trim()}`, () =>
                        row.device.playUri(uriInput.trim()),
                      )
                    }
                    className="px-2 py-1 rounded-md bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Play URI
                  </button>
                </div>

                {browse?.address === row.device.address && (
                  <div className="rounded-md border border-gray-700/80 bg-black/30 max-h-40 overflow-auto">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800">
                      {browse.kind} · {browse.items.length}/{browse.total}
                    </div>
                    {browse.items.length === 0 ? (
                      <p className="px-2 py-2 text-gray-600">Empty.</p>
                    ) : (
                      browse.items.map((item, i) => (
                        <button
                          key={`${item.id}-${i}`}
                          type="button"
                          disabled={busy === row.device.address || !item.uri}
                          onClick={() => void playBrowseItem(row, item)}
                          className="w-full text-left px-2 py-1.5 border-b border-gray-800/80 last:border-0 hover:bg-gray-700/40 disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <span className="text-gray-500 font-mono mr-1.5">[{i}]</span>
                          <span className="text-gray-200">{item.title ?? item.id}</span>
                          {(item.creator || item.description) && (
                            <span className="text-gray-500">
                              {' '}
                              · {item.creator ?? item.description}
                            </span>
                          )}
                          {(item.isContainer || item.resType === 'shortcut' || !item.uri) && (
                            <span className="ml-1 text-[10px] text-amber-500/80">
                              {item.resType === 'shortcut' ? 'shortcut' : !item.uri ? 'no uri' : 'folder'}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
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
