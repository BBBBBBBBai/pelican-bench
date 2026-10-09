/**
 * critA-switch.mjs —— 键盘专用用户「换了模型名之后想再换一个」到底要按几下？
 * 上一轮验证了 Enter 能选中；这一轮把「选中 → 想换另一个」这条真实回路的按键数实测出来，
 * 并记录每一步之后候选表还剩几行、值是什么。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-switch-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let ws;
const out = { steps: [], keys: 0 };
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

  const snap = (label) => evaluate(`(() => {
    const i = document.querySelector('.mp-input');
    const g = document.querySelector('.mp-grid');
    const a = document.querySelector('.btn.arm.xl.wide');
    return { label: ${JSON.stringify(label)}, value: i.value,
      rows: document.querySelectorAll('.mp-cell').length,
      selected: document.querySelectorAll('.mp-cell[aria-selected="true"]').length,
      gridH: g ? Math.round(g.getBoundingClientRect().height) : null,
      pickH: Math.round(document.querySelector('.model-pick').getBoundingClientRect().height),
      armY: a ? Math.round(a.getBoundingClientRect().top) : null,
      armDisabled: a?.disabled,
      active: document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0,20) };
  })()`);

  const key = async (k, code, vk, text) => {
    out.keys += 1;
    const p = { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk };
    if (text) { p.text = text; p.unmodifiedText = text; }
    await send('Input.dispatchKeyEvent', p);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
    await sleep(90);
  };
  const record = async (label) => { out.steps.push(await snap(label)); };

  // 起点：空输入
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); })()`);
  await sleep(250);
  await record('0-起点(空输入,焦点在输入框)');

  // 鼠标/键盘选中第一个候选：Tab 一次 + Enter
  await key('Tab', 'Tab', 9);
  await record('1-Tab一次(焦点落到第1行)');
  await key('Enter', 'Enter', 13, '\r');
  await record('2-Enter选中');

  // 现在：用户想换成另一个模型名。键盘专用。先试 Escape
  await evaluate(`document.querySelector('.mp-cell')?.focus()`);
  await sleep(120);
  await evaluate(`document.querySelector('.mp-input').focus()`);
  await sleep(120);
  await key('Escape', 'Escape', 27, '\u001b');
  await record('3-按Escape(期望:清空/还原列表)');

  // 试 Tab 出去再回来，看列表会不会恢复
  await key('Tab', 'Tab', 9);
  await record('4-Tab离开输入框');

  // 真实做法：Ctrl+A 全选 + Backspace
  await evaluate(`document.querySelector('.mp-input').focus()`);
  await sleep(120);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await sleep(120);
  out.keys += 2;
  out.afterSelectAll = await evaluate(`(() => { const i = document.querySelector('.mp-input'); return { sel: i.value.substring(i.selectionStart, i.selectionEnd), len: i.value.length }; })()`);
  await key('Backspace', 'Backspace', 8, '\b');
  await record('5-Ctrl+A再Backspace(清空后)');

  // 换一个候选：从输入框用 Tab 走到第 3 行再 Enter
  await key('Tab', 'Tab', 9);
  await key('Tab', 'Tab', 9);
  await key('Tab', 'Tab', 9);
  await record('6-Tab三次到第3行');
  await key('Enter', 'Enter', 13, '\r');
  await record('7-Enter选中第3个模型');

  // 输入框上的方向键在「已选中」状态下是否有任何作用
  await evaluate(`document.querySelector('.mp-input').focus()`);
  await sleep(120);
  await key('ArrowDown', 'ArrowDown', 40);
  await record('8-选中后输入框按ArrowDown');
  await key('ArrowUp', 'ArrowUp', 38);
  await record('9-输入框按ArrowUp');

  out.totalKeys = out.keys;
  // 同屏琥珀文本节点普查（One Light Rule）
  out.amber = await evaluate(`(() => {
    const amber = 'rgb(240, 160, 32)';
    const nodes = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && getComputedStyle(e).color === amber && e.textContent.trim());
    return { count: nodes.length, samples: nodes.slice(0, 12).map((e) => e.className + ' :: ' + e.textContent.trim().slice(0, 26)) };
  })()`);
  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
