/**
 * _probe_effort4.mjs —— 枚举探测：a6 到底接受哪几个「思考强度」取值。
 *
 * 背景：a6 会真校验 reasoning_effort（传 "not-a-real-level" → 400 upstream_rejected_request），
 * 所以它自己就是最权威的枚举表 —— 比文档可靠，因为它检的是它自己上游真的认什么。
 * 用户要求「其他强度选项按 ChatGPT 默认的强度来设定」，所以候选是 OpenAI 那套：
 *   minimal / low / medium / high（另有历史版本里的 none，一并试）。
 *
 * 顺带量每个档位的思考长度（同题 "Say OK."），看档位之间是否真的分得开。
 * 成本：5 个小请求（max_tokens 64）。用完即弃。
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const API_KEY = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8')).p_78j76c5s;
if (!API_KEY) throw new Error('config.local.json 里没有 p_78j76c5s');

const BASE = 'https://api.a6api.com';
const MODEL = 'deepseek-v4.1-flash';
const PROMPT = 'Say OK.';

async function probe(value) {
  const out = { sent: value === null ? '(不发该字段)' : value, status: null, errorCode: null, content: null, reasoningChars: null };

  let res;
  try {
    res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: PROMPT }],
        temperature: 1,
        max_tokens: 64,
        stream: true,
        ...(value === null ? {} : { reasoning_effort: value }),
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
for (const v of [null, 'minimal', 'none', 'low', 'medium', 'high']) {
  results.push(await probe(v));
}

console.log(
  results
    .map((r) => `${String(r.sent).padEnd(10)} → ${String(r.status).padEnd(4)} ${r.errorCode ? `ERR ${r.errorCode}` : `content=${JSON.stringify(r.content)} 思考=${r.reasoningChars} 字符`}`)
    .join('\n'),
);
console.log('\n--- raw ---');
console.log(JSON.stringify(results, null, 2));
