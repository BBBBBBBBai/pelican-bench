// 审计用：打开标本页后取真实 AX 名 + 真实焦点位置（不修复任何东西）。
// 跑法：node tools/probe-sheet-ax.mjs [url] [--width=] [--height=]
const PORT = Number(process.env.CDP_PORT ?? 9341);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const argOf = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split('=')[1] : d;
};
const width = Number(argOf('width', 1440));
const height = Number(argOf('height', 900));

const profile = mkdtempSync(join(tmpdir(), 'sheetax-'));
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
  await sleep(3200);

  const { root } = await rpc(ws, 'DOM.getDocument', { depth: -1, pierce: true });

  const ev = async (expression) =>
    (await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
      .result.value;

  // 点开第一个有画面的格子
  out.clicked = await ev(`(() => {
    const btn = [...document.querySelectorAll('.ch')].find(b => b.querySelector('.ch-plate img'));
    if (!btn) return null;
    btn.click();
    return btn.innerText.replace(/\\s+/g, ' ').trim().slice(0, 60);
  })()`);
  await sleep(1600);

  const ax = async (selector) => {
    const { nodeId } = await rpc(ws, 'DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) return null;
    const { nodes } = await rpc(ws, 'Accessibility.getPartialAXTree', {
      nodeId,
      fetchRelatives: false,
    });
    const n = nodes?.[0];
    return n
      ? { role: n.role?.value, name: n.name?.value ?? null, desc: n.description?.value ?? null }
      : null;
  };

  out.dialog = await ax('.sheet');
  out.closeButton = await ax('.sheet-head .btn');
  out.sheetHeadings = await ev(
    `[...document.querySelectorAll('.sheet h1,.sheet h2,.sheet h3,.sheet h4,[role=heading]')].length`,
  );
  out.focusAfterOpen = await ev(
    `(() => { const a = document.activeElement; return a ? a.tagName + '.' + (a.className || '') + ' | inSheet=' + !!a.closest('.sheet') : null; })()`,
  );
  out.bodyInert = await ev(`!!document.querySelector('[inert]')`);
  out.rootAriaHidden = await ev(
    `(() => { const r = document.getElementById('root'); return r ? r.getAttribute('aria-hidden') : null; })()`,
  );
  out.sheetHasTabindex = await ev(
    `(() => { const s = document.querySelector('.sheet'); return s ? s.getAttribute('tabindex') : null; })()`,
  );
  // 真实 Tab 走 3 站，看焦点落在哪
  const walk = [];
  for (let i = 0; i < 3; i += 1) {
    await rpc(ws, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await rpc(ws, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await sleep(120);
    walk.push(
      await ev(
        `(() => { const a = document.activeElement; return { el: a ? a.tagName + '.' + (a.className||'') : null, text: (a?.innerText||'').replace(/\\s+/g,' ').trim().slice(0,40), inSheet: a ? !!a.closest('.sheet') : null }; })()`,
      ),
    );
  }
  out.tabWalk = walk;
  out.liveRegions = await ev(
    `[...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].map(e => e.tagName + '[' + (e.getAttribute('role')||e.getAttribute('aria-live')) + ']')`,
  );
  out.iframeSandbox = await ev(
    `(() => { const f = document.querySelector('.sheet iframe'); return f ? { sandbox: f.getAttribute('sandbox'), src: (f.getAttribute('src')||'').slice(0,50) } : null; })()`,
  );
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
