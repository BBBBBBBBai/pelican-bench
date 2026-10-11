import type { Protocol } from '@shared/types';
import type { Adapter } from './types';
import { openaiAdapter } from './openai';
import { anthropicAdapter } from './anthropic';

/**
 * 协议 → 适配器。
 *
 * 原来是 `() => import('./openai.ts')` 那样的动态 import，为的是让没被用到的
 * 协议解析器不进主包。搬进浏览器之后这条理由反过来了：两个适配器加起来不到 5 KB，
 * 而动态 import 会把它们切成独立 chunk —— 多两次额外请求，还多一个「chunk 加载失败」
 * 的失败模式（弱网下很常见）。所以改成静态导入，再包一层 async 保持调用点不变。
 *
 * `chat/types.ts` 不能 import 这两个文件（会形成 types ↔ openai 的循环），
 * 所以这一层单独放在 index 里。
 */
export const ADAPTERS: Record<Protocol, () => Promise<Adapter>> = {
  openai: async () => openaiAdapter,
  anthropic: async () => anthropicAdapter,
};

export * from './types';
