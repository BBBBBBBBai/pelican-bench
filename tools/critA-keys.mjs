/**
 * critA-keys.mjs —— 用真实 CDP 键盘事件（而非 JS .focus()）验键盘可达性，
 * 因为 :focus-visible 只在真实键盘模态下命中，程序化 focus 会给出假阴性。
 * 用法：node tools/critA-keys.mjs <url>
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-keys-'));
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
  if (!page) throw new Error('DevTools 端点没有就绪');
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
  const press = async (key, code, vk) => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
    await sleep(120);
  };
  const typeText = async (text) => { await send('Input.insertText', { text }); await sleep(200); };

  await send('Page.enable');
  await send('Runtime.enable');
  const loaded = new Promise((res) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } };
    ws.addEventListener('message', h);
  });
  await send('Page.navigate', { url });
  await loaded;
  await sleep(2800);

  out.focusStart = await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); return { cls: i.className }; })()`);
  await sleep(400);

  // Tab order: where does Tab go from the input?
  out.tabStops = [];
  for (let i = 0; i < 14; i += 1) {
    await press('Tab', 'Tab', 9);
    const s = await evaluate(`(() => {
      const a = document.activeElement;
      const cs = getComputedStyle(a);
      return { tag: a.tagName, cls: String(a.className).slice(0, 30), text: (a.textContent || '').trim().slice(0, 16),
        focusVisible: a.matches(':focus-visible'), outline: cs.outlineStyle === 'none' ? 'none' : (cs.outlineWidth + ' ' + cs.outlineColor) };
    })()`);
    out.tabStops.push(s);
    if (s.cls.includes('arm')) break;
  }
  out.tabStopsToArm = out.tabStops.length;

  // hit Enter on a focused model row: does it select?
  out.rowEnter = await evaluate(`(async () => {
    const rows = [...document.querySelectorAll('.mp-cell')];
    const r = rows[3];
    r.focus();
    return { focused: document.activeElement.textContent.trim().slice(0,20), beforeValue: document.querySelector('.mp-input').value };
  })()`);
  await press('Enter', 'Enter', 13);
  out.afterRowEnter = await evaluate(`(() => ({ value: document.querySelector('.mp-input').value, selRows: document.querySelectorAll('.mp-cell[aria-selected="true"]').length }))()`);

  // Arrow keys while the input is focused (the standard combobox contract)
  await evaluate(`document.querySelector('.mp-input').focus()`);
  await press('ArrowDown', 'ArrowDown', 40);
  await press('ArrowDown', 'ArrowDown', 40);
  await press('Enter', 'Enter', 13);
  out.afterArrows = await evaluate(`(() => {
    const i = document.querySelector('.mp-input');
    return { active: document.activeElement.tagName + '.' + document.activeElement.className, value: i.value,
      ariaActivedescendant: i.getAttribute('aria-activedescendant'), ariaExpanded: i.getAttribute('aria-expanded') };
  })()`);

  // Escape: does it clear / close?
  await typeText('zzz');
  out.afterTypeZzz = await evaluate(`(() => ({ value: document.querySelector('.mp-input').value, rows: document.querySelectorAll('.mp-cell').length, empty: !!document.querySelector('.mp-empty') }))()`);
  await press('Escape', 'Escape', 27);
  out.afterEscape = await evaluate(`(() => ({ value: document.querySelector('.mp-input').value, rows: document.querySelectorAll('.mp-cell').length }))()`);

  // sequence: Tab into the row list then Enter to switch model without touching the mouse
  out.fullKeyboardPick = await evaluate(`(async () => {
    const i = document.querySelector('.mp-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    return { rows: document.querySelectorAll('.mp-cell').length };
  })()`);

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
