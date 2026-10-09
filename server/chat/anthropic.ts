import type { Adapter, StreamChunk, StreamOptions } from './types.ts';
import { postStream, readSse } from './types.ts';
import type { EffortLevel } from '../../shared/types.ts';

/**
 * 思考强度档位 → Anthropic extended thinking 的预算（token）。
 * 六档与 [OI] 侧的 reasoning_effort 同名同序，high 对齐 [OI] 的默认 max_tokens 量级。
 * ⚠️ 未实测（没有 Anthropic 的 key），是排出来的表，不是量出来的。
 */
const THINKING_BUDGET: Record<EffortLevel, number> = {
  minimal: 1024,
  low: 2048,
  medium: 4096,
  high: 8192,
  xhigh: 12288,
  max: 16000,
};

/**
 * Anthropic Messages 协议：POST {baseUrl}/v1/messages
 * 很多中转站只提供这个格式，所以单列一套适配。
 */
export const anthropicAdapter: Adapter = {
  async *stream(opts: StreamOptions): AsyncGenerator<StreamChunk> {
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/v1/messages`;

    const system = opts.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const userMessages = opts.messages
      .filter((m) => m.role === 'user')
      .map((m) => ({ role: 'user' as const, content: m.content }));

    const body: Record<string, unknown> = {
      model: opts.model,
      max_tokens: opts.params.maxTokens,
      messages: userMessages,
      stream: true,
    };
    if (system) body.system = system;

    // 思考强度 → extended thinking 的预算。Anthropic 没有 reasoning_effort 这种
    // 分档字段，它要的是一个具体的 token 数，所以这里必须有一张换算表。
    //
    // ⚠️ 这张表**没有实测过** —— 手上没有 Anthropic 的 key，六个预算值是按比例
    // 排出来的，不是量出来的。首次用 Anthropic 协议时请自己核一眼。
    // 1024 是 Anthropic 的硬下限；最大 16000 < max_tokens 32000，
    // 所以不会触发「预算必须小于 max_tokens」那条约束。
    body.thinking = { type: 'enabled', budget_tokens: THINKING_BUDGET[opts.params.effort] };
    // Anthropic 要求开启 thinking 时 temperature 必须为 1（top_p 同时会被拒）。
    // 后果要说明白：**Anthropic 协议下 top_p 永远不会被发出去** —— 因为 thinking
    // 现在恒开（effort 恒有值），没有「关掉思考好让 top_p 生效」这条路了。
    // 供应商表单里的 TOPP 对 Anthropic 是空转的。
    body.temperature = 1;

    const stream = await postStream(
      url,
      {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
      opts.signal,
    );

    for await (const evt of readSse(stream)) {
      let json: any;
      try {
        json = JSON.parse(evt.data);
      } catch {
        continue;
      }

      switch (json.type) {
        case 'message_start': {
          const msg = json.message ?? {};
          yield {
            responseModel: typeof msg.model === 'string' ? msg.model : undefined,
            responseId: typeof msg.id === 'string' ? msg.id : undefined,
            usage: msg.usage
              ? { input: msg.usage.input_tokens, output: msg.usage.output_tokens }
              : undefined,
          };
          break;
        }
        case 'content_block_delta': {
          const d = json.delta ?? {};
          if (d.type === 'text_delta' && d.text) yield { delta: d.text };
          else if (d.type === 'thinking_delta' && d.thinking) yield { reasoning: d.thinking };
          break;
        }
        case 'message_delta': {
          const chunk: StreamChunk = {};
          if (json.delta?.stop_reason) chunk.finishReason = json.delta.stop_reason;
          if (json.usage?.output_tokens != null) chunk.usage = { output: json.usage.output_tokens };
          if (chunk.finishReason || chunk.usage) yield chunk;
          break;
        }
        case 'error': {
          const msg = json.error?.message ?? JSON.stringify(json.error);
          throw new Error(`供应商返回错误：${msg}`);
        }
        default:
          break;
      }
    }
  },
};
