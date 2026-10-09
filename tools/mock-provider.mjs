/**
 * 本地假供应商：不花钱就能把整条链路跑通。
 *
 *   node tools/mock-provider.mjs
 *   → 监听 http://127.0.0.1:9911
 *
 * 然后在界面右侧新增一个供应商：
 *   协议   [OI] 兼容
 *   地址   http://127.0.0.1:9911
 *   Key    任意非空字符串
 *   模型   mock-good / mock-bad / mock-truncated / mock-mismatch
 *
 * 四个模型分别模拟：正常出图、画不出来（输出废话）、被截断、偷换模型。
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 9911);

const SVG_GOOD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140">
  <rect width="200" height="140" fill="#eef6ff"/>
  <circle cx="55" cy="100" r="22" fill="none" stroke="#333" stroke-width="4"/>
  <circle cx="145" cy="100" r="22" fill="none" stroke="#333" stroke-width="4"/>
  <path d="M55 100 L95 62 L145 100" fill="none" stroke="#333" stroke-width="4"/>
  <path d="M95 62 L118 62" stroke="#333" stroke-width="4"/>
  <ellipse cx="100" cy="52" rx="26" ry="18" fill="#ffd166" stroke="#333" stroke-width="3"/>
  <path d="M126 50 q18 4 6 16 q-6 6 -14 2" fill="#f4a261" stroke="#333" stroke-width="3"/>
  <circle cx="92" cy="46" r="3" fill="#333"/>
  <text x="100" y="132" font-size="11" text-anchor="middle" fill="#333">mock rider</text>
</svg>`;

const SVG_TRUNCATED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140">
  <rect width="200" height="140" fill="#fff3e0"/>
  <circle cx="55" cy="100" r="22" fill="none" stroke="#333" stroke-width="4"/>
  <circle cx="145" cy="100" r="22" fill="none" stroke="#333" stroke-width="4"/>`;

const CHUNK = 24;

/* ────────────────────────────────────────────────────────────────────────────
   按「供应商模型」换画风。不同的被测模型画出不同的样子，这样机架上多格并排
   时才看得出这是横评工具，而不是同一张图复制了很多遍。
   其中 mock-inkonly 故意不给底色、只用深色描边——它铺在深色机架上就是会
   看不见的那种输出，属于用户已经知情的取舍，必须能在界面上看出来。
   ──────────────────────────────────────────────────────────────────────────── */

const PALETTES = {
  'mock-good': { bg: '#eef6ff', ink: '#333333', accent: '#ffd166', name: 'MOCK-GOOD' },
  'mock-paper': { bg: '#ffffff', ink: '#111111', accent: '#d4d4d4', name: 'MOCK-PAPER' },
  'mock-inkonly': { bg: null, ink: '#1a1a1a', accent: null, name: 'MOCK-INKONLY' },
  'mock-vivid': { bg: '#12343b', ink: '#e0fbfc', accent: '#ee6c4d', name: 'MOCK-VIVID' },
  'mock-thinking': { bg: '#f3f0ff', ink: '#3d3a4a', accent: '#b9a7ff', name: 'MOCK-THINKING' },
  'mock-mismatch': { bg: '#fff5f5', ink: '#4a2f2f', accent: '#ffb3b3', name: 'MOCK-MISMATCH' },
};

function riderSvg(palette, animal) {
  const p = palette ?? PALETTES['mock-good'];
  const back = p.bg ? `  <rect width="200" height="140" fill="${p.bg}"/>\n` : '';
  const body = p.accent ?? 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140">
${back}  <circle cx="55" cy="100" r="22" fill="none" stroke="${p.ink}" stroke-width="4"/>
  <circle cx="145" cy="100" r="22" fill="none" stroke="${p.ink}" stroke-width="4"/>
  <path d="M55 100 L95 62 L145 100" fill="none" stroke="${p.ink}" stroke-width="4"/>
  <path d="M95 62 L118 62" stroke="${p.ink}" stroke-width="4"/>
  <ellipse cx="100" cy="52" rx="26" ry="18" fill="${body}" stroke="${p.ink}" stroke-width="3"/>
  <path d="M126 50 q18 4 6 16 q-6 6 -14 2" fill="${body}" stroke="${p.ink}" stroke-width="3"/>
  <circle cx="92" cy="46" r="3" fill="${p.ink}"/>
  <text x="100" y="133" font-size="10" text-anchor="middle" fill="${p.ink}">${animal} · ${p.name}</text>
</svg>`;
}

/** 从题面里把那只动物抠出来，画在图上，好让每一格一眼就分得清 */
function pickAnimal(text) {
  const src = String(text ?? '');
  const zh = /自行车的([^。，,.\n]+)/.exec(src);
  if (zh) return zh[1].trim();
  const en = /riding a bicycle[^.]*?\bof\s+(?:an?\s+)?([a-zA-Z -]{2,24})/i.exec(src);
  if (en) return en[1].trim();
  const en2 = /a\s+([a-zA-Z -]{2,20})\s+riding a bicycle/i.exec(src);
  return en2 ? en2[1].trim() : 'animal';
}

/** 请求体里最后一条 user 消息的正文 */
function briefOf(payload) {
  const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    if (m?.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content.map((c) => (typeof c === 'string' ? c : (c?.text ?? ''))).join(' ');
    }
  }
  if (typeof payload?.system === 'string') return payload.system;
  return '';
}

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

function sseEvent(res, event, obj) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`);
}

