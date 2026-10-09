// 冒烟测试：用 tools/mock-provider.mjs 的六个假模型跑一遍，检查打标是否符合预期。
// 用法：先启动 mock-provider，再 `node tools/smoke.mjs`（需要 dev server 在 8787）。
const API = 'http://127.0.0.1:8787';

async function json(path, init) {
  const res = await fetch(API + path, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} 返回非 JSON: ${text.slice(0, 200)}`);
  }
}

// 模型名是 RunRequest 的顶层字段，不再属于 inline 供应商。
async function runOnce(inline, model, label) {
  const res = await fetch(API + '/api/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inline, model, promptId: 'animal:鹈鹕' }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let record = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const evt = JSON.parse(line.slice(5).trim());
      if (evt.type === 'done') record = evt.record;
      if (evt.type === 'error') console.log(`  [error event] ${evt.message}`);
    }
  }
  return { label, record };
}

const cases = [
  { label: 'mock-good     ', model: 'mock-good', want: '(无标签, ok=true)' },
  { label: 'mock-bad      ', model: 'mock-bad', want: 'not-svg, ok=false' },
  { label: 'mock-truncated', model: 'mock-truncated', want: 'truncated, ok=false' },
  { label: 'mock-mismatch ', model: 'mock-mismatch', want: 'model-mismatch, ok=false' },
  { label: 'mock-error    ', model: 'mock-error', want: 'http-error, ok=false' },
  { label: 'mock-hang     ', model: 'mock-hang', want: 'timeout, ok=false' },
];

// Anthropic 协议走完全独立的一套适配器，必须单独验一遍
const anthropicCases = [
  { label: 'A:good        ', model: 'mock-good', want: '(无标签, ok=true)', protocol: 'anthropic' },
  { label: 'A:bad         ', model: 'mock-bad', want: 'not-svg, ok=false', protocol: 'anthropic' },
  { label: 'A:truncated   ', model: 'mock-truncated', want: 'truncated, ok=false', protocol: 'anthropic' },
  { label: 'A:mismatch    ', model: 'mock-mismatch', want: 'model-mismatch, ok=false', protocol: 'anthropic' },
  { label: 'A:error       ', model: 'mock-error', want: 'http-error, ok=false', protocol: 'anthropic' },
  { label: 'A:hang        ', model: 'mock-hang', want: 'timeout, ok=false', protocol: 'anthropic' },
];

// mock-hang 需要短超时，先临时调小
const before = await json('/api/config');
const hadKey = before.hasKey;
await json('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...before, hasKey: undefined, apiKeys: undefined, timeoutSec: 6, retries: 0 }),
});

const results = [];
for (const c of [...cases, ...anthropicCases]) {
  const inline = {
    name: c.model,
    protocol: c.protocol ?? 'openai',
    baseUrl: 'http://127.0.0.1:9911',
    apiKey: 'sk-mock',
  };
  const t0 = Date.now();
  const { record } = await runOnce(inline, c.model, c.label);
  const ms = Date.now() - t0;
  if (!record) {
    results.push({ ...c, got: '!! 没有 done 事件', ms });
    continue;
  }
  const flags = record.flags.map((f) => f.code).join(',') || '(无)';
  const pass = record.flags.map((f) => f.code).sort().join(',');
  // want 形如 'truncated, ok=false' 或 '(无标签, ok=true)'
  const wantCodes = c.want
    .replace(/[()]/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('ok=') && s !== '无标签');
  const wantOk = /ok=(true|false)/.exec(c.want)?.[1];
  const ok =
    wantCodes.every((code) => pass.includes(code)) &&
    (wantOk === undefined || String(record.ok) === wantOk);
  results.push({
    label: c.label,
    want: c.want,
    flags,
    ok: record.ok,
    durationMs: record.durationMs,
    rawLength: record.rawLength,
    hasSvg: record.hasSvg,
    attempts: record.attempts,
    pass,
    ms,
    结果: ok ? 'PASS' : 'FAIL',
  });
}

await json('/api/config', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...before, hasKey: undefined, apiKeys: undefined, timeoutSec: 120, retries: 1 }),
});

console.log('\n模型            期望标签                实际标签            ok    svg   rawLen  耗时');
console.log('-'.repeat(96));
for (const r of results) {
  console.log(
    `${r.label}  ${String(r.want).padEnd(22)} ${String(r.flags).padEnd(20)} ${String(r.ok).padEnd(5)} ${String(r.hasSvg).padEnd(5)} ${String(r.rawLength).padEnd(7)} ${r.ms}ms  ${r.结果}`,
  );
}
const failed = results.filter((r) => r.结果 === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) process.exitCode = 1;
