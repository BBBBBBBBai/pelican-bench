import type { GenParams, Protocol } from '../../shared/types.ts';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface StreamChunk {
  /** 正文增量 */
  delta?: string;
  /** 思考过程增量 */
  reasoning?: string;
  /** 响应体里回显的模型名 */
  responseModel?: string;
  /** 响应 id */
  responseId?: string;
  usage?: { input?: number; output?: number; total?: number };
  finishReason?: string;
}

export interface StreamOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  params: GenParams;
  messages: ChatMessage[];
  signal: AbortSignal;
}

export class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 500)}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** 逐行解析 SSE（data: {...}），处理跨 chunk 的半行 */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName: string | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);

        if (line === '') {
          eventName = undefined;
          continue;
        }
        if (line.startsWith(':')) continue; // 注释/心跳

        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const data = line.slice(5).replace(/^ /, '');
          yield { event: eventName, data };
          continue;
        }
      }
    }
    // 收尾：处理没有换行结尾的最后一行
    const tail = buffer.trim();
    if (tail.startsWith('data:')) yield { event: eventName, data: tail.slice(5).trim() };
  } finally {
    reader.releaseLock();
  }
}

export async function postStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let text = '';
    try {
      text = await res.text();
    } catch {
      text = res.statusText;
    }
    throw new HttpError(res.status, text);
  }
  return res.body;
}

export interface Adapter {
  stream(opts: StreamOptions): AsyncGenerator<StreamChunk>;
}

export const ADAPTERS: Record<Protocol, () => Promise<Adapter>> = {
  openai: async () => (await import('./openai.ts')).openaiAdapter,
  anthropic: async () => (await import('./anthropic.ts')).anthropicAdapter,
};
