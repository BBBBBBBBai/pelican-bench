// 验证重试与思考通道：mock-error 配 retries=1 应当尝试两次并发出 retry 事件；
// mock-thinking 应当把 reasoning_content 走通并在开启 saveReasoning 时落盘 reasoning.txt。
const API = 'http://127.0.0.1:8787';

async function call(path, init) {
  const res = await fetch(API + path, init);
  return JSON.parse(await res.text());
}

async function run(inline, extra = {}) {
  const res = await fetch(API + '/api/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inline, promptId: 'animal:鹈鹕', ...extra }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const events = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data:'));
      if (line) events.push(JSON.parse(line.slice(5).trim()));
    }
  }
  return events;
}

const cfg = await call('/api/config');
const put = (patch) =>
  call('/api/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...cfg, hasKey: undefined, apiKeys: undefined, ...patch }),
  });

// inline 供应商只描述「往哪儿发」；模型名是 RunRequest 的顶层字段，随 extra 传。
const mk = (protocol = 'openai') => ({
  name: 'mock-inline',
  protocol,
  baseUrl: 'http://127.0.0.1:9911',
  apiKey: 'sk-mock',
});

// ---- 1) 重试 ----
await put({ retries: 1, saveReasoning: false });
const retryEvents = await run(mk(), { model: 'mock-error' });
const retryCount = retryEvents.filter((e) => e.type === 'retry').length;
const done1 = retryEvents.find((e) => e.type === 'done')?.record;
console.log(
  `[重试] retry 事件 ${retryCount} 次（期望 1）· attempts=${done1?.attempts}（期望 2）· flags=${done1?.flags.map((f) => f.code).join(',')} · ${retryCount === 1 && done1?.attempts === 2 ? 'PASS' : 'FAIL'}`,
);

// ---- 2) OpenAI 思考通道 ----
await put({ retries: 0, saveReasoning: true });
const thinkEvents = await run(mk(), { model: 'mock-thinking' });
const reasoningChars = thinkEvents.filter((e) => e.type === 'reasoning').reduce((n, e) => n + e.text.length, 0);
const done2 = thinkEvents.find((e) => e.type === 'done')?.record;
const detail2 = await call(`/api/records/${done2.id}`);
console.log(
  `[思考-openai] reasoning 事件字符数 ${reasoningChars}（期望 >0）· ok=${done2?.ok} · reasoning.txt 落盘 ${detail2.reasoning ? detail2.reasoning.length + ' 字符' : '无'} · ${reasoningChars > 0 && detail2.reasoning ? 'PASS' : 'FAIL'}`,
);

// ---- 3) Anthropic 思考通道 ----
const thinkEvents3 = await run(mk('anthropic'), { model: 'mock-thinking' });
const reasoningChars3 = thinkEvents3.filter((e) => e.type === 'reasoning').reduce((n, e) => n + e.text.length, 0);
const done3 = thinkEvents3.find((e) => e.type === 'done')?.record;
const detail3 = await call(`/api/records/${done3.id}`);
console.log(
  `[思考-anthropic] reasoning 事件字符数 ${reasoningChars3}（期望 >0）· finishReason=${done3?.finishReason} · ok=${done3?.ok} · ${reasoningChars3 > 0 && detail3.reasoning ? 'PASS' : 'FAIL'}`,
);

// ---- 4) 关闭 saveReasoning 时不落盘 ----
await put({ retries: 0, saveReasoning: false });
const t4 = await run(mk(), { model: 'mock-thinking' });
const done4 = t4.find((e) => e.type === 'done')?.record;
const detail4 = await call(`/api/records/${done4.id}`);
console.log(`[思考-关闭保存] reasoning.txt ${detail4.reasoning ? '仍存在(不符预期)' : '未落盘(符合预期)'} · ${detail4.reasoning ? 'FAIL' : 'PASS'}`);

// ---- 5) 模型名大小写/版本后缀不应误报 ----
// 供应商里已经不带模型名了，所以大小写这件事现在完全落在 RunRequest.model 上。
const p = await call('/api/providers', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: '大小写测试', protocol: 'openai', baseUrl: 'http://127.0.0.1:9911', params: { temperature: 1, maxTokens: 4096 }, apiKey: 'sk-mock' }),
});
const t5 = await run(null, { providerId: p.id, model: 'MOCK-GOOD' });
const done5 = t5.find((e) => e.type === 'done')?.record;
console.log(`[模型名大小写] 请求 MOCK-GOOD 返回 mock-good → flags=${done5?.flags.map((f) => f.code).join(',') || '(无)'} · ${done5?.flags.some((f) => f.code === 'model-mismatch') ? 'FAIL(误报)' : 'PASS'}`);
await call(`/api/providers/${p.id}`, { method: 'DELETE' });

// 恢复默认配置
await put({ retries: 1, saveReasoning: false });
console.log('\n已恢复默认配置：retries=1, timeoutSec=120');
