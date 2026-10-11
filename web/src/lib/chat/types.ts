import type { GenParams } from '@shared/types';

/**
 * 两个协议适配器共用的类型与工具。
 *
 * 这一份是从 `server/chat/types.ts` 搬过来的，**逐字保留**：里面没有一个 `node:`，
 * 全是 fetch / ReadableStream / TextDecoder / AbortController —— 原本就是浏览器 API。
 * 唯一的改动是末尾的 `ADAPTERS` 挪去了 `./index.ts`（原来用动态 import 是为了
 * 让解析器懒加载，打进前端后那只会白白多出几个 chunk）。
 */

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

  // 新增的一道闸门。浏览器里有一个桌面版不存在的新失败模式：**相对地址**。
  // 如果 baseUrl 不是 http(s)（或者同源代理没部署、静态服务器把未知路径回落成了
  // index.html），这个 POST 会拿到自己站点的首页 —— 200、`text/html`。
  // 不拦的话它会一路走到 SSE 解析器里，最后表现成「输出中没有找到 SVG」，
  // 一个指向完全错误方向的诊断。
  const contentType = res.headers.get('content-type') ?? '';
  if (/text\/html/i.test(contentType)) {
    let peek = '';
    try {
      peek = (await res.text()).slice(0, 200);
    } catch {
      /* 读不出来就算了 */
    }
    throw new HttpError(
      res.status,
      `期望流式响应，却收到 HTML —— 这个地址不是 API 端点，或者本站没有部署代理。${peek}`,
    );
  }

  return res.body;
}

export interface Adapter {
  stream(opts: StreamOptions): AsyncGenerator<StreamChunk>;
}
