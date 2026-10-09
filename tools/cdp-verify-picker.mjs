/**
 * cdp-verify-picker.mjs —— 用真实 CDP 键盘/输入事件复核模型选择器修复后的键盘通道。
 * 只发真输入（Input.dispatchKeyEvent / Input.insertText），不发页面内合成事件。
 * 用法：node tools/cdp-verify-picker.mjs <url> [outdir]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9344);
const url = process.argv[2];
const outdir = process.argv[3] ?? '.impeccable/review';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'edge-pick-'));
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
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
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
  const key = async (k, code, vk, mods = 0) => {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods,
        text: type === 'keyDown' && k.length === 1 ? k : undefined,
      });
    }
    await sleep(110);
  };
  const shot = async (clip, file) => {
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 3 } });
    writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  await sleep(2800);
  mkdirSync(outdir, { recursive: true });

  const pickerState = () => evaluate(`(() => {
    const inp = document.querySelector('.mp-input');
    const grid = document.querySelector('.mp-grid');
    const run = document.querySelector('.btn.arm');
    const rows = [...document.querySelectorAll('.mp-cell')];
    const act = document.querySelector('.mp-cell[data-active="true"]');
    const a = document.activeElement;
    const cs = act ? getComputedStyle(act) : null;
    return {
      value: inp.value,
      rows: rows.length,
      selected: rows.filter(r => r.getAttribute('aria-selected') === 'true').length,
      activeIdx: act ? rows.indexOf(act) : -1,
      actDesc: inp.getAttribute('aria-activedescendant'),
      actDescResolves: inp.getAttribute('aria-activedescendant')
        ? !!document.getElementById(inp.getAttribute('aria-activedescendant')) : null,
      gridScrollTop: grid.scrollTop,
      runDisabled: run.disabled,
      gateText: (document.querySelector('.mp-status') || {}).textContent || '',
      clearDisabled: document.querySelector('.mp-clear').disabled,
      focus: a.tagName + (a.className ? '.' + String(a.className).split(' ')[0] : ''),
      focusVisible: a.matches(':focus-visible'),
      actOutline: cs ? cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor + ' off ' + cs.outlineOffset : null,
    };
  })()`);

  const out = {};
  const focusInput = () => evaluate(`(() => {
    const el = document.querySelector('.mp-input');
    el.scrollIntoView({ block: 'center' });
    el.focus();
    return document.activeElement.className;
  })()`);

  out.initial = await pickerState();
  await focusInput();

  // ── 1. 真 Tab：从输入框出发，几步离开候选表？───────────────────────────
  out.tabFromInput = [];
  for (let i = 0; i < 5; i += 1) {
    await key('Tab', 'Tab', 9);
    out.tabFromInput.push(await evaluate(`(() => {
      const a = document.activeElement;
      return { tag: a.tagName, cls: String(a.className).slice(0, 30),
        text: (a.textContent || '').trim().slice(0, 16), fv: a.matches(':focus-visible') };
    })()`));
  }
  out.stepsToEscapePicker = out.tabFromInput.findIndex((s) => !s.cls.includes('mp-')) + 1;

  // ── 2. 真 Shift+Tab：能不能倒回输入框？─────────────────────────────────
  await key('Tab', 'Tab', 9, 8); // Shift
  out.shiftTabBack = await evaluate(`document.activeElement.className`);

  // ── 3. 真方向键：游标动不动？aria-activedescendant 有没有？─────────────
  await focusInput();
  out.arrowDown = [];
  for (let i = 0; i < 3; i += 1) {
    await key('ArrowDown', 'ArrowDown', 40);
    const s = await pickerState();
    out.arrowDown.push({ activeIdx: s.activeIdx, actDesc: s.actDesc, actDescResolves: s.actDescResolves, scrollTop: s.gridScrollTop, outline: s.actOutline });
  }
  await key('ArrowUp', 'ArrowUp', 38);
  out.arrowUp = (await pickerState()).activeIdx;
  await key('End', 'End', 35);
  out.end = (await pickerState()).activeIdx;

  // ── 4. 游标行的焦点环像素完整性 ────────────────────────────────────────
  const rects = await evaluate(`(() => {
    const g = document.querySelector('.mp-grid').getBoundingClientRect();
    const act = document.querySelector('.mp-cell[data-active="true"]').getBoundingClientRect();
    return { grid: { x: g.x, y: g.y, width: g.width, height: g.height },
             act: { x: act.x, y: act.y, width: act.width, height: act.height } };
  })()`);
  out.ringRects = rects;
  out.ringShot = await shot({ x: rects.grid.x - 6, y: rects.grid.y - 6, width: rects.grid.width + 12, height: rects.grid.height + 12 },
    join(outdir, 'fix-active-ring.png'));
  // 环的四角外侧命中测试：环若被裁，四角外的元素应是 grid 本身
  out.ringOutside = await evaluate(`(() => {
    const a = document.querySelector('.mp-cell[data-active="true"]').getBoundingClientRect();
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return e ? String(e.className).slice(0, 24) || e.tagName : null; };
    return { leftOut: at(a.left - 1.5, a.top + a.height / 2), rightOut: at(a.right + 1.5, a.top + a.height / 2),
             topIn: at(a.left + 4, a.top + 1), bottomIn: at(a.left + 4, a.bottom - 1) };
  })()`);

  // ── 5. 真 Enter：提交游标行 ────────────────────────────────────────────
  await key('Enter', 'Enter', 13);
  out.afterEnter = await pickerState();

  // ── 6. 真 Escape：还原已提交值 ─────────────────────────────────────────
  await focusInput();
  await send('Input.insertText', { text: 'dsr' });
  await sleep(160);
  out.typedDsr = await pickerState();
  await key('Escape', 'Escape', 27);
  out.afterEscape = await pickerState();

  // ── 7. 真 Backspace：先擦光查询串，再多按一次应清掉已选值 ──────────────
  await evaluate(`(() => { const el = document.querySelector('.mp-input'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); })()`);
  out.backspaceRun = [];
  for (let i = 0; i < 24; i += 1) {
    await key('Backspace', 'Backspace', 8);
    const s = await pickerState();
    out.backspaceRun.push({ i: i + 1, value: s.value, selected: s.selected, runDisabled: s.runDisabled });
  }

  // ── 8. 已选状态下 .mp-clear 是否进入 tab 序 + 它的焦点环 ────────────────
  out.beforeSelect = await pickerState();
  await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.mp-cell')];
    if (rows[1]) rows[1].click();
    return rows.length;
  })()`);
  await sleep(200);
  await focusInput();
  await key('Tab', 'Tab', 9);
  out.tabAfterSelect = await evaluate(`(() => {
    const a = document.activeElement; const cs = getComputedStyle(a);
    const b = a.getBoundingClientRect();
    return { cls: String(a.className).slice(0, 24), ariaLabel: a.getAttribute('aria-label'),
      fv: a.matches(':focus-visible'), outline: cs.outlineWidth + ' ' + cs.outlineColor + ' off ' + cs.outlineOffset,
      box: { x: b.x, y: b.y, w: b.width, h: b.height } };
  })()`);
  const cb = out.tabAfterSelect.box;
  out.clearShot = await shot({ x: cb.x - 8, y: cb.y - 8, width: cb.w + 16, height: cb.h + 16 }, join(outdir, 'fix-clear-focus.png'));

  // ── 9. 空态：真输入一个不存在的名字 ────────────────────────────────────
  await evaluate(`(() => { const el = document.querySelector('.mp-input'); el.focus(); el.setSelectionRange(0, el.value.length); })()`);
  for (let i = 0; i < 20; i += 1) await key('Backspace', 'Backspace', 8);
  await send('Input.insertText', { text: 'zzz' });
  await sleep(200);
  out.emptyState = await evaluate(`(() => {
    const e = document.querySelector('.mp-empty');
    const g = document.querySelector('.mp-grid');
    const inp = document.querySelector('.mp-input');
    return { present: !!e, text: e ? e.textContent : null, parentCls: e ? String(e.parentElement.className) : null,
      insideListbox: e ? !!e.closest('[role=listbox]') : null,
      gridH: g.getBoundingClientRect().height, gridClientH: g.clientHeight,
      runTop: document.querySelector('.btn.arm').getBoundingClientRect().top,
      runDisabled: document.querySelector('.btn.arm').disabled,
      actDesc: inp.getAttribute('aria-activedescendant') };
  })()`);
  out.emptyShot = await shot({ x: 1100, y: 380, width: 330, height: 240 }, join(outdir, 'fix-empty-state.png'));

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch {}
  child.kill();
}
