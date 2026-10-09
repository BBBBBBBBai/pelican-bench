/**
 * _probe_offline.mjs —— 一次性探针：验证「后端连不上 / 后端答错」两种启动失败时界面给出的东西。
 *
 * 为什么不能复用 tools/edge-cdp.mjs：它没有拦请求的开关。用 Network.emulateNetworkConditions
 * 的 offline 会把文档本身也挡掉，页面根本不会渲染；要造的是「静态资源照常加载、
 * 只有 /api/* 失败」这个真实场景（后端挂了、代理挂了），所以用 Network.setBlockedURLs。
 * 而「进程在、但它答了个错」要用 Fetch.fulfillRequest 直接编一个 500 出来。
 *
 * 验四件事：
 *   1. /api/* 连不上时，首屏给的是「连不上本地服务」那句 + 重试按钮，且不重复印浏览器原文；
 *   2. 解除拦截后按重试能真的恢复（不是只能手动刷新整页）；
 *   3. 已加载页面上配置写失败时，语言回退且出声，不是静默跳回去；
 *   4. /api/config 返回 500 时，说的是「启动时没能读完配置和记录」+ 原文，不是「连不上」。
 *
 * 用完即弃，不进仓库。跑：node .impeccable/harden/_probe_offline.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9344;
const URL = process.argv[2] ?? 'http://127.0.0.1:8787/';

const profile = mkdtempSync(join(tmpdir(), 'edge-offline-'));
const child = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--window-size=1440,1200',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('DevTools 端点没有就绪');
}

let nextId = 1;
function makeSession(ws) {
  const pending = new Map();
  const handlers = new Map();
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
      const h = handlers.get(msg.method);
      if (h) h(msg.params);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: res, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const on = (method, fn) => handlers.set(method, fn);
  return { send, on };
}

const evalJs = async (send, expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`页面里抛错：${JSON.stringify(r.exceptionDetails.text ?? r.exceptionDetails)}`);
  return r.result?.value;
};

// 首屏失败那一屏长什么样。note 是 .silk-note，detail 是 --fault 色的那行原文。
const READ_BOOT_SCREEN = `(() => {
  const empty = document.querySelector('.empty');
  const note = empty ? empty.querySelector('.silk-note') : null;
  const read = empty ? empty.querySelector('.read') : null;
  const btn = empty ? empty.querySelector('button') : null;
  return {
    emptyPresent: !!empty,
    note: note ? note.textContent.trim() : null,
    detail: read ? read.textContent.trim() : null,
    retryLabel: btn ? btn.textContent.trim() : null,
    armPresent: !!document.querySelector('.arm'),
    panelPresent: !!document.querySelector('.panel'),
  };
})()`;

const report = { steps: [], errors: [] };

try {
  const target = await findTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const { send, on } = makeSession(ws);
  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');

  // ---- 第 1 步：只挡 /api/*，静态资源照常 ----
  await send('Network.setBlockedURLs', { urls: ['*/api/*'] });
  await send('Page.navigate', { url: URL });
  await sleep(3500);
  report.steps.push({ step: '1-network-failure', ui: await evalJs(send, READ_BOOT_SCREEN) });

  // ---- 第 2 步：解除拦截，按重试 ----
  await send('Network.setBlockedURLs', { urls: [] });
  await evalJs(send, `document.querySelector('.empty button')?.click(), true`);
  await sleep(2500);
  report.steps.push({
    step: '2-after-retry',
    ui: await evalJs(
      send,
      `(() => ({
        emptyStillPresent: !!document.querySelector('.empty'),
        panelPresent: !!document.querySelector('.panel'),
        armLabel: document.querySelector('.arm')?.textContent.trim() ?? null,
        fieldsPresent: document.querySelectorAll('.field').length,
        mpCells: document.querySelectorAll('.mp-cell').length,
      }))()`,
    ),
  });

  // ---- 第 3 步：已加载页面上，配置写失败 ----
  await send('Network.setBlockedURLs', { urls: ['*/api/config'] });
  await evalJs(send, `document.querySelector('.sw button:nth-child(2)')?.click(), true`);
  await sleep(1500);
  report.steps.push({
    step: '3-lang-save-fails',
    ui: await evalJs(
      send,
      `(() => {
        const toast = document.querySelector('.toast');
        const swBtns = [...document.querySelectorAll('.sw button')];
        return {
          toastText: toast ? toast.textContent.trim() : null,
          docLang: document.documentElement.lang,
          swCount: swBtns.length,
          swLabels: swBtns.map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')),
          emptyPresent: !!document.querySelector('.empty'),
          bodyHead: document.body.textContent.trim().slice(0, 120),
        };
      })()`,
    ),
  });
  await send('Network.setBlockedURLs', { urls: [] });

  // ---- 第 4 步：进程在，但 /api/config 答 500 ----
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/config', requestStage: 'Request' }] });
  on('Fetch.requestPaused', (p) => {
    void send('Fetch.fulfillRequest', {
      requestId: p.requestId,
      responseCode: 500,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify({ error: 'INTERNAL-PROBE-500' })).toString('base64'),
    }).catch(() => undefined);
  });
  await send('Page.navigate', { url: URL });
  await sleep(3000);
  report.steps.push({ step: '4-http-500', ui: await evalJs(send, READ_BOOT_SCREEN) });
  await send('Fetch.disable');

  ws.close();
} catch (err) {
  report.errors.push(String(err && err.message ? err.message : err));
} finally {
  try {
    child.kill();
  } catch {
    /* 已经退了 */
  }
}

console.log(JSON.stringify(report, null, 2));
