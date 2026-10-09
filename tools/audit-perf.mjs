/**
 * audit-perf.mjs —— 量真实的加载与渲染代价。
 * 用 Performance 域拿网络瀑布、长任务、绘制统计，不看代码猜。
 * 用法：node tools/audit-perf.mjs <url> [--width=] [--height=] [--mobile] [--label=x]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9337);
const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const W = Number(flags.width ?? 1440);
const H = Number(flags.height ?? 900);
const MOBILE = Boolean(flags.mobile);
const LABEL = String(flags.label ?? 'desktop');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'edge-perf-'));
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
    } catch { /* 等 */ }
    await sleep(250);
  }
  throw new Error('DevTools 端点没有就绪');
}

let nextId = 1;
const pending = new Map();
const waited = [];
const events = [];
let ws;
const send = (method, params = {}) => new Promise((res, reject) => {
  const id = nextId++;
  pending.set(id, { resolve: res, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const once = (method, timeoutMs = 30000) => new Promise((res, reject) => {
  const entry = { method, resolve: res };
  waited.push(entry);
  setTimeout(() => {
    const i = waited.indexOf(entry);
    if (i >= 0) { waited.splice(i, 1); reject(new Error(`等待 ${method} 超时`)); }
  }, timeoutMs);
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200));
  return r.result?.value;
};

async function main() {
  const target = await findTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, reject) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else res(msg.result);
      return;
    }
    if (msg.method) {
      events.push(msg);
      for (let i = waited.length - 1; i >= 0; i -= 1) {
        if (waited[i].method === msg.method) { waited[i].resolve(msg.params); waited.splice(i, 1); }
      }
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Performance.enable');
  await send('Log.enable').catch(() => {});
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE });

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded.catch(() => {});
  await sleep(3000); // 让 React 拉完 /api 并画完

  const out = { label: LABEL, url, viewport: { W, H, mobile: MOBILE } };

  // ---------- 网络 ----------
  const reqs = events.filter((e) => e.method === 'Network.responseReceived').map((e) => e.params);
  const finished = events.filter((e) => e.method === 'Network.loadingFinished').map((e) => e.params);
  const sizeById = new Map(finished.map((f) => [f.requestId, f.encodedDataLength]));
  out.network = {
    requestCount: reqs.length,
    byType: reqs.reduce((a, r) => { a[r.type] = (a[r.type] || 0) + 1; return a; }, {}),
    totalKB: Math.round([...sizeById.values()].reduce((a, b) => a + b, 0) / 1024),
    fontRequests: reqs.filter((r) => r.type === 'Font').map((r) => ({
      url: r.response.url.split('/').pop(), kb: Math.round((sizeById.get(r.requestId) || 0) / 1024),
      status: r.response.status, fromCache: r.response.fromDiskCache || r.response.fromServiceWorker,
    })),
    css: reqs.filter((r) => r.type === 'Stylesheet').map((r) => ({ url: r.response.url.split('/').pop(), kb: Math.round((sizeById.get(r.requestId) || 0) / 1024) })),
    scripts: reqs.filter((r) => r.type === 'Script').map((r) => ({ url: r.response.url.split('/').pop(), kb: Math.round((sizeById.get(r.requestId) || 0) / 1024) })),
    images: reqs.filter((r) => r.type === 'Image' || r.type === 'Other').map((r) => ({ url: r.response.url.split('/').pop().slice(0, 34), kb: Math.round((sizeById.get(r.requestId) || 0) / 1024), type: r.type })),
    failures: events.filter((e) => e.method === 'Network.loadingFailed').map((e) => e.params.errorText).slice(0, 8),
    status4xx5xx: reqs.filter((r) => r.response.status >= 400).map((r) => ({ url: r.response.url.split('/').pop(), status: r.response.status })),
  };

  // ---------- 关键时间点 ----------
  out.timing = await evaluate(`(() => {
    const n = performance.getEntriesByType('navigation')[0];
    if (!n) return null;
    const r = (x) => Math.round(x);
    return {
      ttfb: r(n.responseStart - n.requestStart),
      domInteractive: r(n.domInteractive),
      domContentLoaded: r(n.domContentLoadedEventEnd),
      loadEvent: r(n.loadEventEnd),
      firstPaint: r((performance.getEntriesByName('first-paint')[0]||{}).startTime || -1),
      firstContentfulPaint: r((performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime || -1),
    };
  })()`);

  // ---------- 字体是否在首屏就位 ----------
  out.fonts = await evaluate(`(() => {
    const list = [];
    document.fonts.forEach((f) => list.push({ family: f.family, weight: f.weight, status: f.status }));
    return { count: list.length, list: list.slice(0, 8), allLoaded: document.fonts.status };
  })()`);

  // ---------- 长任务 / 布局抖动 ----------
  out.longTasks = await evaluate(`(() => new Promise((res) => {
    const found = [];
    try {
      const po = new PerformanceObserver((l) => { l.getEntries().forEach((e) => found.push({ dur: Math.round(e.duration), start: Math.round(e.startTime) })); });
      po.observe({ entryTypes: ['longtask'] });
      setTimeout(() => { po.disconnect(); res(found); }, 1200);
    } catch (e) { res('unsupported'); }
  }))()`);

  // ---------- 强制重排一次，量样式与布局代价 ----------
  out.layoutCost = await evaluate(`(() => {
    const t0 = performance.now();
    document.body.offsetHeight;
    const t1 = performance.now();
    return { forcedReflowMs: Math.round((t1 - t0) * 100) / 100 };
  })()`);

  // ---------- 渲染格数 vs 可见性 ----------
  out.rendering = await evaluate(`(() => {
    const imgs = Array.from(document.querySelectorAll('.ch-plate img'));
    const inView = imgs.filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    return {
      totalCells: document.querySelectorAll('.ch').length,
      totalImgs: imgs.length,
      imgsInViewport: inView.length,
      imgsDecoded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      imgsNotYetLoaded: imgs.filter((i) => !i.complete).length,
      domNodes: document.querySelectorAll('*').length,
    };
  })()`);

  // ---------- 重新渲染一次面板，量 React 提交代价 ----------
  out.interactionCost = await evaluate(`(() => new Promise((res) => {
    const t0 = performance.now();
    const btn = document.querySelector('.detents > button');
    if (btn) btn.click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      res({ switchProviderMs: Math.round((performance.now() - t0) * 100) / 100 });
    }));
  }))()`);

  // ---------- Performance.metrics ----------
  const met = await send('Performance.getMetrics').catch(() => null);
  if (met) {
    out.chromeMetrics = Object.fromEntries(met.metrics.filter((m) => [
      'Nodes', 'LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration',
      'ScriptDuration', 'TaskDuration', 'JSHeapUsedSize', 'JSHeapTotalSize', 'Documents',
    ].includes(m.name)).map((m) => [m.name, m.name.includes('Duration') ? Math.round(m.value * 1000) / 1000 : Math.round(m.value)]));
  }

  // ---------- 控制台错误 ----------
  out.consoleErrors = events.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text.slice(0, 120)).slice(0, 6);
  out.exceptions = events.filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => (e.params.exceptionDetails.exception?.description || '').slice(0, 120)).slice(0, 4);

  return out;
}

main()
  .then((r) => {
    writeFileSync(join(process.cwd(), '.impeccable', 'review', `perf-${LABEL}.json`), JSON.stringify(r, null, 2), 'utf8');
    console.log(`wrote .impeccable/review/perf-${LABEL}.json`);
    ws?.close(); child.kill();
  })
  .catch((err) => { console.error('失败:', err.message); child.kill(); process.exit(1); });
