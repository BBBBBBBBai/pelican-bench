/**
 * audit-interact.mjs —— 用真实输入事件审页面。
 *
 * 为什么需要它：`Runtime.evaluate` 里 dispatchEvent 造出来的合成事件不会让浏览器
 * 打开 :focus-visible，也不是真的触摸。要判断「键盘看得见焦点吗」「触屏上滑得动吗」
 * 「prefers-reduced-motion 打开后还剩什么反馈」，只能用 Input / Emulation 域。
 *
 * 用法：node tools/audit-interact.mjs <url> [--width=] [--height=] [--mobile]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9336);
const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const W = Number(flags.width ?? 1440);
const H = Number(flags.height ?? 900);
const MOBILE = Boolean(flags.mobile);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'edge-audit-'));
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
const waited = [];
let ws;
function session() {
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else res(msg.result);
      return;
    }
    if (msg.method) {
      for (let i = waited.length - 1; i >= 0; i -= 1) {
        if (waited[i].method === msg.method) { waited[i].resolve(msg.params); waited.splice(i, 1); }
      }
    }
  });
}
const send = (method, params = {}) => new Promise((res, reject) => {
  const id = nextId++;
  pending.set(id, { resolve: res, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const once = (method, timeoutMs = 20000) => new Promise((res, reject) => {
  const entry = { method, resolve: res };
  waited.push(entry);
  setTimeout(() => {
    const i = waited.indexOf(entry);
    if (i >= 0) { waited.splice(i, 1); reject(new Error(`等待 ${method} 超时`)); }
  }, timeoutMs);
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
};
async function key(k, code, keyCode, modifiers = 0) {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers });
  }
}

const results = {};

async function main() {
  const target = await findTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, reject) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  session();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE });
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded.catch(() => {});
  await sleep(2800);

  // ================= 1. 真实 Tab 走位：焦点看得见吗 =================
  await evaluate(`document.body.focus(); if (document.activeElement.blur) document.activeElement.blur(); true`);
  const walk = [];
  for (let i = 0; i < 30; i += 1) {
    await key('Tab', 'Tab', 9);
    await sleep(55);
    const info = await evaluate(`(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return { end: true };
      const cs = getComputedStyle(e);
      return {
        i: ${i},
        cls: (e.className.toString() || e.tagName).slice(0, 34),
        txt: (e.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 26),
        focusVisible: e.matches(':focus-visible'),
        focus: e.matches(':focus'),
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        outlineOffset: cs.outlineOffset,
        boxShadow: cs.boxShadow.slice(0, 60),
        bg: cs.backgroundColor,
        borderColor: cs.borderColor,
      };
    })()`);
    if (info.end) break;
    walk.push(info);
  }
  results.tabWalk = walk;
  results.tabWalkSummary = {
    stops: walk.length,
    focusVisibleCount: walk.filter((w) => w.focusVisible).length,
    withOutline: walk.filter((w) => w.outlineStyle !== 'none' && parseFloat(w.outlineWidth) > 0).length,
    withoutAnyIndicator: walk.filter((w) => (w.outlineStyle === 'none' || parseFloat(w.outlineWidth) === 0) && w.boxShadow === 'none').map((w) => w.cls + '|' + w.txt),
  };
  // 焦点在机架里走到第几个才离开？面板从第几个开始？
  results.tabOrder = walk.map((w) => w.cls + (w.txt ? ':' + w.txt : ''));

  // ================= 2. 真实 Escape 关标本页 + 焦点去哪 =================
  await evaluate(`(() => { const c = document.querySelector('.ch'); if (c) c.click(); return !!c; })()`);
  await sleep(1500);
  const sheetOpen = await evaluate(`(() => {
    const s = document.querySelector('.sheet');
    if (!s) return null;
    return { role: s.getAttribute('role'), label: s.getAttribute('aria-label'),
      active: document.activeElement.tagName + '.' + document.activeElement.className.toString().slice(0, 30),
      focusInSheet: s.contains(document.activeElement) };
  })()`);
  results.sheetAfterClick = sheetOpen;

  // 真实 Tab：焦点会不会跑到遮罩后面的页面上
  const escapes = [];
  for (let i = 0; i < 12; i += 1) {
    await key('Tab', 'Tab', 9);
    await sleep(60);
    const r = await evaluate(`(() => {
      const e = document.activeElement;
      const s = document.querySelector('.sheet');
      return { cls: (e.className.toString() || e.tagName).slice(0, 30), txt: (e.innerText || '').trim().replace(/\\s+/g,' ').slice(0, 22),
        insideSheet: s ? s.contains(e) : null, fv: e.matches(':focus-visible') };
    })()`);
    escapes.push(r);
  }
  results.sheetTab = escapes;
  results.sheetFocusEscape = escapes.filter((e) => e.insideSheet === false).length;

  await key('Escape', 'Escape', 27);
  await sleep(600);
  results.afterEscape = await evaluate(`(() => ({
    sheetGone: !document.querySelector('.sheet'),
    active: document.activeElement.tagName + '.' + document.activeElement.className.toString().slice(0, 30),
    focusVisible: document.activeElement.matches(':focus-visible'),
  }))()`);

  // ================= 3. 真实触摸：滚动条表面滑得动吗 =================
  const touchProbe = async (sel, label) => {
    const box = await evaluate(`(() => { const e = document.querySelector('${sel}'); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + Math.min(r.height/2, 300)), scrollTop: e.scrollTop, canScroll: e.scrollHeight > e.clientHeight + 2 }; })()`);
    if (!box || !box.canScroll) return { label, skipped: !box ? 'not found' : 'nothing to scroll' };
    const before = await evaluate(`document.querySelector('${sel}').scrollTop`);
    const docBefore = await evaluate(`document.scrollingElement.scrollTop`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y, id: 1 }] });
    for (let i = 1; i <= 6; i += 1) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.y - i * 30, id: 1 }] });
      await sleep(35);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(400);
    const after = await evaluate(`document.querySelector('${sel}').scrollTop`);
    const docAfter = await evaluate(`document.scrollingElement.scrollTop`);
    return { label, sel, before, after, moved: after - before, pageMoved: docAfter - docBefore, canScroll: true };
  };
  results.touchScroll = [
    await touchProbe('.rack-scroll', 'rack (main gallery)'),
    await touchProbe('.panel-scroll', 'control panel'),
  ];

  // 工具轨（flex-wrap 的控件条）在触摸下有没有被压成横向滚动
  results.railUnderTouch = await evaluate(`(() => {
    const r = document.querySelector('.rail');
    if (!r) return null;
    const cs = getComputedStyle(r);
    return { wrap: cs.flexWrap, scrollW: r.scrollWidth, clientW: r.clientWidth,
      overflowX: cs.overflowX, overflows: r.scrollWidth > r.clientWidth + 2,
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);

  // ================= 4. prefers-reduced-motion 打开后还剩什么 =================
  // 先记录动画态，再切到 reduce，再对比
  const animState = () => evaluate(`(() => {
    const out = [];
    document.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      if (cs.animationName && cs.animationName !== 'none') {
        out.push({ cls: (e.className.toString()||e.tagName).slice(0,30), name: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount });
      }
    });
    return out;
  })()`);
  const transitionState = () => evaluate(`(() => {
    const out = [];
    document.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      if (cs.transitionDuration && cs.transitionDuration !== '0s') {
        out.push({ cls: (e.className.toString()||e.tagName).slice(0,30), dur: cs.transitionDuration, prop: cs.transitionProperty.slice(0,40) });
      }
    });
    return out.slice(0, 12);
  })()`);
  results.motion = { normalAnimations: await animState(), normalTransitions: await transitionState() };
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(400);
  results.motion.reducedAnimations = await animState();
  results.motion.reducedTransitions = await transitionState();
  // 打开标本页看 sheet-in 在 reduce 下还剩什么
  await evaluate(`(() => { const c = document.querySelector('.ch'); if (c) c.click(); return true; })()`);
  await sleep(60);
  results.motion.sheetAnimWhileReduced = await evaluate(`(() => {
    const s = document.querySelector('.sheet');
    if (!s) return null;
    const cs = getComputedStyle(s);
    return { animationName: cs.animationName, duration: cs.animationDuration, opacity: cs.opacity, filter: cs.filter, clipPath: cs.clipPath.slice(0,40) };
  })()`);
  await sleep(900);
  results.motion.sheetAfterReduced = await evaluate(`(() => { const s = document.querySelector('.sheet');
    if (!s) return null; const cs = getComputedStyle(s);
    return { opacity: cs.opacity, filter: cs.filter, clipPath: cs.clipPath.slice(0,40), visible: s.getBoundingClientRect().height > 100 }; })()`);
  await send('Emulation.setEmulatedMedia', { features: [] });

  // ================= 5. 真实缩放：Ctrl+加号（文字缩放）与页面缩放 =================
  await send('Emulation.setEmulatedMedia', { features: [] });
  await evaluate(`document.querySelector('.sheet') && document.querySelector('.sheet-head .btn.icon') && document.querySelector('.sheet-head .btn.icon').click(); true`);
  await sleep(400);
  results.zoom = {};
  for (const scale of [1.5, 2, 3]) {
    await send('Emulation.setPageScaleFactor', { pageScaleFactor: scale }).catch(() => {});
    await sleep(250);
    results.zoom['pageScale' + scale] = await evaluate(`(() => ({
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visualW: window.visualViewport ? Math.round(window.visualViewport.width) : null,
      layoutW: document.documentElement.clientWidth,
      pinned: document.querySelector('.rail') ? getComputedStyle(document.querySelector('.rail')).position : null,
    }))()`);
  }
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }).catch(() => {});

  // 真正的「文字缩放」：浏览器设置里的默认字号。px 字号不响应它。
  results.defaultFontSize = await evaluate(`(() => ({
    htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    bodyFontSize: getComputedStyle(document.body).fontSize,
    pxSizedElements: Array.from(document.querySelectorAll('*')).filter((e) => getComputedStyle(e).fontSize.endsWith('px')).length,
    totalElements: document.querySelectorAll('*').length,
  }))()`);

  return results;
}

main()
  .then((r) => writeFileSync(join(process.cwd(), '.impeccable', 'review', 'audit-interact.json'), JSON.stringify(r, null, 2), 'utf8'))
  .then(() => { console.log('wrote .impeccable/review/audit-interact.json'); ws?.close(); child.kill(); })
  .catch((err) => { console.error('失败:', err.message); child.kill(); process.exit(1); });
