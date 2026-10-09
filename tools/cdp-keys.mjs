/**
 * cdp-keys.mjs —— 用真实 CDP 键盘事件驱动页面，复核 .mp-cell 的键盘可达性与 focus-visible。
 * 用法：node tools/cdp-keys.mjs <url>
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'edge-keys-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  let page = null;
  for (let i = 0; i < 80 && !page; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* not up yet */ }
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('DevTools 端点没有就绪');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });

  let id = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    } else if (m.method) events.push(m);
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = id++; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const key = async (k, code, vk) => {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: type === 'keyDown' && k.length === 1 ? k : undefined });
    }
    await sleep(90);
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  await sleep(2800);

  const out = {};
  out.focusStart = await evaluate(`(() => {
    const el = document.querySelector('.mp-input');
    el.scrollIntoView({ block: 'center' });
    el.focus();
    return document.activeElement.className;
  })()`);
  await sleep(350);

  // Real Tab presses: walk forward and record where focus lands + whether focus-visible paints
  out.tabPath = [];
  for (let i = 0; i < 16; i += 1) {
    await key('Tab', 'Tab', 9);
    const step = await evaluate(`(() => {
      const a = document.activeElement;
      const cs = getComputedStyle(a);
      return { tag: a.tagName, cls: String(a.className).slice(0, 34), text: (a.textContent || '').trim().slice(0, 18),
        fv: a.matches(':focus-visible'), outline: cs.outlineStyle === 'none' ? 'none' : cs.outlineWidth + ' ' + cs.outlineColor };
    })()`);
    out.tabPath.push(step);
    if (step.cls.includes('arm')) break;
  }

  // Arrow keys on the focused input: does anything move?
  out.arrowTest = await evaluate(`(async () => {
    const el = document.querySelector('.mp-input');
    el.focus();
    return { value: el.value };
  })()`);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('ArrowDown', 'ArrowDown', 40);
  await key('Enter', 'Enter', 13);
  out.afterArrows = await evaluate(`(() => {
    const el = document.querySelector('.mp-input');
    return { active: document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0,20), value: el.value, actdesc: el.getAttribute('aria-activedescendant') };
  })()`);

  // Now genuinely Tab to a model row (reverse order: from input, rows come after?) — check row count reached
  out.rowFocusVisible = await evaluate(`(async () => {
    const rows = [...document.querySelectorAll('.mp-cell')];
    return { n: rows.length };
  })()`);

  // Live-region check: any aria-live near the picker?
  out.liveRegions = await evaluate(`[...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].map(e => ({ cls: String(e.className).slice(0,30), live: e.getAttribute('aria-live'), text: e.textContent.trim().slice(0,30) }))`);

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch {}
  child.kill();
}
