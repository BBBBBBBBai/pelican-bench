// 在 prefers-reduced-motion: reduce 下执行一个 --do 风格的脚本体。
// 用法：node tools/probe-reduced.mjs <url> <script.js> [--width=] [--height=]
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const args = process.argv.slice(2);
const url = args[0] || 'http://127.0.0.1:5174/';
const scriptPath = args[1];
const num = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : dflt;
};
const WIDTH = num('width', 1440);
const HEIGHT = num('height', 900);
const PORT = num('port', 9366);

const body = readFileSync(scriptPath, 'utf8');
const profile = `${process.env.TEMP}\\edge-red-${Date.now()}`;
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let id = 0;
const pending = new Map();
function rpc(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await res.json();
      if (targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl) break;
    } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await rpc('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await rpc('Page.navigate', { url });
  await sleep(2800);

  const res = await rpc('Runtime.evaluate', {
    expression: `(async () => { ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  console.log(JSON.stringify(res.result.value, null, 2));
} catch (err) {
  console.log(JSON.stringify({ error: String(err && err.stack ? err.stack : err) }, null, 2));
} finally {
  try { ws?.close(); } catch {}
  child.kill();
}
