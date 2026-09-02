import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Antenna,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Plug,
  Radio,
  Send,
  Square,
  Video,
  VideoOff,
  Waypoints,
} from 'lucide-react';
import { mdns, http } from '@agapi/stdlib';
import type { MdnsBrowseHandle, MdnsPublishHandle, MdnsService } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

const SERVICE_TYPE = '_agapi-webrtc._tcp';

type SignalMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit };

interface ChatLine {
  from: 'me' | 'peer';
  text: string;
}

/** Best-effort ICE candidate type — `.type` when the webview exposes it, else parsed from the SDP string. */
function candidateType(c: RTCIceCandidate): string {
  const t = (c as any).type;
  if (t) return t;
  const m = /typ (\w+)/.exec(c.candidate || '');
  return m?.[1] || 'unknown';
}

/**
 * Fully serverless, LAN-only WebRTC P2P demo. RTCPeerConnection is a plain
 * browser global (stdlib never wraps it) — the only thing agapi provides is
 * the *rendezvous*: mDNS discovery + a local signaling channel
 * (agapi.http.WebSocketServer/WebSocket) to shuttle SDP/ICE, before the data
 * channel (and later, media) takes over. No STUN/TURN, no internet, nothing
 * external at any point — iceServers stays empty on purpose.
 *
 * Negotiation is driven entirely by `onnegotiationneeded`: creating the data
 * channel triggers the first offer, and later adding/removing local media
 * tracks (Start call / Hang up) triggers a renegotiation round over the same
 * already-open signaling connection — no separate "call setup" protocol.
 */
