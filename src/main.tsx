import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  installStdlib,
  net,
  dgram,
  installBufferGlobal,
  installProcessGlobal,
} from '@agapi/stdlib';
import { createTauriHost } from '@agapi/host-tauri';

// Layer bootstrap:
//   tauri-rust ← tauri-js (host-tauri) ← stdlib-js ← application / CF scripts
const isTauri =
  typeof window !== 'undefined' &&
  !!(window as any).__TAURI_INTERNALS__;

if (isTauri) {
  installStdlib(createTauriHost());
} else {
  // Browser preview: mock net/dgram + Buffer/process; http needs real host
  (window as any).net = net;
  (window as any).dgram = dgram;
  installBufferGlobal();
  installProcessGlobal();
  console.warn('[agapi] running without Tauri — mock net/dgram; http server unavailable');
}

(window as any).CF = (window as any).CF || {};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
