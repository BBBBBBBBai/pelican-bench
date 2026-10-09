// 专测抽屉的键盘可达性：Enter / Space / 原生摘要元素行为。
// 跑法：node tools/probe-fold-keys.mjs [url]
const PORT = Number(process.env.CDP_PORT ?? 9345);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const profile = mkdtempSync(join(tmpdir(), 'foldkeys-'));
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
  await rpc(ws, 'DOM.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await rpc(ws, 'Page.navigate', { url });
  await sleep(3400);

  const ev = async (expression) =>
    (await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
      .result.value;

  const state = `(() => {
    const f = document.querySelector('.fold');
    return { open: f.open, h: Math.round(f.getBoundingClientRect().height), active: document.activeElement.tagName + '.' + (document.activeElement.className || '') };
  })()`;

  // 先点开，保证有内容可收起
  await ev(`document.querySelector('.fold').scrollIntoView({block:'center'})`);
  await sleep(300);

  const press = async (type, key, code, vk) => {
    await rpc(ws, 'Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  };

  // 用真实 Tab 走到 summary，确保是键盘真实路径
  await ev(`document.querySelector('.fold > summary').focus()`);
  out.initial = await ev(state);

  // 1) rawKeyDown Enter
  await press('rawKeyDown', 'Enter', 'Enter', 13);
  await press('keyUp', 'Enter', 'Enter', 13);
  await sleep(600);
  out.afterRawEnter = await ev(state);

  // 2) keyDown Enter（上一轮已开则此轮应收）
  await press('keyDown', 'Enter', 'Enter', 13);
  await press('keyUp', 'Enter', 'Enter', 13);
  await sleep(600);
  out.afterKeyDownEnter = await ev(state);

  // 3) Space
  await press('rawKeyDown', ' ', 'Space', 32);
  await press('keyUp', ' ', 'Space', 32);
  await sleep(600);
  out.afterSpace = await ev(state);

  // 4) 真 Tab 走到 summary 再 Space（最接近用户的路径）
  await ev(`document.querySelector('.fold > summary').blur()`);
  let reached = null;
  for (let i = 0; i < 60; i += 1) {
    await press('rawKeyDown', 'Tab', 'Tab', 9);
    await press('keyUp', 'Tab', 'Tab', 9);
    await sleep(40);
    reached = await ev(
      `(() => { const a = document.activeElement; return a.tagName === 'SUMMARY' && a.parentElement.classList.contains('fold') ? 'FOLD_SUMMARY' : a.tagName + '.' + (a.className||'').slice(0,20); })()`,
    );
    if (reached === 'FOLD_SUMMARY') break;
  }
  out.tabReachedSummary = reached;
  out.beforeSpaceViaTab = await ev(state);
  await press('rawKeyDown', ' ', 'Space', 32);
  await press('keyUp', ' ', 'Space', 32);
  await sleep(600);
  out.afterSpaceViaTab = await ev(state);

  // 5) 关闭态下，内容是否对 Tab 与查找不可达（content-visibility: hidden 的作用）
  out.closedContent = await ev(`(() => {
    const f = document.querySelector('.fold');
    if (f.open) f.open = false;
    return new Promise(r => setTimeout(() => {
      const cs = getComputedStyle(f, '::details-content');
      const input = f.querySelector('input');
      r({ contentVisibility: cs.contentVisibility, inputOffsetParent: input ? !!input.offsetParent : null, inputTabIndex: input ? input.tabIndex : null });
    }, 400));
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
