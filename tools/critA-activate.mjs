/**
 * critA-activate.mjs —— 焦点落在 .mp-cell 上之后，Enter / Space 到底能不能选中？
 * 上一轮用 rawKeyDown 得到「不能」，须排除协议参数问题（按钮的 Enter 激活在 keydown，Space 在 keyup）。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-act-'));
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

  await send('Page.enable');
  await send('Runtime.enable');
  const loaded = new Promise((res) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } };
    ws.addEventListener('message', h);
  });
  await send('Page.navigate', { url });
  await loaded;
  await sleep(2800);

  const state = () => evaluate(`(() => {
    const i = document.querySelector('.mp-input');
    return { value: i.value, selRows: document.querySelectorAll('.mp-cell[aria-selected="true"]').length,
      rows: document.querySelectorAll('.mp-cell').length,
      armDisabled: document.querySelector('.btn.arm.xl.wide')?.disabled,
      active: document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0,24) };
  })()`);

  out.initial = await state();

  // focus the 2nd row with a REAL Tab (keyboard modality so :focus-visible is on)
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); })()`);
  await sleep(300);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(150);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(200);
  out.focusedRow = await evaluate(`(() => { const a = document.activeElement; return { cls: a.className, textLen: a.textContent.length, focused: a.matches(':focus-visible') }; })()`);

  // Enter, full keyDown with text (native button activation)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(350);
  out.afterEnterKeyDown = await state();

  // Space (activation on keyup for buttons)
  if (!out.afterEnterKeyDown.value) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await sleep(350);
    out.afterSpace = await state();
  }

  // and the honest end-to-end: keyboard-only switch to a different model after one is already chosen
  out.keyboardReselect = await evaluate(`(async () => {
    // simulate: user has a model picked, wants another one, keyboard only
    const steps = [];
    const i = document.querySelector('.mp-input');
    steps.push('start: ' + JSON.stringify({ value: i.value, rows: document.querySelectorAll('.mp-cell').length }));
    // 1) select-all + delete
    i.focus();
    i.setSelectionRange(0, i.value.length);
    return steps;
  })()`);

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
