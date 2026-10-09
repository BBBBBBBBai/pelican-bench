// 真实滚轮事件验证弹窗打开时背景不再跟随滚动，以及锁定/解锁的滚动条补偿。
// 跑法：node tools/probe-modal-scroll.mjs <url> [--width=] [--height=]
import { spawn } from 'node:child_process';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const args = process.argv.slice(2);
const url = args[0] || 'http://127.0.0.1:5174/';
const num = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? Number(a.split('=')[1]) : d;
};
const WIDTH = num('width', 390);
const HEIGHT = num('height', 844);
const PORT = num('port', 9377);

const profile = `${process.env.TEMP}\\edge-scr-${Date.now()}`;
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let id = 0;
const pending = new Map();
const rpc = (method, params = {}) => {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((res, rej) => pending.set(msgId, { resolve: res, reject: rej }));
};
const ev = async (expr) => {
  const r = await rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
async function wheel(dy) {
  await rpc('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: Math.round(WIDTH / 2),
    y: Math.round(HEIGHT / 2),
    deltaX: 0,
    deltaY: dy,
  });
  await sleep(160);
}

const out = {};
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
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
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
  await rpc('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url });
  await sleep(3000);

  out.viewport = { WIDTH, HEIGHT };
  out.doc = await ev(`({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight })`);
  out.docScrolls = out.doc.sh > out.doc.ch;

  // 关闭状态下，滚轮应该能滚动文档
  await ev('window.scrollTo(0,0)');
  await wheel(500);
  out.beforeOpen = { scrollY: await ev('window.scrollY'), htmlOverflow: await ev(`getComputedStyle(document.documentElement).overflowY`) };

  await ev(`document.querySelector('.ch:not(.live)').click()`);
  await sleep(1300);

  await ev('window.scrollTo(0, 0)');
  await wheel(500);
  out.afterOpen = {
    scrollY: await ev('window.scrollY'),
    htmlOverflow: await ev(`getComputedStyle(document.documentElement).overflowY`),
    htmlPaddingRight: await ev(`document.documentElement.style.paddingRight || ''`),
    rootInert: await ev(`document.getElementById('root').hasAttribute('inert')`),
    scrollbarGap: await ev(`window.innerWidth - document.documentElement.clientWidth`),
    sheetPresent: await ev(`!!document.querySelector('.sheet')`),
  };

  // 关闭后必须完全解锁
  await ev(`document.querySelector('.sheet-head .btn.icon').click()`);
  await sleep(800);
  out.afterClose = {
    htmlOverflow: await ev(`getComputedStyle(document.documentElement).overflowY`),
    htmlPaddingRight: await ev(`document.documentElement.style.paddingRight || ''`),
    rootInert: await ev(`document.getElementById('root').hasAttribute('inert')`),
    sheetPresent: await ev(`!!document.querySelector('.sheet')`),
  };
  await ev('window.scrollTo(0,0)');
  await wheel(500);
  out.scrollsAgainAfterClose = (await ev('window.scrollY')) > 0;
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
} finally {
  try { ws?.close(); } catch {}
  child.kill();
  console.log(JSON.stringify(out, null, 2));
}
