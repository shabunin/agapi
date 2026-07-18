import React, { useState } from 'react';
import { LayoutGrid, Radio, Layers } from 'lucide-react';
import CfApp from './apps/CfApp';
import NcApp from './apps/NcApp';

type AppId = 'launcher' | 'cf' | 'nc';

/**
 * Shell launcher — pick a frontend that runs on the shared stdlib host.
 * CF App  → @agapi/cf-loader
 * NC App  → plain React + @agapi/stdlib net/dgram (no CF)
 */
export default function App() {
  const [active, setActive] = useState<AppId>('launcher');

  if (active === 'cf') {
    return <CfApp onBack={() => setActive('launcher')} />;
  }
  if (active === 'nc') {
    return <NcApp onBack={() => setActive('launcher')} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10 mb-4">
            <LayoutGrid className="text-blue-300" size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
            agapi
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Shared stdlib host · pick a frontend
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setActive('cf')}
            className="w-full text-left group p-5 rounded-2xl border border-gray-800 bg-gray-900/80 hover:border-blue-500/40 hover:bg-gray-900 transition-all active:scale-[0.99]"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <Layers size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg text-gray-100 group-hover:text-white">
                  CF App
                </div>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  CommandFusion / iViewer runtime — open{' '}
                  <code className="text-gray-400">.gui</code> /{' '}
                  <code className="text-gray-400">.gui.zip</code>, Pixi UI, joins,
                  systems.
                </p>
                <p className="text-xs text-blue-400/80 mt-2 font-mono">
                  @agapi/cf-loader
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActive('nc')}
            className="w-full text-left group p-5 rounded-2xl border border-gray-800 bg-gray-900/80 hover:border-cyan-500/40 hover:bg-gray-900 transition-all active:scale-[0.99]"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <Radio size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg text-gray-100 group-hover:text-white">
                  NC Console
                </div>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Netcat-style TCP/UDP tool — connect, listen, send text or hex.
                  No CommandFusion, only stdlib sockets.
                </p>
                <p className="text-xs text-cyan-400/80 mt-2 font-mono">
                  @agapi/stdlib · net / dgram
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          Host installed in main.tsx · real sockets need Tauri
        </p>
      </div>
    </div>
  );
}
