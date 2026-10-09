// 抽屉的 reduced-motion 路径：动画应被压成瞬时，但开合状态必须仍然成立。
const PORT = Number(process.env.CDP_PORT ?? 9349);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const profile = mkdtempSync(join(tmpdir(), 'foldrm-'));
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrlFor() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no target');
}

let id = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    const onMsg = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.id !== mid) return;
      ws.removeEventListener('message', onMsg);
      if (m.error) reject(new Error(`${method}: ${JSON.stringify(m.error)}`));
      else resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

const out = {};
try {
  const ws = new WebSocket(await wsUrlFor());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  await rpc(ws, 'Page.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await rpc(ws, 'Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await rpc(ws, 'Page.navigate', { url });
  await sleep(3400);

  const ev = async (expression) =>
    (await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
      .result.value;

  out.mediaMatches = await ev(`matchMedia('(prefers-reduced-motion: reduce)').matches`);

  // reduced 下：从关到开 30ms 内是否已到终态（瞬时应到）
  out.ramp = await ev(`(async () => {
    const f = document.querySelector('.fold');
    f.open = false;
    await new Promise(r => setTimeout(r, 500));
    const before = { h: Math.round(f.getBoundingClientRect().height), cs: getComputedStyle(f, '::details-content').contentVisibility };
    f.open = true;
    await new Promise(r => setTimeout(r, 30));
    const early = { h: Math.round(f.getBoundingClientRect().height), cs: getComputedStyle(f, '::details-content').contentVisibility };
    await new Promise(r => setTimeout(r, 400));
    const settled = { h: Math.round(f.getBoundingClientRect().height), cs: getComputedStyle(f, '::details-content').contentVisibility,
                      transition: getComputedStyle(f, '::details-content').transitionDuration,
                      anim: getComputedStyle(f.querySelector('.fold-body')).animationDuration };
    return { before, early, settled };
  })()`);

  // 内容可达性：reduced 下打开后输入框能用
  out.inputUsable = await ev(`(async () => {
    const f = document.querySelector('.fold');
    f.open = true;
    await new Promise(r => setTimeout(r, 300));
    const i = f.querySelector('input');
    i.focus();
    return { focused: document.activeElement === i, visible: i.getBoundingClientRect().height > 0 };
  })()`);

  console.log(JSON.stringify(out, null, 1));
} finally {
  try {
    child.kill();
  } catch {}
  await sleep(400);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