function streamText(res, model, text, finishReason, reasoning = '') {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  sse(res, { id: `chatcmpl-mock-${Date.now()}`, object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { role: 'assistant' } }] });

  // 先吐思考（reasoning_content），再吐正文，用来验证前后端的 reasoning 通道
  let r = 0;
  const seedReasoning = setInterval(() => {
    if (r >= reasoning.length) {
      clearInterval(seedReasoning);
      startContent();
      return;
    }
    const piece = reasoning.slice(r, r + CHUNK);
    r += CHUNK;
    sse(res, { id: 'x', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { reasoning_content: piece } }] });
  }, 12);

  let contentTimer = null;

  function startContent() {
    let i = 0;
    contentTimer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(contentTimer);
        sse(res, { id: 'x', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] });
        sse(res, { id: 'x', object: 'chat.completion.chunk', model, choices: [], usage: { prompt_tokens: 120, completion_tokens: Math.ceil(text.length / 4), total_tokens: 120 + Math.ceil(text.length / 4) } });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      const piece = text.slice(i, i + CHUNK);
      i += CHUNK;
      sse(res, { id: 'x', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { content: piece } }] });
    }, 12);
  }

  res.on('close', () => {
    clearInterval(seedReasoning);
    if (contentTimer) clearInterval(contentTimer);
  });
}

/** Anthropic Messages 协议的 SSE：字段名与 OpenAI 完全不同，单独一套 */
function streamAnthropic(res, model, text, { thinking = '', stopReason = 'end_turn', returnedModel } = {}) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const id = `msg_mock_${Date.now()}`;
  sseEvent(res, 'message_start', {
    type: 'message_start',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model: returnedModel ?? model,
      content: [],
      stop_reason: null,
      usage: { input_tokens: 120, output_tokens: 1 },
    },
  });
  sseEvent(res, 'ping', { type: 'ping' });

  // 思考块（用来验证 thinking_delta → reasoning 通道）
  let blockIndex = 0;
  if (thinking) {
    sseEvent(res, 'content_block_start', {
      type: 'content_block_start',
      index: blockIndex,
      content_block: { type: 'thinking', thinking: '' },
    });
    for (let i = 0; i < thinking.length; i += CHUNK) {
      sseEvent(res, 'content_block_delta', {
        type: 'content_block_delta',
        index: blockIndex,
        delta: { type: 'thinking_delta', thinking: thinking.slice(i, i + CHUNK) },
      });
    }
    sseEvent(res, 'content_block_stop', { type: 'content_block_stop', index: blockIndex });
    blockIndex += 1;
  }

  sseEvent(res, 'content_block_start', {
    type: 'content_block_start',
    index: blockIndex,
    content_block: { type: 'text', text: '' },
  });

  let i = 0;
  const timer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(timer);
      sseEvent(res, 'content_block_stop', { type: 'content_block_stop', index: blockIndex });
      sseEvent(res, 'message_delta', {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: Math.ceil(text.length / 4) },
      });
      sseEvent(res, 'message_stop', { type: 'message_stop' });
      res.end();
      return;
    }
    const piece = text.slice(i, i + CHUNK);
    i += CHUNK;
    sseEvent(res, 'content_block_delta', {
      type: 'content_block_delta',
      index: blockIndex,
      delta: { type: 'text_delta', text: piece },
    });
  }, 12);

  res.on('close', () => clearInterval(timer));
}

