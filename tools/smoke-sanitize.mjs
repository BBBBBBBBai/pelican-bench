// 验证 SVG 清洗：模型输出是不可信内容，落到 <img>/iframe 之前必须把可执行、可外联的部分去掉。
const API = 'http://127.0.0.1:8787';

async function run(model) {
  const res = await fetch(API + '/api/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // 模型名是 RunRequest 的顶层字段，不属于 inline 供应商。
      model,
      inline: {
        name: '注入测试',
        protocol: 'openai',
        baseUrl: 'http://127.0.0.1:9911',
        apiKey: 'sk-mock',
        params: { temperature: 1, maxTokens: 4096 },
      },
      promptId: 'animal:鹈鹕',
    }),
  });
  const text = await res.text();
  const doneLine = text.split('\n').find((l) => l.includes('"type":"done"'));
  return JSON.parse(doneLine.slice(5).trim()).record;
}

const rec = await run('mock-evil');
const detail = await (await fetch(`${API}/api/records/${rec.id}`)).json();
const served = await (await fetch(`${API}/api/records/${rec.id}/svg`)).text();
const rawFile = detail.svg ?? '';

console.log(`记录 id: ${rec.id}`);
console.log(`hasSvg=${rec.hasSvg} ok=${rec.ok} flags=${rec.flags.map((f) => f.code).join(',') || '(无)'}`);

const checks = [
  ['落盘原始 SVG 仍保留 script（用于「看源码」追溯）', /<script/i.test(rawFile), true],
  ['落盘原始 SVG 仍保留 <rect> 的 rx（源码层可回溯）', /<rect[^>]*\brx=/i.test(rawFile), true],
  ['服务出去的 SVG 无 <script>', /<script/i.test(served), false],
  ['服务出去的 SVG 无 onload=', /\sonload\s*=/i.test(served), false],
  ['服务出去的 SVG 无 onclick=', /\sonclick\s*=/i.test(served), false],
  ['服务出去的 SVG 无 <foreignObject>', /foreignObject/i.test(served), false],
  ['服务出去的 SVG 无 javascript:', /javascript:/i.test(served), false],
  ['服务出去的 SVG 无外链 https://example.com', /example\.com/i.test(served), false],
  ['服务出去的 <rect> 圆角被抹平（无 rx/ry）', /<rect[^>]*\b(?:rx|ry)\s*=/i.test(served), false],
  ['服务出去的 <ellipse> 保留 rx/ry（椭圆不能被抹掉）', /<ellipse[^>]*\brx="26"[^>]*\bry="18"/i.test(served), true],
  ['补上了 preserveAspectRatio（原本没有）', /preserveAspectRatio="xMidYMid meet"/i.test(served), true],
  ['原有 width="200" 被保留（不强行改成 100%）', /width="200"/i.test(served), true],
  ['保留正常图形（circle 还在）', /<circle/i.test(served), true],
  ['带 SVG 内容类型', true, true],
];

const ctype = (await fetch(`${API}/api/records/${rec.id}/svg`)).headers.get('content-type');
checks[checks.length - 1][1] = (ctype ?? '').includes('image/svg+xml');

let allPass = true;
for (const [name, got, want] of checks) {
  const pass = got === want;
  if (!pass) allPass = false;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}  (实际 ${got} / 期望 ${want})`);
}

console.log(`content-type: ${ctype}`);
console.log(`\n${allPass ? '全部通过' : '存在失败项'}`);

// 清理这条注入样本
await fetch(`${API}/api/records/${rec.id}`, { method: 'DELETE' });
if (!allPass) process.exitCode = 1;
