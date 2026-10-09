/**
 * _probe_effort3.mjs —— 关键风险探针：无条件发 reasoning_effort:"high" 会不会把非思考模型打挂。
 *
 * 已知：a6 会真的校验这个字段（传非法值 → 400 upstream_rejected_request）。
 * 那么问题来了 —— 你的候选清单里还有 gpt-6.1-sol 这类非思考模型，
 * 如果它对不支持的模型也严格校验，无条件发这个字段就等于把主用模型全打死。
 * 这比截断更糟，所以必须先测。
 *
 * 另外测 banban 两家是否同样接受（它们是另一条上游）。
 * 都是小请求（max_tokens 64），成本可忽略。用完即弃。
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const keys = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8'));
const PROVIDERS = [
  ['a6', 'https://api.a6api.com', keys.p_78j76c5s],
  ['banban-0.18', 'https://api.banban.plus', keys.p_d34xbpav],
  ['banban-0.23', 'https://api.banban.plus', keys.p_l3wid7ej],
];
const MODELS = ['gpt-6.1-sol', 'deepseek-v4.1-flash'];
const PROMPT = 'Say OK.';

async function probe(provider, base, key, model, extra) {
  const out = { provider, model, sent: Object.keys(extra).length ? extra : '(无额外字段)', status: null, error: null, content: null, reasoningChars: null };

  let res;
  try {
    res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: PROMPT }],
        temperature: 1,
        max_tokens: 64,
        stream: true,
        ...extra,
      }),
    });
  } catch (err) {
    out.status = 'FETCH-FAILED';
    out.error = String(err?.message ?? err);
    return out;
  }

  out.status = res.status;
  if (!res.ok) {
    const t = await res.text();
    try {
      out.error = JSON.parse(t).error?.code ?? t.slice(0, 160);
    } catch {
      out.error = t.slice(0, 160);
    }
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
  out.content = content.trim().slice(0, 40) || null;
  out.reasoningChars = reasoning.length;
  return out;
}

const results = [];
for (const [name, base, key] of PROVIDERS) {
  for (const model of MODELS) {
    for (const [label, extra] of [
      ['baseline', {}],
      ['high', { reasoning_effort: 'high' }],
    ]) {
      const r = await probe(name, base, key, model, extra);
      r.case = label;
      results.push(r);
    }
  }
}

const summary = results.map(
  (r) =>
    `${r.provider.padEnd(12)} ${r.model.padEnd(20)} ${r.case.padEnd(9)} → ${String(r.status).padEnd(4)} ${
      r.error ? `ERR ${r.error}` : `content=${JSON.stringify(r.content)} reasoningChars=${r.reasoningChars}`
    }`,
);

console.log(summary.join('\n'));
console.log('\n--- raw ---');
console.log(JSON.stringify(results, null, 2));
