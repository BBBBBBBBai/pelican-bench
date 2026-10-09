/**
 * critA-ax.mjs —— 两件还没钉死的事：
 *  1) 无障碍树里，这个模块到底被暴露成什么？listbox 的名字、option 的数量与选中态、
 *     空态那个裸 div 有没有进树、以及 title="先选定模型名才能开始生成" 有没有作为
 *     description 出现在 arm 上（如果没进树，读屏用户永远听不到原因）。
 *  2) 10 个候选的文本逐个以「码点 + SHA1」形式落地，彻底排除显示层把长名字抹成空串的假象。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT ?? 9333);
const url = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'crita-ax-'));
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

  // 码点落地（写文件，避免显示层改写）
  const cells = await evaluate(`[...document.querySelectorAll('.mp-cell')].map((c) => c.textContent)`);
  const lines = cells.map((t, i) => {
    const cps = [...t].map((ch) => ch.codePointAt(0).toString(16)).join(' ');
    return `${i}\tlen=${t.length}\tsha1=${createHash('sha1').update(t).digest('hex').slice(0, 10)}\tcps=${cps}`;
  });
  writeFileSync('.impeccable/review/critiqueA-cells-codepoints.txt', lines.join('\n') + '\n', 'utf8');
  out.cells = lines;

  // 无障碍树：只看 listbox 附近 + arm
  const ax = await send('Accessibility.getFullAXTree');
  const byId = new Map(ax.nodes.map((n) => [n.nodeId, n]));
  const desc = (n) => {
    const role = n.role?.value;
    const name = n.name?.value ?? '';
    const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]));
    return { role, name, props, ignored: !!n.ignored };
  };
  const interesting = ax.nodes.filter((n) => ['listbox', 'option', 'textbox', 'button'].includes(n.role?.value) && !n.ignored);
  out.axSummary = interesting.map(desc).filter((n) => n.role !== 'button' || /开始生成|生成/.test(n.name) || n.name === '');
  out.axCounts = interesting.reduce((a, n) => { a[n.role] = (a[n.role] ?? 0) + 1; return a; }, {});

  // arm 的 AX 节点：name / description / disabled 属性
  const armNode = interesting.find((n) => n.role === 'button' && n.name.includes('开始'));
  out.armAX = armNode ? { name: armNode.name?.value, description: armNode.description?.value ?? null,
    props: Object.fromEntries((armNode.properties ?? []).map((p) => [p.name, p.value?.value])) } : null;

  // 空态：输入 zzz 后再取一次树，看那个裸 div 与 listbox
  await evaluate(`(() => { const i = document.querySelector('.mp-input'); i.focus(); })()`);
  await send('Input.insertText', { text: 'zzz' });
  await sleep(400);
  const ax2 = await send('Accessibility.getFullAXTree');
  const lb2 = ax2.nodes.filter((n) => n.role?.value === 'listbox' && !n.ignored);
  out.emptyStateAX = {
    listbox: lb2.map((n) => ({ name: n.name?.value, childIds: n.childIds?.length ?? 0,
      props: Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value])) })),
    optionCount: ax2.nodes.filter((n) => n.role?.value === 'option' && !n.ignored).length,
    // 「没有匹配的模型名」这串字有没有出现在任何 AX 节点里
    emptyTextPresent: ax2.nodes.some((n) => (n.name?.value ?? '').includes('没有匹配')),
    emptyTextNodes: ax2.nodes.filter((n) => (n.name?.value ?? '').includes('没有匹配')).map((n) => ({ role: n.role?.value, ignored: !!n.ignored, name: n.name?.value })),
    staticTextSample: ax2.nodes.filter((n) => n.role?.value === 'StaticText' && (n.name?.value ?? '').trim()).slice(0, 6).map((n) => n.name.value),
  };

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  child.kill();
}