const THINKING_SAMPLE = '用户想要一只骑自行车的动物。我先画两个轮子，再画车架，最后画动物身体和头。注意轮子要用圆，车架用折线。';

/** 故意埋雷：脚本、事件属性、外联 iframe、javascript: 协议，用来验证清洗是否到位 */
const SVG_EVIL = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 140" width="200" height="140" onload="alert('onload')">
  <script>alert('script tag')</script>
  <rect width="200" height="140" rx="24" ry="24" fill="#fee" onclick="alert('click')"/>
  <ellipse cx="100" cy="70" rx="26" ry="18" fill="#fdd"/>
  <foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><script>alert('fo')</script></body></foreignObject>
  <a xlink:href="javascript:alert('href')"><circle cx="100" cy="70" r="30" fill="#f88"/></a>
  <image href="https://example.com/track.png" width="10" height="10"/>
  <text x="100" y="132" font-size="11" text-anchor="middle" fill="#333">evil sample</text>
</svg>`;

function handleModel(res, model, animal = 'animal') {
  const draw = () => riderSvg(PALETTES[model], animal);
  switch (model) {
    case 'mock-bad':
      streamText(res, model, '抱歉，我无法生成图片，因为我是纯文本模型，没有绘图能力。', 'stop');
      break;
    case 'mock-truncated':
      streamText(res, model, SVG_TRUNCATED, 'length');
      break;
    case 'mock-mismatch':
      streamText(res, 'totally-different-model-v9', draw(), 'stop');
      break;
    case 'mock-thinking':
      streamText(res, model, draw(), 'stop', THINKING_SAMPLE);
      break;
    case 'mock-evil':
      streamText(res, model, SVG_EVIL, 'stop');
      break;
    case 'mock-error':
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'mock upstream exploded' } }));
      break;
    case 'mock-hang':
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
      sse(res, { id: 'x', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { content: '<svg ' } }] });
      // 故意不结束，用来验证超时与中止
      break;
    default:
      streamText(res, model, draw(), 'stop');
      break;
  }
}

function handleAnthropic(res, model, animal = 'animal') {
  const draw = () => riderSvg(PALETTES[model], animal);
  switch (model) {
    case 'mock-bad':
      streamAnthropic(res, model, '抱歉，我无法生成图片，因为我是纯文本模型，没有绘图能力。');
      break;
    case 'mock-truncated':
      streamAnthropic(res, model, SVG_TRUNCATED, { stopReason: 'max_tokens' });
      break;
    case 'mock-evil':
      streamAnthropic(res, model, SVG_EVIL);
      break;
    case 'mock-mismatch':
      streamAnthropic(res, model, draw(), { returnedModel: 'totally-different-model-v9' });
      break;
    case 'mock-thinking':
      streamAnthropic(res, model, draw(), { thinking: THINKING_SAMPLE });
      break;
    case 'mock-error':
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'mock upstream exploded' } }));
      break;
    case 'mock-hang':
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
      sseEvent(res, 'message_start', {
        type: 'message_start',
        message: { id: 'msg_mock_hang', model, usage: { input_tokens: 10, output_tokens: 0 } },
      });
      break;
    default:
      streamAnthropic(res, model, draw());
      break;
  }
}

const server = createServer((req, res) => {
  const url = req.url ?? '';
  const isOpenAI = url.includes('/chat/completions');
  const isAnthropic = url.includes('/v1/messages');

  if (req.method !== 'POST' || (!isOpenAI && !isAnthropic)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'not found' } }));
    return;
  }

  let body = '';
  req.on('data', (c) => {
    body += c;
  });
  req.on('end', () => {
    let model = 'mock-good';
    let payload = {};
    try {
      payload = JSON.parse(body);
      model = payload.model ?? model;
    } catch {
      /* 用默认值 */
    }
    const animal = pickAnimal(briefOf(payload));
    console.log(`[mock] ${isAnthropic ? 'anthropic' : 'openai'} ${model} ← ${animal}`);

    if (isAnthropic) handleAnthropic(res, model, animal);
    else handleModel(res, model, animal);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] 假供应商已启动：http://127.0.0.1:${PORT}`);
  console.log('[mock] OpenAI 端点：POST /v1/chat/completions');
  console.log('[mock] Anthropic 端点：POST /v1/messages');
  console.log(
    '[mock] 可用模型：mock-good / mock-paper / mock-inkonly / mock-vivid / mock-bad / mock-truncated / mock-mismatch / mock-error / mock-hang / mock-thinking / mock-evil',
  );
});
