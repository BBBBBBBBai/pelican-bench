/**
 * _probe_effort2.mjs —— 续探：在「真实任务形状」上，reasoning_effort:"high" 到底改不改变思考量。
 *
 * 第一次探针（_probe_effort.mjs）已经定死了两件事：
 *   1. a6 接受 reasoning_effort 字段（200）；
 *   2. 它真的校验这个字段 —— 传 "not-a-real-level" 会被上游拒绝（400 upstream_rejected_request）。
 * 但那次用的题（17*23）太简单，baseline 与 high 的思考都是 60 字上下，分不出高低。
 *
 * 所以这次换成真实负载的形状：让它画一张小 SVG。这才是「思考会不会吃掉正文额度」的现场。
 * 同一题各跑一次 baseline / high，比对：思考字符数、正文 token、是否顶到 max_tokens。
 *
 * 密钥现读 config.local.json，不打印。用完即弃。
 * 跑：node .impeccable/harden/_probe_effort2.mjs
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const API_KEY = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8')).p_78j76c5s;
if (!API_KEY) throw new Error('config.local.json 里没有 p_78j76c5s');

const BASE = 'https://api.a6api.com';
const MODEL = 'deepseek-v4.1-flash';
const PROMPT = '请生成一张 SVG 图片：一只骑着自行车的鹈鹕。';
const MAX_TOKENS = 32000;

async function probe(label, extra) {
  const out = {
    label,
    sent: Object.keys(extra).length ? extra : '(无额外字段)',
    status: null,
    errorBody: null,
    reasoningChars: 0,
    reasoningHead: null,
    contentChars: 0,
    svgFound: false,
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
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: PROMPT }],
        temperature: 1,
        max_tokens: MAX_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
        ...extra,
      }),
    });
  } catch (err) {
    out.status = 'FETCH-FAILED';
    out.errorBody = String(err?.message ?? err);
    return out;
  }

  out.status = res.status;
  if (!res.ok) {
    out.errorBody = (await res.text()).slice(0, 300);
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
  out.reasoningHead = reasoning.trim().slice(0, 60) || null;
  out.contentChars = content.length;
  out.svgFound = /<svg[\s>]/i.test(content);
  out.elapsedMs = Date.now() - t0;
  return out;
}

const results = [];
for (const [label, extra] of [
  ['A-baseline', {}],
  ['B-effort-high', { reasoning_effort: 'high' }],
]) {
  results.push(await probe(label, extra));
}

console.log(JSON.stringify({ model: MODEL, maxTokens: MAX_TOKENS, prompt: PROMPT, results }, null, 2));
