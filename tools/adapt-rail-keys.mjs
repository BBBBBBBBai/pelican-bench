/* 摘要行那颗「筛选」键必须能用键盘开合（它是新的可点控件，只能靠键盘验真）。
   走 CDP 的真按键，不是合成事件。 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9341);
const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const W = 390;
const H = 844;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'edge-railkeys-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

async function findTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('DevTools 端点没有就绪');
}

let nextId = 1;
const pending = new Map();
async function main() {
  const target = await findTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, reject) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const evaluate = async (expr) =>
    (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  const key = async (k, code, vk) => {
    /* Enter 的默认动作发生在 keyDown 上，而 CDP 只有在带上 `text` 时才把它
       当成「真的敲了一下回车」——不带 `text` 的 keyDown 不会触发按钮。 */
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
      text: k === 'Enter' ? '\r' : undefined,
      unmodifiedText: k === 'Enter' ? '\r' : undefined,
    });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {});
  await send('Page.navigate', { url });
  await sleep(3000);

  const state = () =>
    evaluate(`(() => {
      const t = document.querySelector('.rail-toggle');
      const r = document.querySelector('.rail');
      const cs = getComputedStyle(t);
      return {
        expanded: t.getAttribute('aria-expanded'),
        controls: t.getAttribute('aria-controls'),
        controlsExists: Boolean(document.getElementById(t.getAttribute('aria-controls'))),
        railH: Math.round(r.getBoundingClientRect().height),
        active: document.activeElement ? document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0,24) : null,
        focusVisible: t.matches(':focus-visible'),
        outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
      };
    })()`);

  const out = { initial: await state() };

  // 用键盘走到那颗键：直接 focus 会打开 :focus-visible，但要点名「能 Tab 到」，
  // 所以从这里开始连按 Tab 直到 activeElement 是 .rail-toggle（最多 60 次）。
  await evaluate(`document.body.focus()`);
  let tabs = 0;
  for (; tabs < 60; tabs += 1) {
    await key('Tab', 'Tab', 9);
    const cls = await evaluate(`document.activeElement ? String(document.activeElement.className) : ''`);
    if (String(cls).includes('rail-toggle')) break;
  }
  out.tabsToToggle = tabs + 1;
  out.reached = await evaluate(`String(document.activeElement.className).includes('rail-toggle')`);
  out.focused = await state();

  await key('Enter', 'Enter', 13);
  await sleep(500);
  out.afterEnter = await state();

  await key(' ', 'Space', 32);
  await sleep(500);
  out.afterSpace = await state();

  // 展开时按 Escape 应该收回吗？这是「按键词表」的问题：它不是一个弹窗，
  // 所以按设计不该响应 Escape。这里只记录事实。
  await key('Enter', 'Enter', 13);
  await sleep(500);
  await key('Escape', 'Escape', 27);
  await sleep(400);
  out.afterEscape = await state();

  console.log(JSON.stringify(out, null, 1));
  ws.close();
  child.kill();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
