/**
 * 端到端实跑：用用户真实报障的那个组合（a6 / deepseek-v4.1-flash）跑一次，
 * 确认 ① 请求带上 reasoning_effort ② 新记录里落盘 effort ③ 卡片参数行印出 EFFORT=…
 *
 * 跑法：node .impeccable/harden/_probe_run.mjs
 */
const BASE = 'http://127.0.0.1:8787';
const BODY = { providerId: 'p_78j76c5s', model: 'deepseek-v4.1-flash' };

const res = await fetch(`${BASE}/api/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(BODY),
});

if (!res.ok) {
  console.log(`POST /api/run -> ${res.status} ${await res.text()}`);
  process.exit(1);
}

const t0 = Date.now();
let sawStart = null;
let terminal = null;
let deltas = 0;
let reasoningChars = 0;
let buf = '';

for await (const chunk of res.body) {
  buf += Buffer.from(chunk).toString('utf8');
  const parts = buf.split('\n\n');
  buf = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    let evt;
    try {
      evt = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    if (evt.type === 'start') sawStart = evt;
    if (evt.type === 'delta') deltas++;
    if (evt.type === 'reasoning') reasoningChars += (evt.text ?? '').length;
    if (evt.type === 'done' || evt.type === 'error') terminal = evt;
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`耗时 ${secs}s`);
console.log(`start 事件里的 params：${JSON.stringify(sawStart?.params)}`);
console.log(`正文 delta 片数 ${deltas}，思考字符 ${reasoningChars}`);
console.log(`终态：${terminal?.type} ${terminal?.type === 'error' ? terminal.message : ''}`);
if (terminal?.type === 'done') {
  console.log(`  记录 id ${terminal.record?.id ?? terminal.id ?? '(未带 id)'}`);
}

// 拿最新那条记录核对落盘
const list = await (await fetch(`${BASE}/api/records`)).json();
const rec = list.records[0];
console.log('\n最新记录：');
console.log(`  id            ${rec.id}`);
console.log(`  model         ${rec.requestedModel}`);
console.log(`  params        ${JSON.stringify(rec.params)}`);
console.log(`  usage         ${JSON.stringify(rec.usage)}`);
console.log(`  finishReason  ${rec.finishReason}`);
console.log(`  usedOverrides ${rec.usedOverrides}`);
console.log(`  flags         ${rec.flags.map((f) => f.code).join(',') || '(无)'}`);
console.log(`  svg 长度      ${(rec.svgLength ?? rec.svg?.length ?? '?')}`);
console.log(`\n记录总数：${list.records.length}`);
