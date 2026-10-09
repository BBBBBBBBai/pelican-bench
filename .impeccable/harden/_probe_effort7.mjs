/**
 * _probe_effort7.mjs —— 六档在**真实负载**上到底分不分得开。
 *
 * 背景：短题（"Say OK."）上各档的思考字符数是纯噪声 —— medium 两次都 0、xhigh 一次 0 一次 38、
 * max 61/56、minimal 63/82。分不出高低。所以「六档」这件事本身还没被证明有意义。
 *
 * 这一轮用真实负载（画一张 SVG，与 _probe_effort2.mjs 同一个题）跑两端：minimal 与 max。
 * 已有参照点（同题、max_tokens 32000）：baseline 思考 18440 字符 / out 11078 token / 35.8s；
 * high 思考 19916 / out 13259 / 51.5s。
 *
 * 若 minimal 与 max 也落在同一个区间，说明这个旋钮在你的场景里近乎不起作用，
 * 那六档选择器就是装饰品 —— 这件事必须在你花时间实现之前告诉你。
 *
 * 用完即弃。跑：node .impeccable/harden/_probe_effort7.mjs
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const API_KEY = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8')).p_78j76c5s;
if (!API_KEY) throw new Error('config.local.json 里没有 p_78j76c5s');

const BASE = 'https://api.a6api.com';
const MODEL = 'deepseek-v4.1-flash';
const PROMPT = '请生成一张 SVG 图片：一只骑着自行车的鹈鹕。';

async function probe(label, extra) {
  const out = { label, sent: Object.keys(extra).length ? extra : '(无)', status: null, errorCode: null, reasoningChars: 0, contentChars: 0, outTokens: null, finishReason: null, elapsedMs: null };

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: PROMPT }],
        temperature: 1,
        max_tokens: 32000,
        stream: true,
        stream_options: { include_usage: true },
        ...extra,
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
      out.errorCode = j.error?.code ?? t.slice(0, 80);
    } catch {
      out.errorCode = t.slice(0, 80);
    }
    out.elapsedMs = Date.now() - t0;
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
      if (c.finish_reason) out.finishReason = c.finish_reason;
      const d = c.delta ?? {};
      if (typeof d.content === 'string') content += d.content;
      const r = d.reasoning_content ?? d.reasoning;
      if (typeof r === 'string') reasoning += r;
    }
  }
  out.reasoningChars = reasoning.length;
  out.contentChars = content.length;
  out.elapsedMs = Date.now() - t0;
  return out;
}

const results = [];
for (const [label, extra] of [
  ['minimal', { reasoning_effort: 'minimal' }],
  ['max', { reasoning_effort: 'max' }],
]) {
  results.push(await probe(label, extra));
}

console.log(
  results
    .map(
      (r) =>
        `${r.label.padEnd(9)} → ${String(r.status).padEnd(4)} ${
          r.errorCode
            ? `ERR ${r.errorCode}`
            : `思考=${String(r.reasoningChars).padStart(5)}字符 正文=${String(r.contentChars).padStart(4)}字符 out=${r.outTokens} finish=${r.finishReason} ${(r.elapsedMs / 1000).toFixed(1)}s`
        }`,
    )
    .join('\n'),
);
console.log('\n参照：baseline 思考=18440 out=11078 35.8s · high 思考=19916 out=13259 51.5s');
