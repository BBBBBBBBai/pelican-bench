/**
 * 线上格式探针：起一个本地假供应商，把两个适配器真正发出去的请求体抓下来。
 * 目的：证明 reasoning_effort / thinking.budget_tokens 真的上了线，
 * 而不是只证明「代码里写了那一行」。不花任何真实额度。
 *
 * 跑法：npx tsx .impeccable/harden/_probe_wire.ts
 */
import http from 'node:http';
import { openaiAdapter } from '../../server/chat/openai.ts';
import { anthropicAdapter } from '../../server/chat/anthropic.ts';
import type { GenParams } from '../../shared/types.ts';

const captured: { path: string; auth: string; body: any }[] = [];

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body: any = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    captured.push({ path: req.url ?? '', auth: req.headers.authorization ?? '', body });

    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if ((req.url ?? '').includes('/v1/messages')) {
      // Anthropic 形状：够适配器跑完就行
      res.write(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"m1","model":"fake-anthropic"}}\n\n',
      );
      res.write(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"想"}}\n\n',
      );
      res.write(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"<svg/>"}}\n\n',
      );
      res.write(
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7}}\n\n',
      );
      res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    } else {
      res.write('data: {"id":"c1","model":"fake-openai","choices":[{"delta":{"content":"<svg/>"}}]}\n\n');
      res.write(
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":22,"total_tokens":33}}\n\n',
      );
      res.write('data: [DONE]\n\n');
    }
    res.end();
  });
});

await new Promise<void>((r) => server.listen(9922, '127.0.0.1', r));

const messages = [{ role: 'user' as const, content: '请生成一张 SVG 图片：一只骑着自行车的鹈鹕。' }];
const LEVELS: GenParams['effort'][] = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

// 1) [OI]：六档各发一次，抓 reasoning_effort
for (const effort of LEVELS) {
  const params: GenParams = { temperature: 1, maxTokens: 32000, effort };
  try {
    for await (const _ of openaiAdapter.stream({
      baseUrl: 'http://127.0.0.1:9922',
      apiKey: 'sk-probe',
      model: 'probe-model',
      params,
      messages,
    })) {
      /* 只为触发请求 */
    }
  } catch (e) {
    console.log(`  [openai ${effort}] 适配器抛错（不影响抓包）：${(e as Error).message}`);
  }
}

// 2) Anthropic：六档各发一次，抓 thinking.budget_tokens
for (const effort of LEVELS) {
  const params: GenParams = { temperature: 1, maxTokens: 32000, effort };
  try {
    for await (const _ of anthropicAdapter.stream({
      baseUrl: 'http://127.0.0.1:9922',
      apiKey: 'sk-probe',
      model: 'probe-model',
      params,
      messages,
    })) {
      /* 同上 */
    }
  } catch (e) {
    console.log(`  [anthropic ${effort}] 适配器抛错（不影响抓包）：${(e as Error).message}`);
  }
}

server.close();

const oi = captured.filter((c) => c.path.includes('chat/completions'));
const an = captured.filter((c) => c.path.includes('/v1/messages'));

console.log(`\n抓到 ${captured.length} 个请求（[OI] ${oi.length} / Anthropic ${an.length}）`);
console.log(`路径：[OI] ${oi[0]?.path}   Anthropic ${an[0]?.path}`);
console.log(`鉴权头：${oi[0]?.auth}`);

console.log('\n[OI] 发出去的正文键与值：');
for (const c of oi) {
  console.log(
    `  effort=${String(c.body.reasoning_effort).padEnd(8)} max_tokens=${c.body.max_tokens}  temperature=${c.body.temperature}  reasoning_effort 在不在体里: ${'reasoning_effort' in c.body}`,
  );
}
console.log(`  [OI] 体里还有 thinking 字段吗：${'thinking' in (oi[0]?.body ?? {})}`);

console.log('\nAnthropic 发出去的 thinking / temperature / top_p：');
for (const c of an) {
  console.log(
    `  budget=${String(c.body.thinking?.budget_tokens).padEnd(6)} type=${c.body.thinking?.type}  temperature=${c.body.temperature}  top_p=${'top_p' in c.body ? c.body.top_p : '(不发)'}  max_tokens=${c.body.max_tokens}`,
  );
}

const budgets = an.map((c) => c.body.thinking?.budget_tokens);
const oiEfforts = oi.map((c) => c.body.reasoning_effort);
console.log(`\n六档 budget 序列：${budgets.join(' / ')}`);
console.log(`六档 reasoning_effort 序列：${oiEfforts.join(' / ')}`);
console.log(`budget 全部小于 max_tokens(32000)：${budgets.every((b) => b < 32000)}`);
console.log(`六档 effort 全部原样透传：${JSON.stringify(oiEfforts) === JSON.stringify(LEVELS)}`);
