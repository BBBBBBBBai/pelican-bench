// 验证「手动中止」：中途断开连接后，服务端应当停下、落盘部分结果并打 aborted 标签。
const API = 'http://127.0.0.1:8787';
const ctl = new AbortController();

const res = await fetch(API + '/api/run', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    // 模型名是 RunRequest 的顶层字段，不属于 inline 供应商。
    model: 'mock-hang',
    inline: {
      name: '中止测试',
      protocol: 'openai',
      baseUrl: 'http://127.0.0.1:9911',
      apiKey: 'sk-mock',
      params: { temperature: 1, maxTokens: 4096 },
    },
    promptId: 'animal:鹈鹕',
  }),
  signal: ctl.signal,
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
let deltas = 0;

const readLoop = (async () => {
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      deltas += (buf.match(/"type":"delta"/g) ?? []).length;
      buf = buf.replace(/"type":"delta"/g, '"type":"_seen"');
    }
  } catch {
    /* 主动中止会抛错，属预期 */
  }
})();

// 收到几个 delta 之后掐断
await new Promise((r) => setTimeout(r, 700));
ctl.abort();
await readLoop;

// 等服务端落盘
await new Promise((r) => setTimeout(r, 800));

const list = await (await fetch(API + '/api/records')).json();
const rec = list.records[0];
console.log('最新记录：');
console.log('  providerName :', rec.providerName);
console.log('  aborted      :', rec.aborted);
console.log('  flags        :', rec.flags.map((f) => f.code).join(',') || '(无)');
console.log('  ok           :', rec.ok);
console.log('  rawLength    :', rec.rawLength, '(>0 说明部分结果被保住了)');
console.log('  durationMs   :', rec.durationMs);
const pass = rec.aborted === true && rec.flags.some((f) => f.code === 'aborted') && rec.rawLength > 0 && rec.ok === false;
console.log(`\n${pass ? 'PASS' : 'FAIL'}`);
if (!pass) process.exitCode = 1;