export default function WebrtcP2PTool({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<'host' | 'join' | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [dcOpen, setDcOpen] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [iceState, setIceState] = useState('new');
  const [callActive, setCallActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteMediaActive, setRemoteMediaActive] = useState(false);

  // host
  const [port, setPort] = useState('8787');
  const [hosting, setHosting] = useState(false);
  const wsServerRef = useRef<any>(null);

  // join
  const [discovering, setDiscovering] = useState(false);
  const [found, setFound] = useState<{ key: string; service: MdnsService }[]>([]);
  const [joining, setJoining] = useState(false);
  const browseRef = useRef<MdnsBrowseHandle | null>(null);
  const wsClientRef = useRef<any>(null);

  // shared peer connection
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const publishRef = useRef<MdnsPublishHandle | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const negotiatingRef = useRef(false);
  const sendSignalRef = useRef<((msg: SignalMessage) => void) | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-100), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  }, []);

  const wireDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dcRef.current = dc;
      dc.onopen = () => {
        setDcOpen(true);
        pushLog('data channel open');
      };
      dc.onclose = () => {
        setDcOpen(false);
        pushLog('data channel closed');
      };
      dc.onmessage = (ev) => {
        setChat((prev) => [...prev, { from: 'peer', text: String(ev.data) }]);
      };
    },
    [pushLog]
  );

  const applyIce = useCallback(async (pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit) => {
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    await pc.addIceCandidate(candidate);
  }, []);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of queued) {
      await pc.addIceCandidate(c);
    }
  }, []);

  /** Handles every inbound signaling message, for both the initial handshake and later renegotiation rounds. */
  const handleSignal = useCallback(
    async (pc: RTCPeerConnection, msg: SignalMessage) => {
      const send = sendSignalRef.current;
      if (!send) return;
      if (msg.type === 'offer') {
        await pc.setRemoteDescription(msg.sdp);
        await flushPendingIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'answer', sdp: pc.localDescription! });
      } else if (msg.type === 'answer') {
        await pc.setRemoteDescription(msg.sdp);
        await flushPendingIce(pc);
        negotiatingRef.current = false;
      } else if (msg.type === 'ice') {
        await applyIce(pc, msg.candidate);
      }
    },
    [applyIce, flushPendingIce]
  );

  /** One RTCPeerConnection per session — created on the first offer/answer, reused for every later renegotiation. */
  const makePeerConnection = useCallback(
    (send: (msg: SignalMessage) => void) => {
      const pc = new RTCPeerConnection({ iceServers: [] }); // LAN only — no STUN/TURN
      pcRef.current = pc;
      sendSignalRef.current = send;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          pushLog(`local ICE candidate: ${candidateType(e.candidate)} ${e.candidate.address || ''}`);
          send({ type: 'ice', candidate: e.candidate.toJSON() });
        }
      };
      pc.oniceconnectionstatechange = () => {
        setIceState(pc.iceConnectionState);
        pushLog(`ICE state → ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => pushLog(`connection state → ${pc.connectionState}`);
      pc.ontrack = (e) => {
        setRemoteMediaActive(true);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        e.track.onended = () => {
          setRemoteMediaActive(false);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        };
      };
      pc.onnegotiationneeded = async () => {
        if (negotiatingRef.current || pc.signalingState !== 'stable') return;
        negotiatingRef.current = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ type: 'offer', sdp: pc.localDescription! });
        } catch (e: any) {
          negotiatingRef.current = false;
          pushLog(`negotiation err: ${e?.message || e}`);
        }
      };

      return pc;
    },
    [pushLog]
  );

  const cleanupPeer = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    sendSignalRef.current = null;
    pendingIceRef.current = [];
    negotiatingRef.current = false;
    setDcOpen(false);
    setIceState('new');
    setCallActive(false);
    setRemoteMediaActive(false);
  }, []);

  const stopHost = useCallback(async () => {
    cleanupPeer();
    const server = wsServerRef.current;
    wsServerRef.current = null;
    if (server) void server.close();
    const pub = publishRef.current;
    publishRef.current = null;
    if (pub) {
      try {
        await pub.stop();
      } catch {
        /* best-effort */
      }
    }
    setHosting(false);
  }, [cleanupPeer]);

  const stopJoin = useCallback(() => {
    cleanupPeer();
    browseRef.current?.stop();
    browseRef.current = null;
    setDiscovering(false);
    setFound([]);
    wsClientRef.current?.close();
    wsClientRef.current = null;
    setJoining(false);
  }, [cleanupPeer]);

  useEffect(() => {
    return () => {
      void stopHost();
      stopJoin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Host ────────────────────────────────────────────────────
  const startHosting = async () => {
    await stopHost();
    const p = parseInt(port, 10);
    if (!Number.isFinite(p) || p <= 0) {
      pushLog('err: invalid port');
      return;
    }
    setRole('host');
    try {
      const server = new http.WebSocketServer({ port: p });
      let activeConn: any = null;

      server.on('listening', () => {
        setHosting(true);
        pushLog(`signaling server listening on :${p}`);
      });

      server.on('error', (err: any) => pushLog(`server err: ${err?.message || err}`));

      server.on('connection', (conn: any) => {
        if (activeConn) {
          pushLog(`rejecting extra peer ${conn.id} — one session at a time`);
          conn.close?.();
          return;
        }
        activeConn = conn;
        pushLog(`peer connected ${conn.id} — negotiating`);

        const send = (msg: SignalMessage) => conn.send(JSON.stringify(msg));
        const pc = makePeerConnection(send);
        wireDataChannel(pc.createDataChannel('agapi')); // → onnegotiationneeded → initial offer

        conn.on('message', (raw: string) => {
          void handleSignal(pc, JSON.parse(raw));
        });

        conn.on('close', () => {
          if (activeConn === conn) activeConn = null;
          pushLog(`peer ${conn.id} disconnected`);
          cleanupPeer();
        });
      });

      wsServerRef.current = server;

      const pub = await mdns.publish({
        type: SERVICE_TYPE,
        name: `agapi-${Math.random().toString(36).slice(2, 8)}`,
        port: p,
      });
      publishRef.current = pub;
      pushLog(`advertised on mDNS as ${SERVICE_TYPE}`);
    } catch (e: any) {
      pushLog(`err: ${e?.message || e}`);
      setHosting(false);
    }
  };

  // ── Join ────────────────────────────────────────────────────
  const startDiscovery = () => {
    browseRef.current?.stop();
    setFound([]);
    setRole('join');
    setDiscovering(true);
    const handle = mdns.browse(SERVICE_TYPE, (ev) => {
      if (ev.type === 'resolved' && ev.service) {
        const s = ev.service;
        const key = s.fullname || `${s.name}.${s.serviceType}`;
        setFound((prev) => (prev.some((r) => r.key === key) ? prev : [...prev, { key, service: s }]));
        pushLog(`found ${s.name} → ${s.addresses.join(', ') || s.host}:${s.port}`);
      } else if (ev.type === 'error') {
        pushLog(`discover err: ${ev.error?.message || ev.error}`);
      }
    });
    browseRef.current = handle;
  };

  const stopDiscovery = () => {
    browseRef.current?.stop();
    browseRef.current = null;
    setDiscovering(false);
  };

  const joinHost = (service: MdnsService) => {
    stopDiscovery();
    const addr = service.addresses[0] || service.host;
    setJoining(true);
    pushLog(`connecting to ${addr}:${service.port}…`);
    try {
      const ws = new http.WebSocket(`ws://${addr}:${service.port}`);
      wsClientRef.current = ws;

      ws.onopen = () => pushLog('signaling channel open');
      ws.onerror = () => pushLog('signaling channel error');
      ws.onclose = () => {
        pushLog('signaling channel closed');
        cleanupPeer();
        setJoining(false);
      };
      ws.onmessage = (ev: MessageEvent) => {
        void (async () => {
          const msg: SignalMessage = JSON.parse(String(ev.data));
          let pc = pcRef.current;
          if (!pc) {
            const send = (m: SignalMessage) => ws.send(JSON.stringify(m));
            pc = makePeerConnection(send);
            pc.ondatachannel = (e) => wireDataChannel(e.channel);
          }
          await handleSignal(pc, msg);
        })();
      };
    } catch (e: any) {
      pushLog(`err: ${e?.message || e}`);
      setJoining(false);
    }
  };

  // ── Chat (data channel) ────────────────────────────────────
  const sendChat = () => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open' || !chatInput) return;
    dc.send(chatInput);
    setChat((prev) => [...prev, { from: 'me', text: chatInput }]);
    setChatInput('');
  };

  // ── Call (audio + video) ────────────────────────────────────
  const startCall = async () => {
    const pc = pcRef.current;
    if (!pc) {
      pushLog('not connected yet');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream)); // → onnegotiationneeded
      setMicOn(true);
      setCamOn(true);
      setCallActive(true);
      pushLog('call started — local media added, renegotiating');
    } catch (e: any) {
      pushLog(`getUserMedia err: ${e?.message || e}`);
    }
  };

  const hangupCall = () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (pc) {
      pc.getSenders().forEach((s) => {
        if (s.track) pc.removeTrack(s); // → onnegotiationneeded again
      });
    }
    setCallActive(false);
    pushLog('call ended — local media removed');
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  return (
    <ToolShell
      title="WebRTC P2P (LAN)"
      surface="RTCPeerConnection + agapi.mdns + agapi.http.WebSocketServer/WebSocket"
      status="lab"
      onBack={onBack}
      examples={examplesFor('webrtc-p2p')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        {role === null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('host')}
              className="p-4 rounded-2xl border border-gray-800 bg-gray-900/60 hover:bg-gray-900 hover:border-gray-700 text-left"
            >
              <div className="flex items-center gap-2 font-semibold text-gray-100 mb-1">
                <Radio size={16} className="text-fuchsia-400" /> Host
              </div>
              <p className="text-xs text-gray-500">Advertise on mDNS, wait for a peer, make the offer.</p>
            </button>
            <button
              type="button"
              onClick={() => setRole('join')}
              className="p-4 rounded-2xl border border-gray-800 bg-gray-900/60 hover:bg-gray-900 hover:border-gray-700 text-left"
            >
              <div className="flex items-center gap-2 font-semibold text-gray-100 mb-1">
                <Antenna size={16} className="text-fuchsia-400" /> Join
              </div>
              <p className="text-xs text-gray-500">Discover a host on the LAN via mDNS, answer its offer.</p>
            </button>
          </div>
        )}

        {role === 'host' && (
          <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Radio size={16} className="text-fuchsia-400" /> Host
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="w-28 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8787"
                disabled={hosting}
              />
              {!hosting ? (
                <button
                  type="button"
                  onClick={() => void startHosting()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-medium"
                >
                  <Waypoints size={14} /> Start hosting
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void stopHost().then(() => setRole(null))}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-sm"
                >
                  <Square size={14} /> Stop
                </button>
              )}
              {!hosting && (
                <button
                  type="button"
                  onClick={() => setRole(null)}
                  className="px-3 py-2 rounded-lg border border-gray-800 text-xs text-gray-500"
                >
                  back
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Waits for one peer, then negotiates automatically. Advertised as{' '}
              <code className="text-gray-400">{SERVICE_TYPE}</code>.
            </p>
          </section>
        )}

        {role === 'join' && (
          <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Antenna size={16} className="text-fuchsia-400" /> Join
            </h2>
            <div className="flex gap-2">
              {!discovering ? (
                <button
                  type="button"
                  onClick={startDiscovery}
                  disabled={joining}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-medium disabled:opacity-40"
                >
                  <Radio size={14} /> Discover
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopDiscovery}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-sm"
                >
                  <Square size={14} /> Stop
                </button>
              )}
              {!joining && (
                <button
                  type="button"
                  onClick={() => {
                    stopDiscovery();
                    setRole(null);
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-800 text-xs text-gray-500"
                >
                  back
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {found.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs font-mono"
                >
                  <span className="truncate">
                    {r.service.name} · {r.service.addresses.join(', ') || r.service.host}:{r.service.port}
                  </span>
                  <button
                    type="button"
                    onClick={() => joinHost(r.service)}
                    disabled={joining}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                  >
                    <Plug size={12} /> connect
                  </button>
                </li>
              ))}
              {found.length === 0 && (
                <li className="text-xs text-gray-600">
                  {discovering ? 'Waiting for a host…' : '— no hosts found yet —'}
                </li>
              )}
            </ul>
          </section>
        )}

        {role !== null && (
          <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Phone size={16} className="text-fuchsia-400" /> Call
              <span className={`text-[10px] font-mono ${dcOpen ? 'text-emerald-400' : 'text-gray-500'}`}>
                {dcOpen ? 'connected' : `ICE: ${iceState}`}
              </span>
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-gray-800">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-gray-300">
                  you
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-gray-800">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-gray-300">
                  peer
                </span>
                {!remoteMediaActive && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">
                    no media yet
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {!callActive ? (
                <button
                  type="button"
                  onClick={() => void startCall()}
                  disabled={!dcOpen}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-sm font-medium disabled:opacity-40"
                >
                  <Phone size={14} /> Start call
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={hangupCall}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-sm font-medium"
                  >
                    <PhoneOff size={14} /> Hang up
                  </button>
                  <button
                    type="button"
                    onClick={toggleMic}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-sm"
                  >
                    {micOn ? <Mic size={14} /> : <MicOff size={14} className="text-red-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleCam}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-sm"
                  >
                    {camOn ? <Video size={14} /> : <VideoOff size={14} className="text-red-400" />}
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {role !== null && (
          <section className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Waypoints size={16} className="text-fuchsia-400" /> Data channel chat
            </h2>
            <div className="rounded-xl border border-gray-800 bg-black/30 p-3 max-h-40 overflow-auto space-y-1">
              {chat.length === 0 ? (
                <p className="text-xs text-gray-600">— no messages —</p>
              ) : (
                chat.map((c, i) => (
                  <p
                    key={i}
                    className={`text-xs font-mono ${c.from === 'me' ? 'text-fuchsia-300' : 'text-emerald-300'}`}
                  >
                    {c.from}: {c.text}
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm font-mono"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="message over the data channel"
                disabled={!dcOpen}
              />
              <button
                type="button"
                onClick={sendChat}
                disabled={!dcOpen}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600/90 hover:bg-fuchsia-600 text-sm font-medium disabled:opacity-40"
              >
                <Send size={14} /> Send
              </button>
            </div>
          </section>
        )}

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-48 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Fully serverless: mDNS finds the peer, a local WebSocket carries the SDP/ICE handshake
          (including renegotiation when a call starts/ends), then RTCPeerConnection takes over —
          nothing leaves the LAN, <code className="text-gray-500">iceServers</code> stays empty (no
          STUN/TURN). Needs Tauri host on both sides; open this tool on two devices on the same
          network. Android needs the camera/mic permission prompt accepted once.
        </p>
      </div>
    </ToolShell>
  );
}
