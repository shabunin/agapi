import React, { useState } from 'react';
import {
  ArrowLeft,
  Beaker,
  Bluetooth,
  Camera,
  Globe,
  LayoutGrid,
  Network,
  Radio,
  ScanSearch,
  Shield,
  Video,
  Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import NcApp from '../NcApp';
import { GALLERY_TOOLS } from './catalog';
import { StatusBadge } from './components/StatusBadge';
import type { GalleryToolId } from './types';
import TlsTool from './tools/TlsTool';
import HttpTool from './tools/HttpTool';
import DnsTool from './tools/DnsTool';
import MdnsStub from './tools/MdnsStub';
import CameraStub from './tools/CameraStub';
import BluetoothStub from './tools/BluetoothStub';
import WebrtcInfo from './tools/WebrtcInfo';
import WebcodecsInfo from './tools/WebcodecsInfo';

const ICONS: Record<Exclude<GalleryToolId, 'hub'>, LucideIcon> = {
  sockets: Radio,
  tls: Shield,
  http: Globe,
  dns: ScanSearch,
  mdns: Wifi,
  camera: Camera,
  bluetooth: Bluetooth,
  webrtc: Network,
  webcodecs: Video,
};

const ACCENT: Record<string, string> = {
  cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 group-hover:border-cyan-400/50',
  emerald:
    'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 group-hover:border-emerald-400/50',
  violet:
    'bg-violet-500/15 border-violet-500/30 text-violet-400 group-hover:border-violet-400/50',
  sky: 'bg-sky-500/15 border-sky-500/30 text-sky-400 group-hover:border-sky-400/50',
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400 group-hover:border-amber-400/50',
  rose: 'bg-rose-500/15 border-rose-500/30 text-rose-400 group-hover:border-rose-400/50',
  indigo:
    'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 group-hover:border-indigo-400/50',
  fuchsia:
    'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-400 group-hover:border-fuchsia-400/50',
  teal: 'bg-teal-500/15 border-teal-500/30 text-teal-400 group-hover:border-teal-400/50',
};

export interface GalleryAppProps {
  onBack?: () => void;
}

/**
 * Stdlib feature gallery — interactive labs + stubs for roadmap items.
 * See docs/STDLIB_ROADMAP.md.
 */
export default function GalleryApp({ onBack }: GalleryAppProps) {
  const [tool, setTool] = useState<GalleryToolId>('hub');

  if (tool === 'sockets') {
    return <NcApp onBack={() => setTool('hub')} />;
  }
  if (tool === 'tls') {
    return <TlsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'http') {
    return <HttpTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'dns') {
    return <DnsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'mdns') {
    return <MdnsStub onBack={() => setTool('hub')} />;
  }
  if (tool === 'camera') {
    return <CameraStub onBack={() => setTool('hub')} />;
  }
  if (tool === 'bluetooth') {
    return <BluetoothStub onBack={() => setTool('hub')} />;
  }
  if (tool === 'webrtc') {
    return <WebrtcInfo onBack={() => setTool('hub')} />;
  }
  if (tool === 'webcodecs') {
    return <WebcodecsInfo onBack={() => setTool('hub')} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              title="Back to launcher"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Beaker size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-lg tracking-tight">Stdlib Gallery</h1>
              <p className="text-xs text-gray-500 truncate">
                Verify @agapi/stdlib · roadmap in docs/STDLIB_ROADMAP.md
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start gap-3 mb-8 p-4 rounded-2xl border border-gray-800 bg-gray-900/40">
          <LayoutGrid className="text-gray-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-gray-400 leading-relaxed">
            Live and lab tools hit the real host (use{' '}
            <code className="text-gray-300">tauri:dev</code> for sockets / TLS / HTTP / DNS).
            Stubs and info pages track upcoming work without blocking the gallery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GALLERY_TOOLS.map((t) => {
            const Icon = ICONS[t.id];
            const accent = ACCENT[t.accent] ?? ACCENT.cyan;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                className="group text-left p-4 rounded-2xl border border-gray-800 bg-gray-900/60 hover:bg-gray-900 hover:border-gray-700 transition-all active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${accent}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-100 group-hover:text-white">
                        {t.title}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.blurb}</p>
                    <p className="text-[11px] font-mono text-gray-600 mt-2">{t.surface}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
