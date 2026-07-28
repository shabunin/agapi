/**
 * Self-documenting gallery: code samples shown next to interactive labs.
 * Prefer classic project-script style (`agapi.*`) — no ESM import required.
 */

export interface CodeSnippet {
  id: string;
  /** Short tab / heading label */
  title: string;
  /** One-line why this snippet exists */
  description?: string;
  lang?: 'js' | 'ts';
  code: string;
  /**
   * When false, playground shows the sample but disables Run
   * (e.g. ESM import-only, or future API sketches).
   * Default: true
   */
  runnable?: boolean;
}

export type ExampleToolId =
  | 'sockets'
  | 'tls'
  | 'http'
  | 'http-server'
  | 'websocket-server'
  | 'websocket-client'
  | 'dns'
  | 'mdns'
  | 'network-status'
  | 'os-info'
  | 'bluetooth'
  | 'sensors'
  | 'haptics'
  | 'notifications'
  | 'fs'
  | 'nfc'
  | 'biometrics'
  | 'webrtc'
  | 'webcodecs'
  | 'crypto';

export const TOOL_EXAMPLES: Record<ExampleToolId, CodeSnippet[]> = {
  sockets: [
    {
      id: 'tcp-client',
      title: 'TCP client',
      description: 'Connect, write, read Buffer chunks',
      code: `// project script — agapi installed by shell
const s = agapi.net.connect(23, '192.168.1.10', () => {
  s.write('hello\\r\\n');
});

s.on('data', (buf) => {
  CF.setJoin('s1', buf.toString('utf8'));
});

s.on('error', (err) => {
  console.log(err.code); // e.g. ECONNREFUSED
});

s.on('close', () => console.log('closed'));`,
    },
    {
      id: 'tcp-server',
      title: 'TCP server',
      description: 'Listen and echo',
      code: `const server = agapi.net.createServer((socket) => {
  console.log('peer', socket.remoteAddress, socket.remotePort);
  socket.on('data', (buf) => {
    socket.write(buf); // echo
  });
});

server.listen(9000, '0.0.0.0', () => {
  console.log('listening', server.address());
});`,
    },
    {
      id: 'udp',
      title: 'UDP',
      description: 'Bind + send / message',
      code: `const sock = agapi.dgram.createSocket('udp4');

sock.on('message', (msg, rinfo) => {
  console.log(rinfo.address, rinfo.port, msg.toString());
});

sock.bind(0, '0.0.0.0', () => {
  const a = sock.address();
  console.log('bound', a.address, a.port);
  sock.send(agapi.Buffer.from('ping'), 9000, '192.168.1.1');
});`,
    },
  ],

  tls: [
    {
      id: 'tls-get',
      title: 'TLS + HTTP/1.1',
      description: 'tls.connect then raw request',
      code: `const s = agapi.tls.connect({
  host: 'example.com',
  port: 443,
  servername: 'example.com',   // SNI
  rejectUnauthorized: true,    // false = lab / self-signed
}, () => {
  s.write(
    'GET / HTTP/1.1\\r\\n' +
    'Host: example.com\\r\\n' +
    'Connection: close\\r\\n\\r\\n'
  );
});

s.on('data', (buf) => console.log(buf.toString('utf8')));
s.on('error', (err) => console.error(err.message, err.code));`,
    },
    {
      id: 'tls-import',
      title: 'ESM import',
      description: 'Package style (not runnable in playground — use agapi.tls instead)',
      runnable: false,
      code: `import { tls } from '@agapi/stdlib';

const s = tls.connect({ host: 'example.com', port: 443 }, () => {
  s.write('ping');
});`,
    },
  ],

  http: [
    {
      id: 'http-get',
      title: 'GET',
      description: 'agapi.http.request (host-backed)',
      code: `const req = agapi.http.request({
  url: 'https://httpbin.org/get',
  method: 'GET',
  headers: { Accept: 'application/json' },
  // public site: verify certs
  rejectUnauthorized: true,
}, (res) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    const body = agapi.Buffer.concat(chunks).toString('utf8');
    console.log(res.statusCode, body);
  });
});

req.on('error', (err) => console.error(err));
req.end();`,
    },
    {
      id: 'http-local-tls',
      title: 'Local HTTPS',
      description: 'rejectUnauthorized:false — accept self-signed device certs',
      code: `// URL is often a bare IP with a self-signed cert on local gear

const req = agapi.http.request({
  url: 'https://192.168.1.174:1843/xml/device_description.xml',
  method: 'GET',
  rejectUnauthorized: false, // default if omitted — accept self-signed / bad hostname
  headers: { Accept: 'application/xml' },
}, (res) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    console.log(res.statusCode, agapi.Buffer.concat(chunks).toString('utf8').slice(0, 500));
  });
});
req.on('error', (err) => console.error(err.message || err));
req.end();`,
    },
    {
      id: 'http-post',
      title: 'POST JSON',
      description: 'Write body before end()',
      code: `const body = JSON.stringify({ hello: 'agapi' });

const req = agapi.http.request({
  url: 'https://httpbin.org/post',
  method: 'POST',
  rejectUnauthorized: true,
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': String(agapi.Buffer.byteLength(body)),
  },
}, (res) => {
  // …collect data as in GET
});

req.write(body);
req.end();`,
    },
    {
      id: 'http-fetch',
      title: 'fetch()',
      description: 'Plain browser fetch — no agapi options, no cert bypass',
      code: `// Ordinary fetch(), untouched by agapi: Tauri's own IPC uses global
// fetch() internally, so stdlib never overrides it. Use agapi.http.request
// for local self-signed gear instead — fetch() can't skip cert checks.

const res = await fetch('https://httpbin.org/ip');
console.log(res.status, await res.text());`,
    },
  ],

  'http-server': [
    {
      id: 'http-server-basic',
      title: 'Listen + reply',
      description: 'agapi.http.createServer (host-backed)',
      code: `const server = agapi.http.createServer((req, res) => {
  console.log(req.method, req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, path: req.url }));
});

server.listen(8080, () => {
  console.log('listening on :8080');
});

// later: server.close();`,
    },
    {
      id: 'http-server-body',
      title: 'Read request body',
      description: 'IncomingMessage is a Node-ish stream',
      code: `const server = agapi.http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = agapi.Buffer.concat(chunks).toString('utf8');
    console.log('body', body);
    res.writeHead(204);
    res.end();
  });
});

server.listen(8080);`,
    },
  ],

  'websocket-server': [
    {
      id: 'ws-server-basic',
      title: 'Accept + echo',
      description: 'agapi.http.WebSocketServer (custom, not a Tauri plugin)',
      code: `const wss = new agapi.http.WebSocketServer({ port: 8081 });

wss.on('connection', (conn) => {
  console.log('client connected', conn.id, conn.url);

  conn.on('message', (data) => {
    console.log('recv', data);
    conn.send(data); // echo
  });

  conn.on('close', () => {
    console.log('client gone', conn.id);
  });
});

// later: wss.close();`,
    },
    {
      id: 'ws-server-broadcast',
      title: 'Broadcast',
      description: 'Track connections yourself, fan out sends',
      code: `const wss = new agapi.http.WebSocketServer({ port: 8081 });
const clients = new Set();

wss.on('connection', (conn) => {
  clients.add(conn);
  conn.on('close', () => clients.delete(conn));
});

function broadcast(text) {
  for (const c of clients) c.send(text);
}

// broadcast('hello everyone');`,
    },
  ],

  'websocket-client': [
    {
      id: 'ws-client-basic',
      title: 'Connect + send',
      description: 'agapi.http.WebSocket — MDN-compatible',
      code: `const ws = new agapi.http.WebSocket('wss://ws.postman-echo.com/raw');

ws.onopen = () => {
  console.log('open');
  ws.send('hello from agapi');
};

ws.onmessage = (ev) => console.log('recv', ev.data);
ws.onerror = (ev) => console.error('error', ev);
ws.onclose = (ev) => console.log('closed', ev.code, ev.reason);

// later: ws.close();`,
    },
    {
      id: 'ws-client-binary',
      title: 'Binary frames',
      description: 'binaryType controls how Binary messages arrive',
      code: `const ws = new agapi.http.WebSocket('wss://ws.postman-echo.com/raw');
ws.binaryType = 'arraybuffer'; // default is 'blob', like real browsers

ws.onopen = () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  ws.send(bytes);
};

ws.onmessage = (ev) => {
  if (ev.data instanceof ArrayBuffer) {
    console.log('binary', new Uint8Array(ev.data));
  } else {
    console.log('text', ev.data);
  }
};`,
    },
    {
      id: 'ws-client-browser',
      title: 'Browser WebSocket',
      description: 'Plain global WebSocket — stdlib never replaces it',
      code: `// Same API shape as agapi.http.WebSocket, unrelated implementation:
// this is the browser/webview's own networking stack.
const ws = new WebSocket('wss://ws.postman-echo.com/raw');

ws.onopen = () => ws.send('hello from browser WebSocket');
ws.onmessage = (ev) => console.log('recv', ev.data);
ws.onclose = (ev) => console.log('closed', ev.code, ev.reason);`,
    },
  ],

  dns: [
    {
      id: 'dns-lookup',
      title: 'lookup',
      description: 'OS resolver via host.dns',
      code: `agapi.dns.lookup('example.com', (err, address, family) => {
  if (err) {
    console.error(err.code, err.message); // ENOTFOUND, …
    return;
  }
  console.log(address, family); // e.g. "93.184.216.34", 4
});`,
    },
    {
      id: 'dns-all',
      title: 'all addresses',
      description: 'options.all → array',
      code: `agapi.dns.lookup('example.com', { family: 4, all: true }, (err, list) => {
  if (err) return console.error(err);
  // list: [{ address, family }, …]
  list.forEach((a) => console.log(a.address, a.family));
});`,
    },
    {
      id: 'dns-async',
      title: 'lookupAsync',
      description: 'Promise helper (stdlib convenience)',
      code: `const one = await agapi.dns.lookupAsync('example.com');
// { address, family }

const all = await agapi.dns.lookupAsync('example.com', { all: true });`,
    },
  ],

  mdns: [
    {
      id: 'mdns-browse',
      title: 'browse',
      description: 'DNS-SD discovery on the LAN',
      code: `const handle = agapi.mdns.browse('_http._tcp', (ev) => {
  if (ev.type === 'resolved' && ev.service) {
    const s = ev.service;
    console.log(s.name, s.addresses, s.port, s.txt);
  }
  if (ev.type === 'removed') {
    console.log('gone', ev.fullname);
  }
  if (ev.type === 'error') {
    console.error(ev.error);
  }
});

// later
handle.stop();`,
    },
    {
      id: 'mdns-publish',
      title: 'publish',
      description: 'Advertise a service (Bonjour-style)',
      code: `const pub = await agapi.mdns.publish({
  type: '_agapi-demo._tcp',
  name: 'My Panel',
  port: 8080,
  txt: { path: '/', via: 'agapi' },
});

// later
await pub.stop();`,
    },
    {
      id: 'mdns-browser-ee',
      title: 'MdnsBrowser',
      description: 'EventEmitter wrapper',
      code: `const b = new agapi.mdns.MdnsBrowser();
b.on('resolved', (ev) => console.log(ev.service));
b.on('removed', (ev) => console.log('removed', ev.fullname));
b.start('_googlecast._tcp');
// b.stop();`,
    },
  ],

  'network-status': [
    {
      id: 'network-status-basic',
      title: 'getNetworkStatus',
      description: 'Online snapshot + local addresses',
      code: `const status = await agapi.device.getNetworkStatus();

console.log(status.hasNetwork, status.networkType);
for (const a of status.addresses) {
  console.log(a.interface, a.family, a.address, a.netmask);
}

// networkType is a best-effort guess from interface names.
// No ssid: needs platform-specific Wi-Fi APIs we don't have yet.`,
    },
    {
      id: 'network-status-watch',
      title: 'watchNetwork',
      description: 'Subscribe to Wi-Fi/Ethernet connect, disconnect, address change',
      code: `const handle = await agapi.device.watchNetwork((status) => {
  console.log(status.hasNetwork ? 'online' : 'offline', status.networkType);
});

// later, when done watching:
// handle.stop();`,
    },
  ],

  crypto: [
    {
      id: 'crypto-random',
      title: 'random',
      description: 'getRandomValues + randomUUID',
      code: `// Browser Web Crypto — not agapi.crypto
const buf = new Uint8Array(16);
crypto.getRandomValues(buf);
console.log('random hex', Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(''));

if (typeof crypto.randomUUID === 'function') {
  console.log('uuid', crypto.randomUUID());
} else {
  console.warn('randomUUID not available');
}`,
    },
    {
      id: 'crypto-sha256',
      title: 'SHA-256',
      description: 'subtle.digest',
      code: `const data = new TextEncoder().encode('hello agapi');
const dig = await crypto.subtle.digest('SHA-256', data);
const hex = Array.from(new Uint8Array(dig))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');
console.log('sha256', hex);`,
    },
    {
      id: 'crypto-hmac',
      title: 'HMAC',
      description: 'HMAC-SHA-256 via subtle',
      code: `const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode('secret'),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);
const sig = await crypto.subtle.sign(
  'HMAC',
  key,
  new TextEncoder().encode('message'),
);
console.log(
  'hmac',
  Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(''),
);`,
    },
    {
      id: 'crypto-aes-gcm',
      title: 'AES-GCM',
      description: 'encrypt / decrypt round-trip',
      code: `const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt'],
);
const iv = crypto.getRandomValues(new Uint8Array(12));
const plain = new TextEncoder().encode('secret payload');
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
console.log('round-trip', new TextDecoder().decode(pt));
console.log('ciphertext bytes', ct.byteLength);`,
    },
    {
      id: 'crypto-pbkdf2',
      title: 'PBKDF2',
      description: 'deriveBits from password',
      code: `const baseKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode('password'),
  'PBKDF2',
  false,
  ['deriveBits'],
);
const salt = crypto.getRandomValues(new Uint8Array(16));
const bits = await crypto.subtle.deriveBits(
  {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations: 100_000,
  },
  baseKey,
  256,
);
console.log(
  'derived',
  Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(''),
);`,
    },
    {
      id: 'crypto-ecdsa',
      title: 'ECDSA P-256',
      description: 'generateKey + sign + verify',
      code: `const pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const data = new TextEncoder().encode('matter-ish payload');
const sig = await crypto.subtle.sign(
  { name: 'ECDSA', hash: 'SHA-256' },
  pair.privateKey,
  data,
);
const ok = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' },
  pair.publicKey,
  sig,
  data,
);
console.log('ecdsa verify', ok, 'sig bytes', sig.byteLength);`,
    },
  ],

  'os-info': [
    {
      id: 'os-info-import',
      title: 'ESM import',
      description: 'Package style (not runnable in playground — the gallery tool calls it directly)',
      runnable: false,
      code: `import { platform, version, arch, family, type, locale, hostname } from '@tauri-apps/plugin-os';

console.log(platform(), version(), arch(), family(), type());
console.log(await locale(), await hostname());`,
    },
  ],

  bluetooth: [
    {
      id: 'bt-planned',
      title: 'Planned shape',
      description: 'Not implemented — docs only',
      runnable: false,
      code: `// FUTURE — host mobile BLE (not Web Bluetooth polyfill)
// const devs = await agapi.bluetooth.scan({ timeoutMs: 5000 });
// const gatt = await agapi.bluetooth.connect(devs[0].id);
// await gatt.write(characteristic, data);

console.log('agapi.bluetooth is not available yet');`,
    },
  ],

  sensors: [
    {
      id: 'sensors-planned',
      title: 'Planned shape',
      description: 'Not implemented — docs only',
      runnable: false,
      code: `// FUTURE — accel/gyro/attitude/heading/location
// const h = agapi.sensors.start('accelerometer', { intervalMs: 100 });
// h.on('data', (sample) => console.log(sample));
// h.stop();

console.log('agapi.sensors is not available yet');`,
    },
  ],

  haptics: [
    {
      id: 'haptics-basic',
      title: 'Impact / notification / selection',
      description: 'Mobile host preferred; falls back to navigator.vibrate',
      code: `await agapi.haptics.impact('medium');
await agapi.haptics.notification('success');
await agapi.haptics.selection();
await agapi.haptics.vibrate(200);`,
    },
  ],

  notifications: [
    {
      id: 'notifications-basic',
      title: 'Permission + show',
      description: 'Works on desktop too, not just mobile',
      code: `let granted = await agapi.notifications.isPermissionGranted();
if (!granted) {
  granted = (await agapi.notifications.requestPermission()) === 'granted';
}
if (granted) {
  agapi.notifications.show({ title: 'agapi', body: 'hello' });
}`,
    },
  ],

  fs: [
    {
      id: 'fs-planned',
      title: 'Planned shape',
      description: 'Not implemented — docs only',
      runnable: false,
      code: `// FUTURE — scoped subset, not full Node fs
// await agapi.fs.writeFile('cache/log.txt', 'hello');
// const text = await agapi.fs.readFile('cache/log.txt', 'utf8');

console.log('agapi.fs is not available yet');`,
    },
  ],

  nfc: [
    {
      id: 'nfc-scan-write',
      title: 'Scan + write',
      description: 'Mobile only (Android/iOS) — no host on desktop',
      code: `if (await agapi.nfc.isAvailable()) {
  const tag = await agapi.nfc.scan({ type: 'ndef' });
  console.log(tag.id, tag.records);

  await agapi.nfc.write([agapi.nfc.uriRecord('https://tauri.app')], {
    kind: { type: 'ndef' },
  });
} else {
  console.log('NFC not available on this device');
}`,
    },
  ],

  biometrics: [
    {
      id: 'biometrics-basic',
      title: 'Check + authenticate',
      description: 'Mobile only (Android/iOS) — no host on desktop',
      code: `const status = await agapi.biometric.checkStatus();
console.log(status.isAvailable, status.biometryType);

if (status.isAvailable) {
  await agapi.biometric.authenticate("Confirm it's you");
}`,
    },
  ],

  webrtc: [
    {
      id: 'webrtc-pc',
      title: 'Browser RTCPeerConnection',
      description: 'Native webview API — creates local offer only',
      code: `if (typeof RTCPeerConnection === 'undefined') {
  console.error('RTCPeerConnection missing');
} else {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  pc.onicecandidate = (e) => {
    if (e.candidate) console.log('ice', e.candidate.candidate);
  };
  const dc = pc.createDataChannel('agapi');
  dc.onopen = () => console.log('datachannel open');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log('local offer type', offer.type);
  console.log(offer.sdp?.split('\\n').slice(0, 8).join('\\n') + '\\n…');
  pc.close();
}`,
    },
  ],

  webcodecs: [
    {
      id: 'webcodecs-probe',
      title: 'Feature detect',
      description: 'Check constructors before use',
      code: `const hasVideoEncoder = typeof VideoEncoder !== 'undefined';
const hasVideoDecoder = typeof VideoDecoder !== 'undefined';
console.log({ hasVideoEncoder, hasVideoDecoder });

if (!hasVideoEncoder) {
  console.warn('WebCodecs VideoEncoder missing in this webview');
} else {
  const support = await VideoEncoder.isConfigSupported({
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  });
  console.log('vp8 supported', support.supported, support.config);
}`,
    },
  ],
};

export function examplesFor(toolId: string): CodeSnippet[] {
  return TOOL_EXAMPLES[toolId as ExampleToolId] ?? [];
}
