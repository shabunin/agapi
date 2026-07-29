/**
 * Fake SimpleDevice for local demos:
 *
 *   npx tsx packages/driver-template/dev/mock-server.ts [port=2300]
 *
 * Then:
 *   npx tsx packages/driver-template/dev/control.ts 127.0.0.1 2300 power ?
 *   # or gallery → Drivers → SimpleDevice → 127.0.0.1:2300
 */
import { createServer } from 'node:net';

const port = Number(process.argv[2] ?? 2300);
let power: 'on' | 'off' = 'off';

const server = createServer((socket) => {
  let buf = '';
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[mock] connect ${peer}`);

  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    for (;;) {
      const i = buf.indexOf('\n');
      if (i < 0) break;
      const line = buf.slice(0, i).replace(/\r$/, '').trim().toLowerCase();
      buf = buf.slice(i + 1);
      console.log(`[mock] ← ${JSON.stringify(line)}`);

      let reply: string;
      if (line === 'power on') {
        power = 'on';
        reply = 'OK';
      } else if (line === 'power off') {
        power = 'off';
        reply = 'OK';
      } else if (line === 'power ?' || line === 'power?') {
        reply = `power ${power}`;
      } else if (line === '' || line === 'help') {
        reply = 'commands: power on | power off | power ?';
      } else {
        reply = 'ERR unknown';
      }
      console.log(`[mock] → ${reply}`);
      socket.write(`${reply}\r\n`);
    }
  });

  socket.on('close', () => console.log(`[mock] close ${peer}`));
  socket.on('error', (e) => console.log(`[mock] err ${peer}`, e.message));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[mock] SimpleDevice on 0.0.0.0:${port}  (state=${power})`);
  console.log(
    `[mock] try: npx tsx packages/driver-template/dev/control.ts 127.0.0.1 ${port} power ?`,
  );
});
