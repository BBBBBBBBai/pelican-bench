// 审计用：核实「格子的无障碍名是六个事实连读、title 被忽略」这条结论。
// 用 CDP 的 Accessibility.getPartialAXTree 取浏览器真正算出的 accessible name。
// 跑法：node tools/probe-accname.mjs [url] [--width=] [--height=]
const PORT = Number(process.env.CDP_PORT ?? 9339);
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

const profile = mkdtempSync(join(tmpdir(), 'accname-'));
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
  { stdio: 'ignore', detached: false },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no devtools target');
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
  const wsUrl = await targets();
  const ws = new WebSocket(wsUrl);
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
  await sleep(3200);

  const { root } = await rpc(ws, 'DOM.getDocument', { depth: -1, pierce: true });

  async function axFor(selector, nth = 0) {
    const { nodeId } = await rpc(ws, 'DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) return null;
    const { nodes } = await rpc(ws, 'Accessibility.getPartialAXTree', {
      nodeId,
      fetchRelatives: false,
    });
    const n = nodes?.[0];
    return n
      ? {
          role: n.role?.value,
          name: n.name?.value,
          description: n.description?.value,
          ignored: n.ignored,
          properties: Object.fromEntries(
            (n.properties ?? []).map((p) => [p.name, p.value?.value ?? p.value?.type]),
          ),
        }
      : null;
  }

  out.cell = await axFor('.ch');
  out.cellTitle = (
    await rpc(ws, 'Runtime.evaluate', {
      expression: `document.querySelector('.ch')?.getAttribute('title')`,
      returnByValue: true,
    })
  ).result.value;

  out.closeBtn = await axFor('.sheet-close');
  out.switchGroups = [];
  const { nodeIds } = await rpc(ws, 'DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '.sw',
  });
  for (const nid of nodeIds ?? []) {
    const { nodes } = await rpc(ws, 'Accessibility.getPartialAXTree', { nodeId: nid, fetchRelatives: false });
    const n = nodes?.[0];
    out.switchGroups.push({ role: n?.role?.value, name: n?.name?.value ?? null });
  }

  out.checkboxes = [];
  const cb = await rpc(ws, 'DOM.querySelectorAll', { nodeId: root.nodeId, selector: '.check input' });
  for (const nid of cb.nodeIds ?? []) {
    const { nodes } = await rpc(ws, 'Accessibility.getPartialAXTree', { nodeId: nid, fetchRelatives: false });
    const n = nodes?.[0];
    out.checkboxes.push({ role: n?.role?.value, name: n?.name?.value ?? null });
  }

  out.toast = await axFor('.toast');
  out.detectives = await rpc(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const sw = [...document.querySelectorAll('.sw')];
      return sw.map(s => ({ label: s.getAttribute('aria-label'), role: s.getAttribute('role'), btns: s.querySelectorAll('button').length }));
    })()`,
    returnByValue: true,
  }).then((r) => r.result.value);

  out.liveRegionAttrs = await rpc(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const sel = '[aria-live],[role=status],[role=alert],[role=log]';
      return [...document.querySelectorAll(sel)].map(e => e.outerHTML.slice(0, 90));
    })()`,
    returnByValue: true,
  }).then((r) => r.result.value);

  out.docTitle = await rpc(ws, 'Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true,
  }).then((r) => r.result.value);

  console.log(JSON.stringify(out, null, 1));
} finally {
  try {
    child.kill();
  } catch {}
  await sleep(400);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
