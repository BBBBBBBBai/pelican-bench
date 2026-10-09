// 关闭状态下，抽屉里的输入框是否仍可被 Tab/脚本聚焦（content-visibility 的关键副作用）。
// 跑法：node tools/probe-fold-focus.mjs [url]
const PORT = Number(process.env.CDP_PORT ?? 9347);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const profile = mkdtempSync(join(tmpdir(), 'foldfocus-'));
const child = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,900',
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
  await rpc(ws, 'Runtime.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await rpc(ws, 'Page.navigate', { url });
  await sleep(3400);

  const ev = async (expression) =>
    (await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
      .result.value;

  // 关闭态：脚本 focus 能否落到内部输入框
  out.closedProgrammaticFocus = await ev(`(() => {
    const f = document.querySelector('.fold');
    f.open = false;
    return new Promise(r => setTimeout(() => {
      const input = f.querySelector('input');
      input.focus();
      r({ reached: document.activeElement === input, active: document.activeElement.id || document.activeElement.tagName,
          contentCS: getComputedStyle(f, '::details-content').contentVisibility,
          bodyH: Math.round(f.querySelector('.fold-body').getBoundingClientRect().height) });
    }, 400));
  })()`);

  // 关闭态：从 summary 按 Tab，下一站是不是内部输入框
  out.closedTabFromSummary = await ev(`(() => {
    const f = document.querySelector('.fold');
    f.open = false;
    return new Promise(r => setTimeout(() => {
      f.querySelector('summary').focus();
      r({ contentCS: getComputedStyle(f, '::details-content').contentVisibility });
    }, 300));
  })()`);
  await rpc(ws, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await rpc(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(200);
  out.closedTabNextStop = await ev(
    `(() => { const a = document.activeElement; return { id: a.id || null, tag: a.tagName, cls: (a.className||'').slice(0,24), insideFold: !!a.closest('.fold') }; })()`,
  );

  // 打开态：从 summary 按 Tab，应进入内部输入框
  await ev(`document.querySelector('.fold').open = true`);
  await sleep(500);
  await ev(`document.querySelector('.fold > summary').focus()`);
  await rpc(ws, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await rpc(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(200);
  out.openTabNextStop = await ev(
    `(() => { const a = document.activeElement; return { id: a.id || null, tag: a.tagName, insideFold: !!a.closest('.fold') }; })()`,
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
