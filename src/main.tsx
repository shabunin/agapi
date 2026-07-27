import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installStdlib, DefaultMockProvider } from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

// Layer bootstrap:
//   tauri-rust ← tauri-js (host-tauri) ← stdlib-js ← application / CF scripts
// Globals for classic project scripts: window.agapi.{net,dgram,http,dns,tls,Buffer,process}
const isTauri =
  typeof window !== 'undefined' &&
  !!(window as any).__TAURI_INTERNALS__;

if (isTauri) {
  installStdlib(createTauriHost(), { replaceFetch: true, replaceWebSocket: true });
} else {
  // Browser preview: mock net/dgram; http/dns/tls need a real host
  installStdlib({
    name: 'mock',
    net: new DefaultMockProvider(),
  });
  console.warn(
    '[agapi] running without Tauri — mock net/dgram; http/dns/tls unavailable'
  );
}

(window as any).CF = (window as any).CF || {};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
