/**
 * critA-final2.mjs —— 收尾取证：
 *  1) 模块里有没有任何「清除」控件（button/a/role=button 在 .model-pick 内除候选行之外的东西）
 *  2) 输入框与下方提示句、与 listbox 之间有没有 aria-describedby / aria-controls 连接
 *  3) 选中一行造成的纵向位移：.model-pick / .mp-grid / .btn.arm / 提示句 的 y 坐标前后各是多少
 *  4) .mp-grid 滚动条实际配色与对比度
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-f2-'));
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

  const geom = () => evaluate(`(() => {
    const y = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top) : null; };
    const h = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
    const note = [...document.querySelectorAll('.field .note')].find((n) => /先定一个模型名/.test(n.textContent));
    return { pickTop: y('.model-pick'), pickH: h('.model-pick'), inputTop: y('.mp-input'),
      gridTop: y('.mp-grid'), gridH: h('.mp-grid'), armTop: y('.btn.arm.xl.wide'),
      noteTop: note ? Math.round(note.getBoundingClientRect().top) : null,
      gridScroll: (() => { const g = document.querySelector('.mp-grid'); return [g.scrollHeight, g.clientHeight, g.scrollTop]; })() };
  })()`);

  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); })()`);
  await sleep(250);
  out.initial = await geom();

  // 1) 清除控件普查
  out.controlsInsideModelPick = await evaluate(`(() => {
    const p = document.querySelector('.model-pick');
    return [...p.querySelectorAll('button,a,input,[role=button]')].map((e) =>
      e.tagName + (e.className ? '.' + String(e.className) : '') + ' :: ' + (e.textContent || e.placeholder || '').slice(0, 12));
  })()`);

  // 2) ARIA 连接
  out.ariaWiring = await evaluate(`(() => {
    const i = document.querySelector('.mp-input');
    const g = document.querySelector('.mp-grid');
    const note = [...document.querySelectorAll('.field .note')].find((n) => /先定一个模型名/.test(n.textContent));
    return { inputRole: i.getAttribute('role'), inputControls: i.getAttribute('aria-controls'),
      inputDescribedBy: i.getAttribute('aria-describedby'), inputExpanded: i.getAttribute('aria-expanded'),
      inputActiveDesc: i.getAttribute('aria-activedescendant'), inputAutocomplete: i.getAttribute('aria-autocomplete'),
      inputHasPopup: i.getAttribute('aria-haspopup'), inputAutocompleteAttr: i.getAttribute('autocomplete'),
      inputSpellcheck: i.getAttribute('spellcheck'), inputInputmode: i.getAttribute('inputmode'),
      noteId: note?.id || null, gridId: g.id || null,
      labelFor: document.querySelector('label[for="o-model"]')?.textContent ?? null,
      placeholder: i.placeholder };
  })()`);

  // 3) 选中一行的位移
  await evaluate(`(() => { const c = [...document.querySelectorAll('.mp-cell')].find((x) => x.textContent.includes('deepseek')); c.click(); })()`);
  await sleep(400);
  out.afterPick = await geom();
  out.shift = Object.fromEntries(['pickTop', 'gridTop', 'gridH', 'armTop', 'noteTop']
    .map((k) => [k, out.afterPick[k] - out.initial[k]]));

  // 4) 滚动条配色
  out.scrollbar = await evaluate(`(() => { const cs = getComputedStyle(document.querySelector('.mp-grid'));
    return { width: cs.scrollbarWidth, color: cs.scrollbarColor, overflowY: cs.overflowY,
      rowsHiddenBelow: Math.max(0, document.querySelector('.mp-grid').scrollHeight - document.querySelector('.mp-grid').clientHeight) }; })()`);

  // 5) 提示句与 label 的色值（用于对比度核对）
  out.colors = await evaluate(`(() => {
    const note = [...document.querySelectorAll('.field .note')].find((n) => /先定一个模型名/.test(n.textContent));
    const cs = getComputedStyle(note);
    const panel = note.closest('.panel') || note.parentElement;
    return { noteColor: cs.color, noteSize: cs.fontSize, noteBgChain: getComputedStyle(panel).backgroundColor,
      inputColor: getComputedStyle(document.querySelector('.mp-input')).color,
      inputBg: getComputedStyle(document.querySelector('.mp-input')).backgroundColor };
  })()`);

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
