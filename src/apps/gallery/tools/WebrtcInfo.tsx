import React, { useMemo } from 'react';
import { ToolShell } from '../components/ToolShell';
import { CapabilityTable, type CapRow } from '../components/CapabilityTable';
import { examplesFor } from '../examples';

function has(name: string): boolean {
  return typeof (globalThis as any)[name] !== 'undefined';
}

export default function WebrtcInfo({ onBack }: { onBack: () => void }) {
  const rows: CapRow[] = useMemo(() => {
    const g = globalThis as any;
    const pc = has('RTCPeerConnection');
    return [
      {
        name: 'RTCPeerConnection',
        supported: pc,
        detail: pc ? g.RTCPeerConnection?.name || 'present' : 'missing',
      },
      {
        name: 'RTCSessionDescription',
        supported: has('RTCSessionDescription'),
      },
      {
        name: 'RTCIceCandidate',
        supported: has('RTCIceCandidate'),
      },
      {
        name: 'RTCDataChannel (via PC)',
        supported: pc,
        detail: 'constructed after createDataChannel',
      },
      {
        name: 'mediaDevices.getUserMedia',
        supported: !!navigator?.mediaDevices?.getUserMedia,
        detail: navigator?.mediaDevices ? 'mediaDevices ok' : 'no mediaDevices',
      },
      {
        name: 'mediaDevices.enumerateDevices',
        supported: !!navigator?.mediaDevices?.enumerateDevices,
      },
      {
        name: 'mediaDevices.getDisplayMedia',
        supported: !!navigator?.mediaDevices?.getDisplayMedia,
      },
    ];
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '—';

  return (
    <ToolShell
      title="WebRTC"
      surface="browser WebRTC"
      status="info"
      onBack={onBack}
      examples={examplesFor('webrtc')}
    >
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Informational probe only — not a stdlib module yet. Use this page to see what the
          current webview exposes before designing a host integration.
        </p>
        <CapabilityTable rows={rows} />
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">User-Agent</div>
          <p className="text-xs font-mono text-gray-400 break-all">{ua}</p>
        </div>
      </div>
    </ToolShell>
  );
}
