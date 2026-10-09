/**
 * _probe_effort5.mjs —— 校验用户给出的六档是否被 a6 全部接受，并量各档的思考量。
 *
 * 用户给的档位表（按 ChatGPT 那套）：minimal / low / medium / high / xhigh / max，默认 high。
 * 上一轮已验 minimal/low/medium/high 都是 200，none 也是 200（不在表里，所以不用）。
 * 这一轮补 xhigh / max，并且每个档跑两次 —— 短题上思考长度噪声大（上一轮 baseline 86、
 * high 0 字符），单次结果不可信，要看两次是否同向。
 *
 * 用完即弃。跑：node .impeccable/harden/_probe_effort5.mjs
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const API_KEY = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8')).p_78j76c5s;
if (!API_KEY) throw new Error('config.local.json 里没有 p_78j76c5s');

const BASE = 'https://api.a6api.com';
const MODEL = 'deepseek-v4.1-flash';
const PROMPT = 'Say OK.';
const LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

async function probe(value) {
  const out = { sent: value, status: null, errorCode: null, content: null, reasoningChars: null, outTokens: null };

  let res;
  try {
    res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: PROMPT }],
        temperature: 1,
        max_tokens: 2048,
        stream: true,
        stream_options: { include_usage: true },
        reasoning_effort: value,
      }),
    });
  } catch (err) {
    out.status = 'FETCH-FAILED';
    out.errorCode = String(err?.message ?? err);
    return out;
  }

  out.status = res.status;
  if (!res.ok) {
    const t = await res.text();
    try {
      const j = JSON.parse(t);
      out.errorCode = `${j.error?.code ?? '?'} / ${j.error?.reason_code ?? '?'}`;
    } catch {
      out.errorCode = t.slice(0, 120);
    }
    return out;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
  let reasoning = '';
  for (;;) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const p = s.slice(5).trim();
      if (p === '[DONE]') continue;
      let j;
      try {
        j = JSON.parse(p);
      } catch {
        continue;
      }
      if (j.usage?.completion_tokens != null) out.outTokens = j.usage.completion_tokens;
      const c = j.choices?.[0];
      if (!c) continue;
      const d = c.delta ?? {};
      if (typeof d.content === 'string') content += d.content;
      const r = d.reasoning_content ?? d.reasoning;
      if (typeof r === 'string') reasoning += r;
    }
  }
  out.content = content.trim().slice(0, 20) || null;
  out.reasoningChars = reasoning.length;
  return out;
}

const results = [];
for (const lvl of LEVELS) {
  for (const pass of [1, 2]) {
    const r = await probe(lvl);
    r.pass = pass;
    results.push(r);
  }
}

console.log(
  results
    .map(
      (r) =>
        `${r.sent.padEnd(8)} pass${r.pass} → ${String(r.status).padEnd(4)} ${
          r.errorCode ? `ERR ${r.errorCode}` : `content=${JSON.stringify(r.content)} 思考=${String(r.reasoningChars).padStart(4)}字符 outTokens=${r.outTokens}`
        }`,
    )
    .join('\n'),
);
console.log('\n--- raw ---');
console.log(JSON.stringify(results, null, 2));
