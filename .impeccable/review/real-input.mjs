/**
 * real-input.mjs —— 用真正的 CDP 输入事件验键盘与鼠标，而不是页面里 dispatchEvent。
 *
 * 为什么需要：
 *   - element.click() 不会移动焦点，所以「点选后焦点跑到 BODY」可能是探针自己的假象；
 *   - new KeyboardEvent('keydown') 是 untrusted 事件，插件的默认行为不会跑，
 *     用它验 Tab 序会得到假的「键盘无反应」。
 * 只有 Input.dispatchKeyEvent / Input.dispatchMouseEvent 是可信的浏览器输入。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9388);
const URL_ = process.argv[2] ?? 'http://127.0.0.1:8787/';
const profile = mkdtempSync(join(tmpdir(), 'edge-real-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 80 && !target; i += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  } catch { /* not up yet */ }
  if (!target) await sleep(250);
}
if (!target) throw new Error('CDP endpoint never came up');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_ });
await sleep(3000);

const KEY = {
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  Enter: { key: 'Enter', code: 'Enter', vk: 13 },
};
async function press(name, count = 1) {
  const k = KEY[name];
  for (let i = 0; i < count; i += 1) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: k.vk, key: k.key, code: k.code, nativeVirtualKeyCode: k.vk });
    await send('Input.dispatchKeyEvent', { type: 'char', text: '\t', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: k.vk, key: k.key, code: k.code, nativeVirtualKeyCode: k.vk });
    await sleep(70);
  }
}

const describe = `(() => {
  const a = document.activeElement;
  if (!a) return 'null';
  const cls = typeof a.className === 'string' ? a.className : '';
  const name = a.querySelector && a.querySelector('.mp-name') ? a.querySelector('.mp-name').textContent : '';
  const fv = (() => { try { return a.matches(':focus-visible'); } catch { return null; } })();
  const r = a.getBoundingClientRect();
  const st = getComputedStyle(a);
  return JSON.stringify({ tag: a.tagName, id: a.id, cls, name, focusVisible: fv,
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    outline: st.outlineWidth + ' ' + st.outlineStyle + ' ' + st.outlineColor, offset: st.outlineOffset });
})()`;

const out = { steps: [] };

// Focus the model input the honest way: click it.
const box = await evaluate(`(() => { const r = document.getElementById('o-model').getBoundingClientRect(); return JSON.stringify({x: r.left + r.width/2, y: r.top + r.height/2}); })()`);
const { x: ix, y: iy } = JSON.parse(box);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ix, y: iy, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ix, y: iy, button: 'left', clickCount: 1 });
await sleep(250);
out.afterClickInput = JSON.parse(await evaluate(describe));

// Now Tab forward: how many Tab presses to get OUT of the picker?
let stepsToEscape = 0;
const seq = [];
for (let i = 0; i < 20; i += 1) {
  await press('Tab');
  const d = JSON.parse(await evaluate(describe));
  seq.push({ i: i + 1, tag: d.tag, cls: d.cls.slice(0, 34), name: d.name, focusVisible: d.focusVisible, outline: d.outline, offset: d.offset, rect: d.rect });
  if (!d.cls.includes('mp-') && d.id !== 'o-model') { stepsToEscape = i + 1; break; }
}
out.tabSequence = seq;
out.stepsToEscapePicker = stepsToEscape;

// Arrow keys: do they move a highlight inside role=listbox?
const beforeArrow = await evaluate(`document.getElementById('o-model').value`);
await evaluate(`document.getElementById('o-model').focus()`);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ix, y: iy, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ix, y: iy, button: 'left', clickCount: 1 });
await sleep(200);
await press('ArrowDown', 3);
out.afterArrowDown = {
  value: await evaluate(`document.getElementById('o-model').value`),
  activedescendant: await evaluate(`document.getElementById('o-model').getAttribute('aria-activedescendant')`),
  activeElement: JSON.parse(await evaluate(describe)).tag,
  selectedCount: await evaluate(`document.querySelectorAll('.mp-cell[aria-selected="true"]').length`),
  scrollTop: await evaluate(`document.querySelector('.mp-grid').scrollTop`),
};
out.beforeArrowValue = beforeArrow;

// Real mouse click on a candidate row: where does focus land?
const cell = JSON.parse(await evaluate(`(() => { const c = document.querySelectorAll('.mp-cell')[2]; const r = c.getBoundingClientRect(); return JSON.stringify({x: r.left + 60, y: r.top + r.height/2}); })()`));
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cell.x, y: cell.y });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cell.x, y: cell.y, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cell.x, y: cell.y, button: 'left', clickCount: 1 });
await sleep(300);
out.afterRealClickCell = {
  active: JSON.parse(await evaluate(describe)),
  inputValue: await evaluate(`document.getElementById('o-model').value`),
  selected: await evaluate(`document.querySelector('.mp-cell[aria-selected="true"] .mp-name')?.textContent ?? null`),
  runDisabled: await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开始生成'))?.disabled ?? null`),
};

// Escape: a combobox convention. Does anything happen?
await press('Escape');
out.afterEscape = { value: await evaluate(`document.getElementById('o-model').value`) };

console.log(JSON.stringify(out, null, 1));
ws.close();
process.exit(0);
