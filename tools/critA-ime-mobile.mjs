/**
 * critA-ime-mobile.mjs —— 两件没测过的事：
 *  1) IME（中文输入法）在 .mp-input 上合成时，候选表会不会被中途的字素撕成空表？
 *     源码注释明确宣称「中文输入法下不误伤」，这是可证伪的断言。
 *  2) 390px 宽下这个模块的真实几何：行高、点大小、模块宽度、门禁按钮位置。
 * 另外顺手记录：选中态被读屏/无头读到的可访问名、以及 .mp-grid 的滚动条是否真的不存在。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-im-'));
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

  // ───────── 1) IME ─────────
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); })()`);
  await sleep(250);
  const rows = () => evaluate(`({ rows: document.querySelectorAll('.mp-cell').length,
     empty: !!document.querySelector('.mp-empty'), value: document.querySelector('.mp-input').value,
     gridH: Math.round(document.querySelector('.mp-grid').getBoundingClientRect().height) })`);

  out.ime = { before: await rows() };
  // 中文输入法：先起合成，逐字更新，再提交
  await send('Input.imeSetComposition', { text: 's', selectionStart: 1, selectionEnd: 1 });
  await sleep(150);
  out.ime.afterComposeS = await rows();
  await send('Input.imeSetComposition', { text: 'sh', selectionStart: 2, selectionEnd: 2 });
  await sleep(150);
  out.ime.afterComposeSh = await rows();
  await send('Input.imeSetComposition', { text: '是', selectionStart: 1, selectionEnd: 1 });
  await sleep(150);
  out.ime.afterComposeCJK = await rows();
  // 提交一个汉字
  await send('Input.insertText', { text: '是' });
  await sleep(250);
  out.ime.afterCommitCJK = await rows();
  // 清干净
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.focus(); i.setSelectionRange(0, i.value.length); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, text: '\b', unmodifiedText: '\b' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await sleep(250);
  out.ime.afterClear = await rows();

  // 汉字查询：全角/中文查询串能命中吗（源码注释的另一半）
  await send('Input.insertText', { text: '深度' });
  await sleep(250);
  out.ime.cjkQuery = await rows();
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.focus(); i.setSelectionRange(0, i.value.length); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, text: '\b', unmodifiedText: '\b' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await sleep(200);

  // ───────── 2) 移动端 390 宽 ─────────
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  out.mobile = await evaluate(`(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect();
      return [+b.x.toFixed(1), +b.y.toFixed(1), +Math.round(b.width), +Math.round(b.height)]; };
    const cells = [...document.querySelectorAll('.mp-cell')].map((c) => Math.round(c.getBoundingClientRect().height));
    const dot = document.querySelector('.mp-dot').getBoundingClientRect();
    const grid = document.querySelector('.mp-grid');
    return { pick: r('.model-pick'), input: r('.mp-input'), grid: r('.mp-grid'),
      arm: r('.btn.arm.xl.wide'),
      rowHeights: [...new Set(cells)], dot: [Math.round(dot.width), Math.round(dot.height)],
      gridScroll: [grid.scrollHeight, grid.clientHeight],
      fullyVisibleRows: Math.floor(grid.clientHeight / 28),
      fontSize: getComputedStyle(document.querySelector('.mp-cell')).fontSize,
      docScrollW: document.documentElement.scrollWidth, winW: innerWidth };
  })()`);
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(300);

  // ───────── 3) 可访问名与滚动条 ─────────
  out.a11y = await evaluate(`(() => {
    const g = document.querySelector('.mp-grid');
    const i = document.querySelector('.mp-input');
    const cs = getComputedStyle(g);
    return { gridRole: g.getAttribute('role'), gridLabel: g.getAttribute('aria-label'),
      inputRole: i.getAttribute('role'), inputControls: i.getAttribute('aria-controls'),
      inputExpanded: i.getAttribute('aria-expanded'),
      scrollbarWidth: cs.scrollbarWidth, scrollbarColor: cs.scrollbarColor,
      overflowY: cs.overflowY,
      liveRegions: document.querySelectorAll('[aria-live],[role=status],[role=alert]').length,
      listboxNameViaLabel: i.labels?.[0]?.textContent ?? null };
  })()`);

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
