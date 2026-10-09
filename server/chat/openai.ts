import type { Adapter, StreamChunk, StreamOptions } from './types.ts';
import { postStream, readSse } from './types.ts';

/**
 * [OI] 兼容协议：POST {baseUrl}/v1/chat/completions
 * 覆盖 [OI] 官方、DeepSeek、Kimi、智谱以及绝大多数国内中转站。
 */
export const openaiAdapter: Adapter = {
  async *stream(opts: StreamOptions): AsyncGenerator<StreamChunk> {
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts.params.temperature,
      max_tokens: opts.params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (typeof opts.params.topP === 'number') body.top_p = opts.params.topP;
    // 思考强度。[OI] 兼容协议里思考链和正文共用同一个 max_tokens，
    // 所以「让模型想多久」只能靠这个字段说 —— 没有别的旋钮。
    // 值就是档位字面量（minimal…max），实测上游会校验它：编造的值稳定返回 400。
    body.reasoning_effort = opts.params.effort;

    const stream = await postStream(
      url,
      { authorization: `Bearer ${opts.apiKey}` },
      body,
      opts.signal,
    );

    for await (const evt of readSse(stream)) {
      if (evt.data === '[DONE]') break;
      let json: any;
      try {
        json = JSON.parse(evt.data);
      } catch {
        continue;
      }

      if (json.error) {
        const msg = json.error.message ?? JSON.stringify(json.error);
        throw new Error(`供应商返回错误：${msg}`);
      }

      const chunk: StreamChunk = {};
      if (typeof json.model === 'string') chunk.responseModel = json.model;
      if (typeof json.id === 'string') chunk.responseId = json.id;
      if (json.usage) {
        chunk.usage = {
          input: json.usage.prompt_tokens,
          output: json.usage.completion_tokens,
          total: json.usage.total_tokens,
        };
      }

      const choice = json.choices?.[0];
      if (choice) {
        const d = choice.delta ?? {};
        // 标准正文
        if (typeof d.content === 'string' && d.content) chunk.delta = d.content;
        // 部分模型/中转把正文放在 reasoning_content（思考链）
        const reasoning = d.reasoning_content ?? d.reasoning;
        if (typeof reasoning === 'string' && reasoning) chunk.reasoning = reasoning;
        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
          chunk.finishReason = choice.finish_reason;
        }
      }

      if (chunk.delta || chunk.reasoning || chunk.responseModel || chunk.usage || chunk.finishReason) {
        yield chunk;
      }
    }
  },
};
