// 量抽屉的开合行为：真实点击、真实动画曲线、几何与可访问状态。
// 跑法：node tools/probe-fold.mjs [url] [--width=] [--height=] [--out=file.json]
const PORT = Number(process.env.CDP_PORT ?? 9343);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const argOf = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const width = Number(argOf('width', 1440));
const height = Number(argOf('height', 900));
const outFile = argOf('out', null);

const profile = mkdtempSync(join(tmpdir(), 'fold-'));
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrlFor() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no target');
}

let id = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    const onMsg = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.id !== mid) return;
      ws.removeEventListener('message', onMsg);
      if (m.error) reject(new Error(`${method}: ${JSON.stringify(m.error)}`));
      else resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

const out = {};
try {
  const ws = new WebSocket(await wsUrlFor());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  await rpc(ws, 'Page.enable');
  await rpc(ws, 'DOM.enable');
  await rpc(ws, 'Accessibility.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await rpc(ws, 'Page.navigate', { url });
  await sleep(3400);

  const ev = async (expression) =>
    (await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
      .result.value;

  // 抽屉在右栏「本次运行」区里，可能要先滚进视口
  out.foldFound = await ev(`(() => {
    const f = document.querySelector('.fold');
    if (!f) return null;
    f.scrollIntoView({ block: 'center' });
    return { tag: f.tagName, open: f.open, hasDetailsContent: CSS.supports('selector(::details-content)'), interpolate: getComputedStyle(document.documentElement).interpolateSize };
  })()`);
  await sleep(400);

  const geom = `(() => {
    const f = document.querySelector('.fold');
    const s = f.querySelector('summary');
    const b = f.querySelector('.fold-body');
    const r = f.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return {
      foldOpen: f.open,
      foldH: Math.round(r.height * 10) / 10,
      bodyH: Math.round(br.height * 10) / 10,
      bodyTop: Math.round(br.top * 10) / 10,
      bodyVisible: br.height > 1 && br.bottom <= window.innerHeight + 1,
      summaryExpanded: s.getAttribute('aria-expanded'),
      contentCS: getComputedStyle(f, '::details-content').contentVisibility,
      chevron: getComputedStyle(s, '::before').transform,
    };
  })()`;

  out.beforeClick = await ev(geom);

  // 真实点击 summary
  const summaryBox = await ev(`(() => {
    const r = document.querySelector('.fold > summary').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await rpc(ws, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: summaryBox.x,
    y: summaryBox.y,
    button: 'left',
    clickCount: 1,
  });
  await rpc(ws, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: summaryBox.x,
    y: summaryBox.y,
    button: 'left',
    clickCount: 1,
  });

  // 采样动画中途
  const samples = [];
  for (let i = 0; i < 14; i += 1) {
    await sleep(30);
    samples.push(await ev(geom));
  }
  out.openSamples = samples;

  await sleep(500);
  out.afterOpen = await ev(geom);

  // 再点一次收起
  await rpc(ws, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: summaryBox.x,
    y: summaryBox.y,
    button: 'left',
    clickCount: 1,
  });
  await rpc(ws, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: summaryBox.x,
    y: summaryBox.y,
    button: 'left',
    clickCount: 1,
  });
  const closeSamples = [];
  for (let i = 0; i < 10; i += 1) {
    await sleep(30);
    closeSamples.push(await ev(geom));
  }
  out.closeSamples = closeSamples;
  await sleep(500);
  out.afterClose = await ev(geom);

  // 键盘：聚焦 summary 后 Enter / Space
  await rpc(ws, 'Runtime.evaluate', {
    expression: `document.querySelector('.fold > summary').focus()`,
  });
  await rpc(ws, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await rpc(ws, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await sleep(600);
  out.afterEnter = await ev(geom);
  out.summaryFocusVisible = await ev(
    `(() => { const s = document.querySelector('.fold > summary'); s.focus(); return { outline: getComputedStyle(s).outlineWidth + ' ' + getComputedStyle(s).outlineColor, tag: document.activeElement.tagName }; })()`,
  );

  // 无 JS 高度测量：确认跑的是 CSS 过渡而非垫片
  out.detailsContentSupported = await ev(`CSS.supports('selector(::details-content)')`);
  out.interpolateSupported = await ev(`CSS.supports('interpolate-size', 'allow-keywords')`);
  out.animationOnBody = await ev(
    `(() => { const b = document.querySelector('.fold-body'); return b ? { name: getComputedStyle(b).animationName, dur: getComputedStyle(b).animationDuration } : null; })()`,
  );

  console.log(JSON.stringify(out, null, 1));
  if (outFile) writeFileSync(outFile, JSON.stringify(out, null, 1), 'utf8');
} finally {
  try {
    child.kill();
  } catch {}
  await sleep(400);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
