/**
 * _probe_effort.mjs —— 一次性探针：a6 认不认「思考强度」这个字段。
 *
 * 为什么必须实测：思考强度在 [OI] 协议里没有统一名字（[OI] 用 reasoning_effort，
 * Qwen 用 enable_thinking，智谱用 thinking:{type}，Anthropic 用 budget_tokens）。
 * a6 走的是 [OI] 形状但底下接 DeepSeek，它认不认、认了会不会真的改变思考量，猜不出来。
 *
 * 三次请求，都用 deepseek-v4.1-flash、max_tokens 2000、同一个短题：
 *   1. baseline           —— 不带任何额外字段
 *   2. effort-high        —— reasoning_effort: "high"
 *   3. effort-bogus       —— reasoning_effort: "not-a-real-level"
 * 第 3 次是关键判别：若它 400，说明这个字段被真校验 ⇒ "high" 是被真接受的；
 * 若它 200，说明未知值被静默忽略 ⇒ "high" 也可能只是被吞掉了。
 *
 * 密钥从 config.local.json 现读，只打印长度不打印内容。用完即弃。
 * 跑：node .impeccable/harden/_probe_effort.mjs
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const keys = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8'));
const API_KEY = keys.p_78j76c5s;
if (!API_KEY) throw new Error('config.local.json 里没有 p_78j76c5s');

const BASE = 'https://api.a6api.com';
const MODEL = 'deepseek-v4.1-flash';
const PROMPT = 'What is 17 * 23? Answer with just the number.';

async function probe(label, extra) {
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: PROMPT }],
    temperature: 1,
    max_tokens: 2000,
    stream: true,
    stream_options: { include_usage: true },
    ...extra,
  };

  const out = {
    label,
    sent: Object.keys(extra).length ? extra : '(无额外字段)',
    status: null,
    errorBody: null,
    reasoningChars: 0,
    contentChars: 0,
    contentHead: null,
    finishReason: null,
    usage: null,
    usageRaw: null,
    elapsedMs: null,
  };

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    out.status = 'FETCH-FAILED';
    out.errorBody = String(err?.message ?? err);
    out.elapsedMs = Date.now() - t0;
    return out;
  }

  out.status = res.status;
  if (!res.ok) {
    out.errorBody = (await res.text()).slice(0, 400);
    out.elapsedMs = Date.now() - t0;
    return out;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
  let reasoning = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') continue;
      let j;
      try {
        j = JSON.parse(payload);
      } catch {
        continue;
      }
      if (j.usage) {
        out.usage = { in: j.usage.prompt_tokens, out: j.usage.completion_tokens, total: j.usage.total_tokens };
        out.usageRaw = j.usage;
      }
      const c = j.choices?.[0];
      if (!c) continue;
      if (c.finish_reason) out.finishReason = c.finish_reason;
      const d = c.delta ?? {};
      if (typeof d.content === 'string') content += d.content;
      const r = d.reasoning_content ?? d.reasoning;
      if (typeof r === 'string') reasoning += r;
    }
  }

  out.reasoningChars = reasoning.length;
  out.contentChars = content.length;
  out.contentHead = content.trim().slice(0, 40) || null;
  out.elapsedMs = Date.now() - t0;
  return out;
}

const results = [];
for (const [label, extra] of [
  ['1-baseline', {}],
  ['2-effort-high', { reasoning_effort: 'high' }],
  ['3-effort-bogus', { reasoning_effort: 'not-a-real-level' }],
]) {
  results.push(await probe(label, extra));
}

console.log(JSON.stringify({ model: MODEL, results }, null, 2));
