/**
 * critA-ax2.mjs —— 修正上一版探针里 `n.role === 'button'` 的比较错误（AX 树里 role 是对象，不是字符串），
 * 精确回答两件事：
 *  A) 禁用的 arm 按钮在无障碍树里有没有 description（即 title 有没有变成可朗读的解释）？
 *  B) 空态下 .mp-grid 这个 listbox 的子节点是什么（0 个 option？那个裸 div 进了树吗）？
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-ax2-'));
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let ws;
const out = {};
try {
  let page = null;
  for (let i = 0; i < 80 && !page; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* 还没起来 */ }
    if (!page) await sleep(250);
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = id++; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.text));
    return r.result.value;
  };
  const roleOf = (n) => n.role?.value;
  const pick = (nodes, role, nameRe) => nodes.filter((n) => roleOf(n) === role && nameRe.test(n.name?.value ?? ''));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Accessibility.enable');
  const loaded = new Promise((res) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); } };
    ws.addEventListener('message', h);
  });
  await send('Page.navigate', { url });
  await loaded;
  await sleep(2800);

  const dump = (nodes) => nodes.map((n) => ({
    role: roleOf(n), name: n.name?.value ?? null, description: n.description?.value ?? null,
    props: Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value])),
  }));

  const ax1 = await send('Accessibility.getFullAXTree');
  out.armDisabled = dump(pick(ax1.nodes, 'button', /开始生成/));
  out.listboxInitial = dump(pick(ax1.nodes, 'listbox', /模型名/));
  out.modelOptionsInitial = ax1.nodes.filter((n) => roleOf(n) === 'option' && /^(gpt|claude|deepseek|gemini|qwen|glm|kimi)/.test(n.name?.value ?? '')).length;

  // 选中一个模型，再看 arm 的 description 与 listbox
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.scrollIntoView({block:'center'}); i.focus(); })()`);
  await sleep(200);
  await send('Input.insertText', { text: 'glm-4.6' });
  await sleep(400);
  const ax2 = await send('Accessibility.getFullAXTree');
  out.armEnabled = dump(pick(ax2.nodes, 'button', /开始生成/));
  out.listboxAfterPick = dump(pick(ax2.nodes, 'listbox', /模型名/));

  // 空态
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.focus(); i.setSelectionRange(0, i.value.length); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, text: '\b', unmodifiedText: '\b' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await sleep(200);
  await send('Input.insertText', { text: 'zzz' });
  await sleep(400);
  const ax3 = await send('Accessibility.getFullAXTree');
  const lb = pick(ax3.nodes, 'listbox', /模型名/);
  const lbNode = lb[0];
  const childIds = lbNode?.childIds ?? [];
  out.emptyListbox = {
    listbox: dump(lb),
    children: childIds.map((cid) => {
      const n = ax3.nodes.find((x) => x.nodeId === cid);
      return n ? { role: roleOf(n), name: n.name?.value ?? null, ignored: !!n.ignored } : { missing: cid };
    }),
    modelOptionsInEmpty: ax3.nodes.filter((n) => roleOf(n) === 'option' && /^(gpt|claude|deepseek|gemini|qwen|glm|kimi)/.test(n.name?.value ?? '')).length,
    armInEmpty: dump(pick(ax3.nodes, 'button', /开始生成/)),
  };

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
