// 真实 CDP 键盘/焦点探针：Tab 陷阱、抽屉内收起内容、关闭后焦点归还。
// 直接跑：node tools/probe-modal-focus.mjs <url>
import { spawn } from 'node:child_process';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'http://127.0.0.1:5174/';
const PORT = 9355;
const WIDTH = 1440;
const HEIGHT = 900;

const profile = `${process.env.TEMP}\\edge-modal-${Date.now()}`;
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

async function json(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

let ws;
let id = 0;
const pending = new Map();
function rpc(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

async function evaluate(expr) {
  const r = await rpc('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

async function tab(shift = false) {
  const base = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
  if (shift) {
    await rpc('Input.dispatchKeyEvent', { ...base, type: 'rawKeyDown', modifiers: 8 });
    await rpc('Input.dispatchKeyEvent', { ...base, type: 'keyUp', modifiers: 8 });
  } else {
    await rpc('Input.dispatchKeyEvent', { ...base, type: 'rawKeyDown' });
    await rpc('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  }
  await sleep(60);
}

const desc = `(() => {
  const a = document.activeElement;
  if (!a) return null;
  const inSheet = !!a.closest('.sheet');
  const inFold = a.closest('.fold');
  return {
    tag: a.tagName,
    cls: (a.className || '').toString().slice(0, 44),
    text: (a.textContent || '').trim().slice(0, 24),
    inSheet,
    inFold: inFold ? (inFold.open ? 'open' : 'closed') : null,
  };
})()`;

const out = {};
try {
  for (let i = 0; i < 40; i++) {
    try {
      const v = await json('/json/version');
      if (v.webSocketDebuggerUrl) break;
    } catch {}
    await sleep(250);
  }
  const targets = await json('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const wsUrl = page.webSocketDebuggerUrl;

  const { WebSocket } = await import('node:worker_threads').then(() => ({ WebSocket: globalThis.WebSocket }));
  ws = new WebSocket(wsUrl);
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
  await rpc('Page.navigate', { url });
  await sleep(3000);

  // 先让第一格真正获得焦点（模拟键盘激活），再回车打开
  out.opener = await evaluate(`(() => {
    const c = document.querySelector('.ch:not(.live)');
    if (!c) return null;
    c.focus();
    return { cls: c.className, focused: document.activeElement === c };
  })()`);
  await evaluate(`document.querySelector('.ch:not(.live)').click()`);
  await sleep(1300);
  out.afterOpen = await evaluate(desc);

  // 收集面板内的可聚焦清单
  out.focusables = await evaluate(`(() => {
    const sheet = document.querySelector('.sheet');
    if (!sheet) return null;
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    return [...sheet.querySelectorAll(sel)]
      .filter(e => e.offsetParent !== null)
      .map(e => ({ tag: e.tagName, cls: (e.className||'').toString().slice(0,30), text: (e.textContent||'').trim().slice(0,20) }));
  })()`);

  // 真实 Tab 走一圈半，看是否逃出面板
  const walk = [];
  for (let i = 0; i < 22; i++) {
    await tab();
    walk.push(await evaluate(desc));
  }
  out.tabWalk = walk;
  out.escaped = walk.filter((s) => s && !s.inSheet).length;
  out.landedInClosedFold = walk.filter((s) => s && s.inFold === 'closed').length;

  // Shift+Tab 反向
  const back = [];
  for (let i = 0; i < 4; i++) {
    await tab(true);
    back.push(await evaluate(desc));
  }
  out.shiftTabWalk = back;

  // 关闭：Escape（真实按键），再看焦点是否回到开窗那一格
  await rpc('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await rpc('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(700);
  out.afterEsc = await evaluate(`(() => {
    const a = document.activeElement;
    const c = document.querySelector('.ch:not(.live)');
    return {
      sheetGone: !document.querySelector('.sheet'),
      plateGone: !document.querySelector('.sheet-plate'),
      scrimGone: !document.querySelector('.sheet-scrim'),
      focusTag: a ? a.tagName : null,
      focusCls: a ? (a.className||'').toString().slice(0,40) : null,
      backOnOpener: a === c,
      bodyChildren: [...document.body.children].map(x => x.className || x.tagName),
    };
  })()`);
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
} finally {
  try { ws?.close(); } catch {}
  child.kill();
  console.log(JSON.stringify(out, null, 2));
}
