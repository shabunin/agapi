import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import net, { dgram } from './lib/net';
import * as http from './lib/http';
import { TauriNetworkProvider } from './lib/tauri-net/provider';

(window as any).CF = (window as any).CF || {};
(window as any).net = net;
(window as any).dgram = dgram;
(window as any).http = http;

// Set Tauri Network Provider for real socket operations
try {
  net.setProvider(new TauriNetworkProvider());
} catch (e) {
  console.warn("Could not set Tauri Network Provider (maybe running in plain browser?)", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
