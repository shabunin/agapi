import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Beaker,
  Bell,
  Bluetooth,
  Cpu,
  Fingerprint,
  FolderOpen,
  Globe,
  Hand,
  KeyRound,
  LayoutGrid,
  Network,
  Nfc,
  Plug,
  Radio,
  ScanSearch,
  Speaker,
  Server,
  Share2,
  Shield,
  Signal,
  Sparkles,
  Vibrate,
  Video,
  Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GALLERY_TOOLS } from './catalog';
import { StatusBadge } from './components/StatusBadge';
import { examplesFor } from './examples';
import type { GalleryGroup, GalleryToolId } from './types';
import SocketsTool from './tools/SocketsTool';
import TlsTool from './tools/TlsTool';
import HttpTool from './tools/HttpTool';
import HttpServerTool from './tools/HttpServerTool';
import WebSocketServerTool from './tools/WebSocketServerTool';
import WebSocketClientTool from './tools/WebSocketClientTool';
import DnsTool from './tools/DnsTool';
import MdnsTool from './tools/MdnsTool';
import NetworkStatusTool from './tools/NetworkStatusTool';
import OsInfoTool from './tools/OsInfoTool';
import BluetoothStub from './tools/BluetoothStub';
import SensorsStub from './tools/SensorsStub';
import HapticsTool from './tools/HapticsTool';
import NotificationsTool from './tools/NotificationsTool';
import FsTool from './tools/FsTool';
import NfcTool from './tools/NfcTool';
import BiometricTool from './tools/BiometricTool';
import CryptoInfo from './tools/CryptoInfo';
import WebrtcInfo from './tools/WebrtcInfo';
import WebcodecsInfo from './tools/WebcodecsInfo';
import WebAnimationsTool from './tools/WebAnimationsTool';
import GesturesTool from './tools/GesturesTool';
import SonosTool from './tools/SonosTool';

const ICONS: Record<Exclude<GalleryToolId, 'hub'>, LucideIcon> = {
  sockets: Radio,
  tls: Shield,
  http: Globe,
  'http-server': Server,
  'websocket-server': Share2,
  'websocket-client': Plug,
  dns: ScanSearch,
  mdns: Wifi,
  'network-status': Signal,
  'os-info': Cpu,
  bluetooth: Bluetooth,
  sensors: Activity,
  haptics: Vibrate,
  notifications: Bell,
  fs: FolderOpen,
  nfc: Nfc,
  biometrics: Fingerprint,
  webrtc: Network,
  webcodecs: Video,
  crypto: KeyRound,
  'web-animations': Sparkles,
  gestures: Hand,
  sonos: Speaker,
};

const GROUP_LABEL: Record<GalleryGroup, string> = {
  network: 'Network',
  device: 'Device',
  browser: 'Browser APIs',
  drivers: 'Drivers',
};

const ACCENT: Record<string, string> = {
  cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 group-hover:border-cyan-400/50',
  emerald:
    'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 group-hover:border-emerald-400/50',
  violet:
    'bg-violet-500/15 border-violet-500/30 text-violet-400 group-hover:border-violet-400/50',
  sky: 'bg-sky-500/15 border-sky-500/30 text-sky-400 group-hover:border-sky-400/50',
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400 group-hover:border-amber-400/50',
  orange:
    'bg-orange-500/15 border-orange-500/30 text-orange-400 group-hover:border-orange-400/50',
  rose: 'bg-rose-500/15 border-rose-500/30 text-rose-400 group-hover:border-rose-400/50',
  indigo:
    'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 group-hover:border-indigo-400/50',
  fuchsia:
    'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-400 group-hover:border-fuchsia-400/50',
  teal: 'bg-teal-500/15 border-teal-500/30 text-teal-400 group-hover:border-teal-400/50',
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-400 group-hover:border-blue-400/50',
  pink: 'bg-pink-500/15 border-pink-500/30 text-pink-400 group-hover:border-pink-400/50',
  lime: 'bg-lime-500/15 border-lime-500/30 text-lime-400 group-hover:border-lime-400/50',
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
    return <SocketsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'tls') {
    return <TlsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'http') {
    return <HttpTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'http-server') {
    return <HttpServerTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'websocket-server') {
    return <WebSocketServerTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'websocket-client') {
    return <WebSocketClientTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'dns') {
    return <DnsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'mdns') {
    return <MdnsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'network-status') {
    return <NetworkStatusTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'os-info') {
    return <OsInfoTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'bluetooth') {
    return <BluetoothStub onBack={() => setTool('hub')} />;
  }
  if (tool === 'sensors') {
    return <SensorsStub onBack={() => setTool('hub')} />;
  }
  if (tool === 'haptics') {
    return <HapticsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'notifications') {
    return <NotificationsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'fs') {
    return <FsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'nfc') {
    return <NfcTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'biometrics') {
    return <BiometricTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'crypto') {
    return <CryptoInfo onBack={() => setTool('hub')} />;
  }
  if (tool === 'webrtc') {
    return <WebrtcInfo onBack={() => setTool('hub')} />;
  }
  if (tool === 'webcodecs') {
    return <WebcodecsInfo onBack={() => setTool('hub')} />;
  }
  if (tool === 'web-animations') {
    return <WebAnimationsTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'gestures') {
    return <GesturesTool onBack={() => setTool('hub')} />;
  }
  if (tool === 'sonos') {
    return <SonosTool onBack={() => setTool('hub')} />;
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
            Each tool includes a <span className="text-gray-300">live playground</span>: edit{' '}
            <code className="text-gray-300">agapi.*</code> code and hit{' '}
            <span className="text-emerald-400/90">Run</span> (Ctrl+Enter). Use{' '}
            <code className="text-gray-300">tauri:dev</code> for real I/O.
          </p>
        </div>

        {(['network', 'device', 'browser', 'drivers'] as const).map((group) => {
          const tools = GALLERY_TOOLS.filter((t) => t.group === group);
          if (tools.length === 0) return null;
          return (
            <section key={group} className="mb-8 last:mb-0">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                {GROUP_LABEL[group]}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tools.map((t) => {
                  const Icon = ICONS[t.id];
                  const accent = ACCENT[t.accent] ?? ACCENT.cyan;
                  const sample = examplesFor(t.id)[0];
                  const preview = sample?.code
                    .split('\n')
                    .map((l) => l.trimEnd())
                    .filter((l) => l.length > 0 && !l.trimStart().startsWith('//'))
                    .slice(0, 2)
                    .join(' ')
                    .slice(0, 72);
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
                          {preview && (
                            <p className="mt-2 text-[10px] font-mono text-cyan-500/70 truncate">
                              {preview}
                              {preview.length >= 72 ? '…' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
