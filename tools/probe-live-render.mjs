/**
 * probe-live-render.mjs —— 流式生成时的渲染代价（审计唯一没量过的一维）。
 *
 * 前端子代理报了一条 [P2]：`App.tsx:72` 的 `setEvents((prev) => [...prev, evt])`
 * 无界，且 `App.tsx:29` 的 `reduceEvents` 每次追加都重新遍历并 `s.text += e.text`，
 * 是二次方。但「理论上二次方」不等于「用户能感觉到」。仪器的主用例就是盯着一条
 * 正在跑的通道看它吐字，所以这里真跑一次，量：
 *   - SSE 事件数量与到达节奏
 *   - 整段流期间的长任务（>50ms）
 *   - 帧间隔分布（rAF delta）：最大帧、>32ms 的掉帧数
 *   - React 提交次数（用 PerformanceObserver 数 'measure'/'function' 不可得，
 *     改用 MutationObserver 数 DOM 变更批次数）
 *   - 结束后的 JS 堆与事件数组长度
 *
 * 用法：node tools/probe-live-render.mjs <url> [--provider=<id>] [--out=file.json]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9338);

const argv = process.argv.slice(2);
const url = argv[0] ?? 'http://127.0.0.1:5174/';
const arg = (k, d) => { const a = argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const providerId = arg('provider', null);
const outFile = arg('out', path.join('.impeccable', 'review', 'live-render.json'));

const userDataDir = path.join(process.env.TEMP ?? '.', `edge-cdp-live-${PORT}`);
fs.rmSync(userDataDir, { recursive: true, force: true });

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

async function endp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('Edge 调试端口没起来');
}

const wsUrl = await endp();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const g = (n) => { id += 1; pending.set(id, n); return id; };
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = g(); pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);

await S('Page.enable');
await S('Runtime.enable');
await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// 装上仪表：长任务 + 帧间隔 + DOM 变更计数 + SSE 计数（包一层 fetch 数 data: 帧）
const INSTRUMENT = `(() => {
  window.__live = { longTasks: [], rAF: [], mutations: 0, sseFrames: 0, started: 0, ended: 0, finished: false };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__live.longTasks.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    window.__live.rAF.push(Math.round((now - last) * 10) / 10);
    last = now;
    if (window.__live.rAF.length < 4000 && !window.__live.finished) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new MutationObserver((recs) => { window.__live.mutations += recs.length; }).observe(document.body, { childList: true, subtree: true, characterData: true });
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    const u = String(args[0] && args[0].url ? args[0].url : args[0]);
    if (u.includes('/api/run')) {
      window.__live.started = performance.now();
      p.then((resp) => {
        try {
          const [a, b] = resp.body.tee();
          const rd = b.getReader();
          const dec = new TextDecoder();
          const pump = () => rd.read().then(({ done, value }) => {
            if (done) { window.__live.finished = true; window.__live.ended = performance.now(); return; }
            const t = dec.decode(value, { stream: true });
            window.__live.sseFrames += (t.match(/\\ndata:|^data:/gm) || []).length;
            return pump();
          });
          pump();
          return new Response(a, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
        } catch { return resp; }
      });
    }
    return p;
  };
  return 'armed';
})()`;

await S('Page.navigate', { url });
await sleep(3200);
console.log('instrument:', JSON.stringify((await S('Runtime.evaluate', { expression: INSTRUMENT, returnByValue: true })).result.value));

// 选供应商（若给了 id，就点对应的工位）并按下开始
const CLICK = `(() => {
  ${providerId ? `
  const slots = [...document.querySelectorAll('.slot')];
  const want = ${JSON.stringify(providerId)};
  const s = slots.find((b) => b.textContent.includes(want)) || slots[0];
  ` : `const s = [...document.querySelectorAll('.slot')][0];`}
  if (!s) return 'no-slot';
  s.click();
  return s.textContent.trim().slice(0, 60);
})()`;
console.log('selected:', JSON.stringify((await S('Runtime.evaluate', { expression: CLICK, returnByValue: true })).result.value));
await sleep(600);

// 模型名现在是「本次运行」的必填输入；不填它，开始生成是禁用的。
// 假供应商（mock-provider）按模型名分派行为，所以这里直接给 mock-good。
const SET_MODEL = `(() => {
  const el = document.getElementById('o-model');
  if (!el) return 'no-model-input';
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, 'mock-good');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el.value;
})()`;
console.log('model:', JSON.stringify((await S('Runtime.evaluate', { expression: SET_MODEL, returnByValue: true })).result.value));
await sleep(300);

const ARM = `(() => {
  const b = [...document.querySelectorAll('.btn')].find((x) => /开始生成|START RUN/.test(x.textContent));
  if (!b) return 'no-arm';
  if (b.disabled) return 'arm-disabled';
  b.click();
  return 'armed';
})()`;
console.log('arm:', JSON.stringify((await S('Runtime.evaluate', { expression: ARM, returnByValue: true })).result.value));

// 等流跑完（最多 40s）
for (let i = 0; i < 160; i++) {
  const st = (await S('Runtime.evaluate', { expression: 'JSON.stringify({f:window.__live.finished, n:window.__live.sseFrames, m:window.__live.mutations})', returnByValue: true })).result.value;
  const o = JSON.parse(st);
  if (o.f) break;
  await sleep(250);
}
await sleep(1200);

const RESULT = `(() => {
  const L = window.__live;
  L.finished = true;
  const r = L.rAF.slice();
  const sorted = r.slice().sort((a, b) => a - b);
  const q = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;
  const cells = document.querySelectorAll('.ch').length;
  const live = document.querySelector('.ch.live');
  return JSON.stringify({
    sseFrames: L.sseFrames,
    streamMs: Math.round(L.ended - L.started),
    longTasks: L.longTasks,
    longTaskCount: L.longTasks.length,
    longTaskTotalMs: L.longTasks.reduce((a, b) => a + b, 0),
    frames: r.length,
    frameMed: q(0.5), frameP95: q(0.95), frameMax: sorted.length ? sorted[sorted.length - 1] : null,
    framesOver32: r.filter((d) => d > 32).length,
    framesOver50: r.filter((d) => d > 50).length,
    mutations: L.mutations,
    cells, liveCells: live ? 1 : 0,
    liveText: live ? live.innerText.replace(/\\s+/g, ' ').slice(0, 80) : null,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
  });
})()`;
const raw = (await S('Runtime.evaluate', { expression: RESULT, returnByValue: true })).result.value;
const out = JSON.parse(raw);
out.url = url;
out.provider = providerId;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(out, null, 2));

ws.close();
edge.kill();
