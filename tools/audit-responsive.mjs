/**
 * audit-responsive.mjs —— 一次浏览器会话里过所有断点，量真实回流结果。
 * 检查：横向溢出、被裁切的文字、面板是否按设计重排、格子宽度、
 * 触控目标尺寸、以及断点边界两侧是否真的不同。
 * 用法：node tools/audit-responsive.mjs <url> [--out=file.json]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9338);
const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const OUT = String(flags.out ?? join('.impeccable', 'review', 'responsive.json'));

// 断点两侧都要量：设计断点是 1040 / 900 / 620
const VIEWPORTS = [
  { w: 1440, h: 900, label: '1440 wide desktop' },
  { w: 1041, h: 900, label: '1041 just above bp-1040' },
  { w: 1040, h: 900, label: '1040 at bp-1040' },
  { w: 1039, h: 900, label: '1039 just below bp-1040' },
  { w: 901, h: 900, label: '901 just above bp-900' },
  { w: 900, h: 900, label: '900 at bp-900' },
  { w: 899, h: 900, label: '899 just below bp-900' },
  { w: 621, h: 900, label: '621 just above bp-620' },
  { w: 620, h: 900, label: '620 at bp-620' },
  { w: 619, h: 900, label: '619 just below bp-620' },
  { w: 390, h: 844, label: '390 phone' },
  { w: 320, h: 640, label: '320 minimum' },
];

const MEASURE = `(() => {
  const px = (v) => Math.round(v * 10) / 10;
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { w: px(r.width), h: px(r.height) }; };
  const cs = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };

  // 横向溢出：文档级 + 每一个元素
  const overflowing = [];
  document.querySelectorAll('*').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > innerWidth + 1 || r.left < -1) {
      const st = getComputedStyle(e);
      if (st.position === 'fixed') return;
      overflowing.push({
        cls: (e.className && typeof e.className === 'string' ? e.className : e.tagName).slice(0, 46),
        left: px(r.left), right: px(r.right), w: px(r.width),
        text: (e.textContent || '').trim().slice(0, 34),
      });
    }
  });

  // 被裁切的文字：声明了 hidden/ellipsis 且内容真的超出
  const clipped = [];
  document.querySelectorAll('*').forEach((e) => {
    if (!e.textContent || !e.textContent.trim()) return;
    if (e.children.length > 0) return;
    const st = getComputedStyle(e);
    const hides = st.overflow === 'hidden' || st.textOverflow === 'ellipsis';
    if (!hides) return;
    const dx = e.scrollWidth - e.clientWidth;
    const dy = e.scrollHeight - e.clientHeight;
    if (dx > 2 || dy > 2) clipped.push({
      cls: (typeof e.className === 'string' ? e.className : e.tagName).slice(0, 46),
      dx, dy,
      text: (e.textContent || '').trim().slice(0, 40),
      raw: e.scrollWidth, client: e.clientWidth, ws: st.whiteSpace,
    });
  });

  // 触控目标
  const tiny = [];
  document.querySelectorAll('button, a[href], input, select, textarea, summary').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.width < 24 || r.height < 24) tiny.push({
      cls: (typeof e.className === 'string' ? e.className : e.tagName).slice(0, 40),
      w: px(r.width), h: px(r.height),
      text: (e.textContent || '').trim().slice(0, 24),
    });
  });

  const grid = document.querySelector('.rack-grid');
  const csGrid = grid ? getComputedStyle(grid) : null;
  const chs = Array.from(document.querySelectorAll('.ch')).slice(0, 8).map((c) => px(c.getBoundingClientRect().width));
  const rail = document.querySelector('.rail');
  const bal = document.querySelector('.bay');
  const pan = document.querySelector('.panel');

  return {
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    overflowing: overflowing.slice(0, 12),
    overflowCount: overflowing.length,
    clipped: clipped.slice(0, 12),
    clippedCount: clipped.length,
    tinyCount: tiny.length,
    tiny: tiny.slice(0, 8),
    layout: {
      benchCols: cs('.bench', 'gridTemplateColumns'),
      chMin: csGrid ? csGrid.gridTemplateColumns.split(' ')[0] : null,
      chWidths: chs,
      cellsPerRow: (() => { const c = document.querySelectorAll('.ch'); if (!c.length) return 0; const top = c[0].getBoundingClientRect().top; return Array.from(c).filter((x) => Math.abs(x.getBoundingClientRect().top - top) < 2).length; })(),
      railH: rail ? px(rail.getBoundingClientRect().height) : null,
      railWrap: cs('.rail', 'flexWrap'),
      bayW: bal ? px(bal.getBoundingClientRect().width) : null,
      panelW: pan ? px(pan.getBoundingClientRect().width) : null,
      panelBorderTop: cs('.panel', 'borderTopWidth'),
      nameplateDisplay: cs('.nameplate span', 'display'),
      sheetBodyCols: cs('.sheet-body', 'gridTemplateColumns'),
    },
  };
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'edge-resp-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--window-size=1440,900', 'about:blank',
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
let ws;
const send = (method, params = {}) => new Promise((res, reject) => {
  const id = nextId++;
  pending.set(id, { resolve: res, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
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
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(3200);

  const results = [];
  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w <= 620,
    });
    await sleep(650);
    const m = await evaluate(MEASURE);
    results.push({ ...vp, ...m });
    const tag = m.overflowCount === 0 && m.clippedCount === 0 ? 'OK  ' : 'FLAG';
    console.log(`${tag} ${String(vp.w).padStart(4)}px  cols=${String(m.layout.benchCols).slice(0, 34).padEnd(34)} chMin=${String(m.layout.chMin).padEnd(7)} perRow=${m.layout.cellsPerRow} ofx=${m.docOverflowX} ovf=${m.overflowCount} clip=${m.clippedCount} tiny=${m.tinyCount}`);
    if (m.overflowCount) m.overflowing.slice(0, 4).forEach((o) => console.log(`        overflow: .${o.cls} [${o.left}..${o.right}] "${o.text}"`));
    if (m.clippedCount) m.clipped.slice(0, 4).forEach((c) => console.log(`        clipped:  .${c.cls} dx=${c.dx} dy=${c.dy} ws=${c.ws} "${c.text}"`));
  }
  return { url, viewports: results };
}

main()
  .then((r) => {
    writeFileSync(OUT, JSON.stringify(r, null, 2), 'utf8');
    console.log(`\nwrote ${OUT}`);
    ws?.close(); child.kill();
  })
  .catch((err) => { console.error('失败:', err.message); child.kill(); process.exit(1); });
