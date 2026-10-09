/**
 * _probe_effort6.mjs —— 复核：上一轮那条「a6 严格校验 reasoning_effort」的结论可能是错的。
 *
 * 上一轮传 "not-a-real-level" 得到 400，我据此认定 a6 会校验这个字段。
 * 但那条错误的 code 是 fixed_merchant_unavailable、reason_code 是 upstream_rejected_request，
 * 文案是「该商家拒绝了本次请求，请求参数或能力可能不被支持」—— 这是**商家级**的拒绝，
 * 完全可能是上游那一瞬间不可用，而不是参数被校验。
 *
 * 如果它其实不校验，那么 xhigh / max 这两个档返回 200 就说明不了任何事
 * （任何字符串都会 200），用户给的六档表就不能照抄。
 *
 * 做法：非法值、合法值、非法值、合法值…… 交替各跑 4 次，看非法值是否稳定 400。
 * 用完即弃。跑：node .impeccable/harden/_probe_effort6.mjs
 */
import { readFileSync } from 'node:fs';

const ROOT = 'E:\\学习资料\\dsh\\鹈鹕测试工具';
const API_KEY = JSON.parse(readFileSync(`${ROOT}\\config.local.json`, 'utf8')).p_78j76c5s;
if (!API_KEY) throw new Error('config.local.json 里没有 p_78j76c5s');

const BASE = 'https://api.a6api.com';
const MODEL = 'deepseek-v4.1-flash';

async function probe(value) {
  const out = { sent: value, status: null, code: null, reasonCode: null, msg: null };

  let res;
  try {
    res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Say OK.' }],
        temperature: 1,
        max_tokens: 64,
        stream: false,
        ...(value === null ? {} : { reasoning_effort: value }),
      }),
    });
  } catch (err) {
    out.status = 'FETCH-FAILED';
    out.msg = String(err?.message ?? err);
    return out;
  }

  out.status = res.status;
  const t = await res.text();
  if (res.ok) return out;
  try {
    const j = JSON.parse(t);
    out.code = j.error?.code ?? null;
    out.reasonCode = j.error?.reason_code ?? null;
    out.msg = (j.error?.message ?? '').slice(0, 70);
  } catch {
    out.msg = t.slice(0, 90);
  }
  return out;
}

const results = [];
for (let i = 0; i < 4; i += 1) {
  results.push({ round: i + 1, kind: 'bogus', ...(await probe('not-a-real-level')) });
  results.push({ round: i + 1, kind: 'valid', ...(await probe('high')) });
  results.push({ round: i + 1, kind: 'bogus2', ...(await probe('totally-made-up-9')) });
}

console.log(
  results
    .map(
      (r) =>
        `round${r.round} ${r.kind.padEnd(7)} ${String(r.sent).padEnd(18)} → ${String(r.status).padEnd(4)} ${
          r.status === 200 ? 'OK' : `${r.code} / ${r.reasonCode} · ${r.msg}`
        }`,
    )
    .join('\n'),
);

const bogus = results.filter((r) => r.kind !== 'valid');
const bogusFail = bogus.filter((r) => r.status !== 200).length;
const validFail = results.filter((r) => r.kind === 'valid' && r.status !== 200).length;
console.log(`\n非法值 ${bogus.length} 次里失败 ${bogusFail} 次；合法值 high 失败 ${validFail} 次`);
console.log(bogusFail === bogus.length ? '⇒ 非法值稳定失败：该字段确实被校验' : '⇒ 非法值有时成功：上一次那条 400 是偶发的，不能当校验证据');
