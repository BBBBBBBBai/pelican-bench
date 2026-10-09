/**
 * _probe_maxtok.mjs —— 关键风险探针：把 max_tokens 提到 32000 会不会被某些供应商拒绝。
 *
 * 背景：用户要把默认 max_tokens 从 8192 提到 32000（当作「放开思考」）。
 * 已知 a6 + deepseek-v4.1-flash 能吃 32000（记录 20261008-181956-hdfy3 就是这么跑通的）。
 * 但候选清单里还有 gpt-6.1-sol —— 它跑在 banban 上，那条上游对 max_tokens 的容忍上限未知。
 * 如果它有更低的上限，全局设 32000 就等于把非思考模型全打死，比截断更糟。
 *
 * 顺带量一下：不带 max_tokens 时供应商会不会自己填一个小默认值（这是当初否掉「完全不发」的理由）。
 * 都是 max_tokens 探测，用短题 + 小输出，成本可忽略。用完即弃。
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const keys = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8'));
const CASES = [
  ['a6', 'https://api.a6api.com', keys.p_78j76c5s, 'deepseek-v4.1-flash'],
  ['banban-0.18', 'https://api.banban.plus', keys.p_d34xbpav, 'gpt-6.1-sol'],
  ['banban-0.23', 'https://api.banban.plus', keys.p_l3wid7ej, 'gpt-6.1-sol'],
];
const MAXES = [8192, 32000, 65536, null]; // null = 不发该字段
const PROMPT = 'Say OK.';

async function probe(provider, base, key, model, maxTokens) {
  const out = {
    provider,
    model,
    maxTokens: maxTokens === null ? '(不发)' : maxTokens,
    status: null,
    errorCode: null,
    content: null,
    usage: null,
  };

  const body = {
    model,
    messages: [{ role: 'user', content: PROMPT }],
    temperature: 1,
    stream: true,
    stream_options: { include_usage: true },
    ...(maxTokens === null ? {} : { max_tokens: maxTokens }),
  };

  let res;
  try {
    res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
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
      out.errorCode = `${j.error?.code ?? '?'} / ${j.error?.message?.slice(0, 60) ?? ''}`;
    } catch {
      out.errorCode = t.slice(0, 120);
    }
    return out;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
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
      if (j.usage) out.usage = { in: j.usage.prompt_tokens, out: j.usage.completion_tokens, total: j.usage.total_tokens };
      const c = j.choices?.[0];
      if (c && typeof c.delta?.content === 'string') content += c.delta.content;
    }
  }
  out.content = content.trim().slice(0, 20) || null;
  return out;
}

const results = [];
for (const [name, base, key, model] of CASES) {
  for (const maxTokens of MAXES) {
    results.push(await probe(name, base, key, model, maxTokens));
  }
}

console.log(
  results
    .map(
      (r) =>
        `${r.provider.padEnd(12)} ${r.model.padEnd(20)} max=${String(r.maxTokens).padEnd(7)} → ${String(r.status).padEnd(4)} ${
          r.errorCode ? `ERR ${r.errorCode}` : `content=${JSON.stringify(r.content)} usage=${JSON.stringify(r.usage)}`
        }`,
    )
    .join('\n'),
);
console.log('\n--- raw ---');
console.log(JSON.stringify(results, null, 2));
