/**
 * critA-tabgate.mjs —— 两件必须钉死的事：
 *  A) 未选模型（arm 处于 disabled）时，Tab 到底会不会落在这个禁用按钮上？
 *     如果不会，那 title="先选定模型名才能开始生成" 对键盘用户就是不可达的
 *     （禁用控件不进 tab 序，键盘也没有 hover，原生 title 也没法用鼠标获取）。
 *  B) 从 .mp-input 出发，Tab 到 .btn.arm 到底几站？中途停在哪些元素上？
 *     并且分「arm 禁用」和「arm 可用」两种起点各测一次。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-tabgate-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let ws;
const out = {};
try {
  let page = null;
  for (let i = 0; i < 80 && !page; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* 还没起来 */ }
    if (!page) await sleep(250);
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = id++; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.text));
    return r.result.value;
  };
  const tab = async () => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await sleep(60);
  };
  const where = () => evaluate(`(() => { const a = document.activeElement;
    return { tag: a.tagName, cls: String(a.className).slice(0,26), id: a.id || null,
      text: (a.textContent || '').trim().slice(0, 14), disabled: !!a.disabled }; })()`);

  await send('Page.enable');
  await send('Runtime.enable');
  const loaded = new Promise((res) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } };
    ws.addEventListener('message', h);
  });
  await send('Page.navigate', { url });
  await loaded;
  await sleep(2800);

  // ───── A) arm 禁用时，从输入框一路 Tab，记录每一站，看 arm 是否出现 ─────
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); })()`);
  await sleep(250);
  const state0 = await evaluate(`(() => { const a = document.querySelector('.btn.arm.xl.wide');
    return { armDisabled: a.disabled, armTitle: a.title, inputValue: document.querySelector('.mp-input').value }; })()`);
  out.startState = state0;

  const path = [];
  for (let n = 0; n < 30; n += 1) {
    await tab();
    const w = await where();
    path.push(w);
    if (w.cls.includes('arm') || n >= 29) break;
  }
  out.tabPathFromInput = path.map((p) => `${p.tag}.${p.cls}${p.disabled ? ' [disabled]' : ''} "${p.text}"`);
  out.tabStopsToArm = path.findIndex((p) => p.cls.includes('arm'));
  out.armReached = out.tabStopsToArm >= 0;

  // ───── B) 选中一个模型后再走一次同样的路 ─────
  await evaluate(`document.querySelector('.mp-input').focus()`);
  await sleep(120);
  await send('Input.insertText', { text: 'gpt-6.1-sol' });
  await sleep(300);
  const state1 = await evaluate(`(() => { const a = document.querySelector('.btn.arm.xl.wide');
    return { armDisabled: a.disabled, armTitle: a.title, rows: document.querySelectorAll('.mp-cell').length }; })()`);
  out.afterPick = state1;
  path.length = 0;
  for (let n = 0; n < 34; n += 1) {
    await tab();
    const w = await where();
    path.push(w);
    if (w.cls.includes('arm') || n >= 33) break;
  }
  out.tabPathEnabled = path.map((p) => `${p.tag}.${p.cls}${p.disabled ? ' [disabled]' : ''} "${p.text}"`);
  out.tabStopsToArmEnabled = path.findIndex((p) => p.cls.includes('arm'));

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
