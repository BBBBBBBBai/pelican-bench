/**
 * seed-demo.mjs —— 往本机服务里灌一批演示数据。
 *
 * 用途：不花一分钱看到界面装满的样子。它假定 tools/mock-provider.mjs 正在
 * 127.0.0.1:9911 上跑（npm run mock），然后建几家「供应商」并把各自的模型名
 * 跑一遍，让机架上同时出现正常图、无底深描图、截断、偷换模型、画不出来
 * 这几种情况——这些正是这个工具要摆在一起的样本。
 *
 * 模型名不属于供应商：下面 PROFILES 里的 model 只在**跑的时候**用，
 * 建供应商的那次请求不带它。造出来的假供应商只是八个不同的地址槽位。
 *
 * 用法：先 npm run mock，再 npm run dev，然后 node tools/seed-demo.mjs
 * 环境变量：PORT（后端端口，默认 8787）、BASE（假供应商地址）、RACKS（造几组）
 */
const PORT = Number(process.env.PORT ?? 8787);
const BASE = process.env.BASE ?? 'http://127.0.0.1:9911';
const API = `http://127.0.0.1:${PORT}/api`;

const PROFILES = [
  { name: '原厂直连', protocol: 'openai', model: 'mock-good' },
  { name: '北方中转', protocol: 'openai', model: 'mock-paper' },
  { name: '南方中转', protocol: 'openai', model: 'mock-inkonly' },
  { name: '聚合站 · 便宜档', protocol: 'openai', model: 'mock-vivid' },
  { name: '聚合站 · 极速档', protocol: 'openai', model: 'mock-truncated' },
  { name: '某二手额度站', protocol: 'openai', model: 'mock-mismatch' },
  { name: '文字模型冒充', protocol: 'openai', model: 'mock-bad' },
  { name: '官方格式 · 长思考', protocol: 'anthropic', model: 'mock-thinking' },
];

const ANIMALS = ['鹈鹕', '水豚', '穿山甲', '鸭嘴兽', '树懒', '袋鼠', '犀牛', '长颈鹿', '企鹅', '考拉', '羊驼', '河马'];

async function json(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** 跑一次并把 SSE 读完；不关心内容，只关心服务端落没落盘 */
async function run(providerId, model, promptId) {
  const res = await fetch(`${API}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ providerId, model, promptId }),
  });
  if (!res.ok || !res.body) throw new Error(`/run → HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let outcome = '?';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const evt = JSON.parse(line.slice(5));
        if (evt.type === 'done') outcome = evt.record.ok ? 'ok' : `flagged(${evt.record.flags.map((f) => f.code).join('+')})`;
        if (evt.type === 'error') outcome = `error(${evt.message})`;
      } catch {
        /* 半行，忽略 */
      }
    }
  }
  return outcome;
}

const existing = await json('/providers');
const byName = new Map(existing.map((p) => [p.name, p]));

const created = [];
for (const spec of PROFILES) {
  let p = byName.get(spec.name);
  if (!p) {
    p = await json('/providers', {
      method: 'POST',
      body: JSON.stringify({
        name: spec.name,
        protocol: spec.protocol,
        baseUrl: BASE,
        params: { temperature: 1, maxTokens: 4096 },
        apiKey: 'sk-mock-not-a-real-key',
      }),
    });
    console.log(`+ 供应商 ${spec.name} (${p.id})`);
  }
  created.push({ provider: p, model: spec.model });
}

console.log(`\n开始跑 ${created.length} 家供应商 × 3 只动物……`);
let i = 0;
for (const { provider, model } of created) {
  for (let k = 0; k < 3; k += 1) {
    const animal = ANIMALS[i % ANIMALS.length];
    i += 1;
    const outcome = await run(provider.id, model, `animal:${animal}`);
    console.log(`  ${provider.name.padEnd(16, ' ')} ${model.padEnd(14, ' ')} ${animal.padEnd(4, ' ')} → ${outcome}`);
  }
}

const { records, stats } = await json('/records');
console.log(`\n机架里现在有 ${stats.total} 条记录，通道号：`);
console.log(
  '  ' +
    records
      .slice()
      .reverse()
      .map((r) => r.channel ?? '—')
      .join(' '),
);
