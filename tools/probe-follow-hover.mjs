/**
 * 真鼠标悬停在这颗键上时，它还是「扣下去」的样子吗？
 *
 * `.btn.quiet:hover:not(:disabled)` 与新写的
 * `.btn.quiet[aria-pressed='true']:not(:disabled)` 同分，
 * 所以到底谁赢，不能靠读源码推理 —— CSS 里 `:hover` 骗不过去，
 * 必须在页面里派发真的鼠标移动（Input.dispatchMouseEvent）才会命中。
 *
 *   node tools/probe-follow-hover.mjs [url]
 *
 * 自己起无头 Edge，自己把活通道跑起来（临时档案 → mock-hang），
 * 把指针移到键中心后回读，结束时把临时档案删掉。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9345);
const URL_ = process.argv[2] ?? 'http://127.0.0.1:5174/';
const PROFILE = mkdtempSync(join(tmpdir(), 'edge-hover-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--hide-scrollbars',
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function findTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('DevTools 端点没有就绪');
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve: res, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else res(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: URL_ });
await sleep(3000);

const evalIn = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};

const SETUP = readFileSync(resolve('tools/_follow-hover-setup.js'), 'utf8');
const setup = await evalIn(`(async () => { ${SETUP} })()`);

const SKIN = `(() => {
  const el = document.querySelector('.ch.live .btn[aria-pressed]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    pressed: el.getAttribute('aria-pressed'),
    hovered: el.matches(':hover'),
    background: cs.backgroundColor,
    color: cs.color,
    boxShadow: cs.boxShadow,
    rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })(),
  };
})()`;

const before = await evalIn(SKIN);

// 真的把指针移上去
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.rect.x, y: before.rect.y });
await sleep(400);
const hovered = await evalIn(SKIN);

// 移开，看它是否回到「扣下」的样子
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
await sleep(400);
const away = await evalIn(SKIN);

const CLEANUP = readFileSync(resolve('tools/_follow-hover-cleanup.js'), 'utf8');
const cleanup = await evalIn(`(async () => { ${CLEANUP} })()`);

console.log(
  JSON.stringify(
    {
      setup,
      before,
      hovered,
      away,
      hoverKeepsPressedSkin:
        hovered?.background === before?.background && hovered?.color === before?.color,
      cleanup,
    },
    null,
    2,
  ),
);

ws.close();
child.kill();
