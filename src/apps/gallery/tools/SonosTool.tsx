import React, { useEffect, useRef, useState } from 'react';
import {
  ListMusic,
  Pause,
  Play,
  Radio,
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
  DEFAULT_GENA_CALLBACK_PORT,
  SonosDevice,
  createAgapiEventServer,
  createAgapiSoapTransport,
  discoverSonos,
  type DidlItem,
  type SonosEventServer,
  type SonosEventSubscription,
  type SonosTransportState,
} from '@agapi/sonos';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

/**
 * Real Sonos control via @agapi/sonos — SSDP discovery, SOAP control, and
 * GENA event subscriptions (speaker → panel NOTIFY) over agapi.http.
 */

interface SpeakerRow {
  device: SonosDevice;
  roomName: string;
  modelName: string;
  state: SonosTransportState;
  volume: number;
  mute: boolean;
  /** Live GENA subscription active for this speaker. */
  eventsOn: boolean;
}

type BrowseKind = 'queue' | 'favorites';

interface BrowsePanel {
  address: string;
  kind: BrowseKind;
  items: DidlItem[];
  total: number;
}

async function loadRow(device: SonosDevice, eventsOn = false): Promise<SpeakerRow> {
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
    eventsOn,
  };
}

export default function SonosTool({ onBack }: { onBack: () => void }) {
  const [discovering, setDiscovering] = useState(false);
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [ipInput, setIpInput] = useState('');
  const [uriInput, setUriInput] = useState('');
  const [browse, setBrowse] = useState<BrowsePanel | null>(null);
  const [eventServerInfo, setEventServerInfo] = useState<string | null>(null);
  const [genaPort] = useState(DEFAULT_GENA_CALLBACK_PORT);

  const pendingVolume = useRef<Record<string, number>>({});
  const eventServerRef = useRef<SonosEventServer | null>(null);
  const subsRef = useRef<Map<string, SonosEventSubscription>>(new Map());

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-50), line]);

  const upsertSpeaker = (row: SpeakerRow) => {
    setSpeakers((prev) => {
      const i = prev.findIndex((r) => r.device.address === row.device.address);
      if (i < 0) return [...prev, row];
      const next = prev.slice();
      next[i] = row;
      return next;
    });
  };

  const patchSpeaker = (address: string, patch: Partial<SpeakerRow>) => {
    setSpeakers((prev) =>
      prev.map((r) => (r.device.address === address ? { ...r, ...patch } : r)),
    );
  };

  const refreshRow = async (device: SonosDevice) => {
    try {
      const eventsOn = subsRef.current.has(device.address);
      const row = await loadRow(device, eventsOn);
      upsertSpeaker(row);
    } catch (e: any) {
      pushLog(`refresh ${device.address} failed → ${e?.message ?? e}`);
    }
  };

  const ensureEventServer = async (): Promise<SonosEventServer> => {
    if (eventServerRef.current) return eventServerRef.current;
    pushLog(`GENA: starting callback server on :${genaPort}…`);
    const events = await createAgapiEventServer({ port: genaPort });
    eventServerRef.current = events;
    setEventServerInfo(events.callbackBaseUrl);
    pushLog(`GENA: CALLBACK ${events.callbackBaseUrl} (speaker must reach this host:port)`);
    return events;
  };

  const stopAllEvents = async () => {
    const subs = [...subsRef.current.values()];
    subsRef.current.clear();
    for (const s of subs) {
      try {
        await s.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    const server = eventServerRef.current;
    eventServerRef.current = null;
    setEventServerInfo(null);
    if (server) {
      try {
        await server.close();
      } catch {
        /* ignore */
      }
    }
    setSpeakers((prev) => prev.map((r) => ({ ...r, eventsOn: false })));
  };

  useEffect(() => {
    return () => {
      void stopAllEvents();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  const toggleEvents = async (row: SpeakerRow) => {
    const addr = row.device.address;
    setBusy(addr);
    try {
      const existing = subsRef.current.get(addr);
      if (existing) {
        await existing.unsubscribe();
        subsRef.current.delete(addr);
        patchSpeaker(addr, { eventsOn: false });
        pushLog(`${row.roomName}: GENA unsubscribed`);
        if (subsRef.current.size === 0) {
          const server = eventServerRef.current;
          eventServerRef.current = null;
          setEventServerInfo(null);
          if (server) await server.close();
          pushLog('GENA: callback server closed (no remaining subs)');
        }
        return;
      }

      const events = await ensureEventServer();
      const sub = await events.subscribe(row.device, {
        onTransport: (c) => {
          setSpeakers((prev) =>
            prev.map((r) => {
              if (r.device.address !== addr) return r;
              return {
                ...r,
                state: {
                  state: c.transportState ?? r.state.state,
                  trackTitle: c.trackTitle ?? r.state.trackTitle,
                  trackArtist: c.trackArtist ?? r.state.trackArtist,
                  trackAlbum: c.trackAlbum ?? r.state.trackAlbum,
                  trackUri: c.currentTrackURI ?? r.state.trackUri,
                },
              };
            }),
          );
          const track = [c.trackTitle, c.trackArtist].filter(Boolean).join(' · ');
          pushLog(
            `${row.roomName} [event] ${c.transportState ?? '?'}${track ? ` — ${track}` : ''}`,
          );
        },
        onVolume: (v) => {
          patchSpeaker(addr, { volume: v });
          pushLog(`${row.roomName} [event] volume ${v}`);
        },
        onMute: (m) => {
          patchSpeaker(addr, { mute: m });
          pushLog(`${row.roomName} [event] mute ${m ? 'on' : 'off'}`);
        },
        onError: (e, ctx) => {
          pushLog(`${row.roomName} [event err ${ctx.service}] ${e.message}`);
        },
      });
      subsRef.current.set(addr, sub);
      patchSpeaker(addr, { eventsOn: true });
      pushLog(
        `${row.roomName}: GENA subscribed SID AVT=${sub.sids.AVTransport ?? '—'} RC=${sub.sids.RenderingControl ?? '—'}`,
      );
    } catch (e: any) {
      pushLog(`${row.roomName}: GENA failed → ${e?.message ?? e}`);
      console.error('[SonosTool] GENA failed', e);
    } finally {
      setBusy(null);
    }
  };

  const discover = async () => {
    setDiscovering(true);
    setBrowse(null);
    await stopAllEvents();
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
      // With GENA on, NOTIFY will refresh UI; still poll once as a fallback.
      if (!row.eventsOn) await refreshRow(row.device);
      else {
        // brief delay then soft refresh if no event yet
        setTimeout(() => void refreshRow(row.device), 400);
      }
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
      surface="@agapi/sonos · dgram + http + GENA"
      status="lab"
      onBack={onBack}
      examples={examplesFor('sonos')}
    >
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Driver surface: SSDP discover, SOAP control (play/volume/browse), and{' '}
          <strong className="text-gray-300 font-medium">GENA events</strong> — the speaker pushes
          state to an <code className="text-gray-300">agapi.http.createServer</code> CALLBACK so the
          UI does not poll. See the code examples tab for the full API.
        </p>

        <section className="space-y-2 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-gray-400">
          <h3 className="text-sm font-semibold text-emerald-300/90 flex items-center gap-1.5">
            <Radio size={14} /> GENA event API
          </h3>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>
              <code className="text-gray-300">createAgapiEventServer(&#123; port: 3400 &#125;)</code>{' '}
              — one LAN listener; CALLBACK host is auto-picked via{' '}
              <code className="text-gray-300">agapi.device.getNetworkStatus()</code>.
            </li>
            <li>
              <code className="text-gray-300">
                events.subscribe(device, &#123; onTransport, onVolume, onMute, onChange &#125;)
              </code>{' '}
              — SUBSCRIBE AVTransport + RenderingControl; auto-renews; returns SIDs.
            </li>
            <li>
              <code className="text-gray-300">sub.unsubscribe()</code> /{' '}
              <code className="text-gray-300">events.close()</code> — clean leave.
            </li>
          </ol>
          <p className="text-[11px] text-gray-500">
            Requirement: the speaker must open TCP to this machine on the callback port (firewall /
            guest Wi‑Fi isolation will silently block NOTIFY). Dev harness:{' '}
            <code className="text-gray-400">npx tsx packages/sonos/dev/events.ts &lt;ip&gt;</code>
          </p>
          {eventServerInfo && (
            <p className="font-mono text-[11px] text-emerald-400/90">
              live CALLBACK {eventServerInfo}
            </p>
          )}
        </section>

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
                    {row.eventsOn && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-400">
                        live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {transportButtons(row)}
                    <button
                      type="button"
                      disabled={busy === row.device.address}
                      onClick={() => refreshRow(row.device)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 disabled:opacity-50"
                      title="Refresh state (SOAP poll)"
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
                    value={row.volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      pendingVolume.current[row.device.address] = v;
                      patchSpeaker(row.device.address, { volume: v });
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
                    onClick={() => void toggleEvents(row)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md disabled:opacity-50 ${
                      row.eventsOn
                        ? 'bg-emerald-700/80 hover:bg-emerald-600 text-white'
                        : 'bg-gray-700/70 hover:bg-gray-600'
                    }`}
                    title="Subscribe to GENA events (transport + volume)"
                  >
                    <Radio size={12} /> {row.eventsOn ? 'Events on' : 'Subscribe events'}
                  </button>
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
                              {item.resType === 'shortcut'
                                ? 'shortcut'
                                : !item.uri
                                  ? 'no uri'
                                  : 'folder'}
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
