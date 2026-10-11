import type {
  Flag,
  GenParams,
  PromptEntry,
  Protocol,
  RunEvent,
  RunRecord,
  RunRequest,
} from '@shared/types';
import { extractSvg, looksTruncated } from '@shared/svg';
import { pickPrompt } from '@shared/prompts';
import { ADAPTERS, HttpError } from './chat';
import type { ChatMessage } from './chat';
import { getApiKey, readConfig, readPromptPool } from './config';
import { newId, saveRun } from './records';
import { applyProxy, classifyFetchError, defaultViaProxy, isHttpUrl, isProxied } from './net';

/**
 * 一次生成的完整流程。
 *
 * 从 `server/runner.ts` 逐字搬来 —— 那个文件里没有一个 `node:`，全是 fetch /
 * ReadableStream / TextDecoder / AbortController / setTimeout，本来就是浏览器 API。
 * 真正要改的只有「四个依赖」：readConfig、getApiKey、pickPrompt、newId/saveRun，
 * 它们现在都从 IndexedDB 来，于是整条流程从同步变异步。
 *
 * **除异步化之外，下面这些一行都没动**，因为它们是这个工具测出来的东西：
 * 三层参数合成、六个标签的判定、`ok` 的定义、重试的指数退避、抽题的兜底顺序。
 */

export interface ResolvedTarget {
  providerId: string | null;
  providerName: string;
  protocol: Protocol;
  /** 用户填的原始地址。进记录、进报错 —— 用户看的就是这个。 */
  baseUrl: string;
  /** 实际打到线上的地址。走同源代理时是一个 `/api-proxy/...` 相对路径。 */
  requestBaseUrl: string;
  apiKey: string;
  model: string;
  params: GenParams;
  usedOverrides: boolean;
}

export class RunError extends Error {}

/** 把「档案 + 本次模型名 + 本次临时覆盖」解析成一次真实请求的目标 */
export async function resolveTarget(req: RunRequest): Promise<ResolvedTarget> {
  const cfg = await readConfig();

  // 模型名是每一次运行现场选的，档案里不再有默认值可退。没有它就没有收件人。
  const model = String(req.model ?? '').trim();
  if (!model) throw new RunError('还没有选择模型名');

  if (req.inline) {
    if (!req.inline.baseUrl) {
      throw new RunError('临时供应商缺少 baseUrl');
    }
    if (!isHttpUrl(req.inline.baseUrl)) {
      throw new RunError('服务器地址必须以 http:// 或 https:// 开头');
    }
    if (!req.inline.apiKey) throw new RunError('临时供应商缺少 API Key');
    const viaProxy = defaultViaProxy(req.inline.baseUrl);
    return {
      providerId: null,
      providerName: req.inline.name || '临时供应商',
      protocol: req.inline.protocol,
      baseUrl: req.inline.baseUrl,
      requestBaseUrl: applyProxy(req.inline.baseUrl, viaProxy),
      apiKey: req.inline.apiKey,
      model,
      params: mergeParams(cfg.defaultParams, undefined, req.overrides?.params),
      usedOverrides: Boolean(req.overrides?.params),
    };
  }

  const profile = cfg.providers.find((p) => p.id === req.providerId);
  if (!profile) throw new RunError('找不到该供应商档案，请先在右侧添加');

  // 浏览器里新冒出来的失败模式之一：**相对地址**。桌面版不存在这种填法错误，
  // 而在这里它会让 POST 打到本站首页，一路演变成「输出里没有 SVG」这种错方向的诊断。
  // 迁移旧数据时还会出现「有 Key、地址待补」的占位档案（见 config.ts 的 coerceProvider）。
  if (!isHttpUrl(profile.baseUrl)) {
    throw new RunError(`供应商「${profile.name}」还没有填服务器地址（要以 http:// 或 https:// 开头）`);
  }

  const apiKey = await getApiKey(profile.id);
  if (!apiKey) throw new RunError(`供应商「${profile.name}」还没有填写 API Key`);

  return {
    providerId: profile.id,
    providerName: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    requestBaseUrl: applyProxy(profile.baseUrl, profile.viaProxy ?? defaultViaProxy(profile.baseUrl)),
    apiKey,
    model,
    params: mergeParams(cfg.defaultParams, profile.params, req.overrides?.params),
    usedOverrides: hasParamOverride(req.overrides?.params),
  };
}

/**
 * 三层参数合成：全局默认 → 供应商覆盖 → 本次运行覆盖。
 *
 * 供应商那层是 Partial（留空 = 跟随全局默认），所以这里 `??` 逐字段往下掉，
 * 掉到底一定有值 —— `base` 是 coerceParams 出来的完整 GenParams。
 * effort 也走同一条链：它虽然取代了旧的 thinking 开关，但仍是可被逐层改的普通字段。
 */
function mergeParams(base: GenParams, profile?: Partial<GenParams>, override?: Partial<GenParams>): GenParams {
  const merged: GenParams = {
    temperature: override?.temperature ?? profile?.temperature ?? base.temperature,
    maxTokens: override?.maxTokens ?? profile?.maxTokens ?? base.maxTokens,
    effort: override?.effort ?? profile?.effort ?? base.effort,
  };
  const topP = override?.topP ?? profile?.topP ?? base.topP;
  if (typeof topP === 'number') merged.topP = topP;
  return merged;
}

function hasParamOverride(o?: Partial<GenParams>): boolean {
  return Boolean(o && Object.keys(o).length > 0);
}

function buildMessages(prompt: PromptEntry): ChatMessage[] {
  return [{ role: 'user', content: prompt.text }];
}

/** 判断返回的模型名与请求的是否一致（容忍常见的日期/版本后缀） */
export function modelMatches(requested: string, returned: string | null): boolean {
  if (!returned) return true; // 供应商没回显，不冤枉它
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = norm(requested);
  const b = norm(returned);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunHandle {
  events: AsyncGenerator<RunEvent>;
  abort: () => void;
}

/**
 * 执行一次生成：随机抽题 → 流式请求 → 重试 → 打标签 → 落库。
 * 无论成功、失败还是中止，都会留下一条记录。
 */
export async function startRun(req: RunRequest, externalSignal?: AbortSignal): Promise<RunHandle> {
  const cfg = await readConfig();
  const target = await resolveTarget(req);

  const pool = await readPromptPool();
  const prompt: PromptEntry =
    req.promptId === 'manual' && req.manualPrompt?.trim()
      ? { id: 'manual', label: '手动题面', text: req.manualPrompt.trim() }
      : pickPrompt(pool, cfg.promptLang, req.promptId);

  const runId = newId();
  const createdAt = new Date().toISOString();
  const maxAttempts = Math.max(1, cfg.retries + 1);
  const timeoutMs = cfg.timeoutSec * 1000;

  let currentAbort: AbortController | null = null;
  let stopped = false;

  const abort = () => {
    stopped = true;
    currentAbort?.abort();
  };

  externalSignal?.addEventListener('abort', abort, { once: true });
  // 信号在进到这里之前就已经 aborted 了（用户按中止的那一瞬间我们还在读配置/抽题）——
  // 已经 aborted 的信号不会再触发事件，这一句是那种情况下唯一的线索。
  if (externalSignal?.aborted) stopped = true;

  async function* events(): AsyncGenerator<RunEvent> {
    const startedAt = Date.now();
    let attempts = 0;
    let text = '';
    let reasoning = '';
    let responseModel: string | null = null;
    let responseId: string | null = null;
    let usage: RunRecord['usage'] = null;
    let finishReason: string | null = null;
    let lastError: string | null = null;
    let timedOut = false;
    // 这一趟最终是「网络层失败」而不是「HTTP 报错」吗。只有前者值得再补一次
    // no-cors 探测去分清「没给 CORS 头」和「连不上」。
    let networkFailed = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attempts = attempt;
      text = '';
      reasoning = '';
      finishReason = null;
      timedOut = false;

      yield {
        type: 'start',
        runId,
        prompt,
        providerName: target.providerName,
        model: target.model,
        params: target.params,
        attempt,
      };

      const controller = new AbortController();
      currentAbort = controller;
      if (stopped) controller.abort();

      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const adapter = await ADAPTERS[target.protocol]();
        const stream = adapter.stream({
          baseUrl: target.requestBaseUrl,
          apiKey: target.apiKey,
          model: target.model,
          params: target.params,
          messages: buildMessages(prompt),
          signal: controller.signal,
        });

        for await (const chunk of stream) {
          if (chunk.responseModel) responseModel = chunk.responseModel;
          if (chunk.responseId) responseId = chunk.responseId;
          if (chunk.finishReason) finishReason = chunk.finishReason;
          if (chunk.usage) usage = { ...(usage ?? {}), ...chunk.usage };
          if (chunk.reasoning) {
            reasoning += chunk.reasoning;
            yield { type: 'reasoning', text: chunk.reasoning };
          }
          if (chunk.delta) {
            text += chunk.delta;
            yield { type: 'delta', text: chunk.delta };
          }
        }
        lastError = null;
        networkFailed = false;
        break; // 成功走完，跳出重试
      } catch (err) {
        clearTimeout(timer);
        currentAbort = null;

        if (stopped) break;

        // fetch 在「CORS 被拒 / 域名解析失败 / 端口不通 / 断网」时只抛 TypeError。
        // 这是浏览器里唯一能拿到这个信息的时机。
        networkFailed = err instanceof TypeError;

        const message =
          err instanceof HttpError
            ? `HTTP ${err.status} ${err.body.slice(0, 200)}`
            : err instanceof Error
              ? err.message
              : String(err);
        lastError = timedOut ? `请求超时（${cfg.timeoutSec}s）` : message;

        // 走了同源代理却收到 404：几乎一定是本站没部署那两条 rewrite。
        // 这句话得说清楚，否则用户会去怀疑自己的 Key。
        if (err instanceof HttpError && err.status === 404 && isProxied(target.baseUrl, target.requestBaseUrl)) {
          lastError = `${lastError}（本站没有部署代理：/api-proxy/ 没人接。关掉「经本站代理」，或改用 CORS 友好的中转站）`;
        }

        if (attempt < maxAttempts) {
          yield { type: 'retry', attempt: attempt + 1, reason: lastError };
          await sleep(Math.min(4000, 500 * 2 ** (attempt - 1)));
          continue;
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }

    const durationMs = Date.now() - startedAt;
    const raw = text;
    const extracted = extractSvg(raw);
    const flags: Flag[] = [];

    if (stopped) {
      flags.push({ code: 'aborted', detail: '已手动中止' });
    } else if (timedOut) {
      flags.push({ code: 'timeout', detail: `请求超时（${cfg.timeoutSec}s）` });
    }

    if (lastError && !stopped && !timedOut) {
      let detail = lastError;
      // 只在真的没走代理时才补探测：走了代理还失败，问题在代理链路上，
      // 再去打一次上游的 no-cors 只会得到一句正确的废话。
      if (networkFailed && target.requestBaseUrl === target.baseUrl) {
        detail = `${lastError}（${await classifyFetchError(target.baseUrl)}）`;
      }
      flags.push({ code: 'http-error', detail });
    }

    if (!extracted) {
      if (raw.trim()) flags.push({ code: 'not-svg', detail: '输出中没有找到 SVG' });
      else if (!stopped && !lastError) flags.push({ code: 'not-svg', detail: '输出为空' });
    } else if (looksTruncated(raw) || finishReason === 'length' || finishReason === 'max_tokens') {
      flags.push({
        code: 'truncated',
        detail: finishReason === 'length' || finishReason === 'max_tokens' ? '达到 max_tokens 上限' : 'SVG 未闭合',
      });
    }

    if (extracted && !modelMatches(target.model, responseModel)) {
      flags.push({
        code: 'model-mismatch',
        detail: `请求 ${target.model}，返回 ${responseModel}`,
      });
    }

    // 只要挂了任何一个标签就不算「干净成功」：
    // 换模型、截断、超时这些正是我们想抓的降智信号，不能让它们在画廊里显示成正常。
    const ok = Boolean(extracted) && flags.length === 0;

    const record: RunRecord = {
      id: runId,
      createdAt,
      providerId: target.providerId,
      providerName: target.providerName,
      protocol: target.protocol,
      baseUrl: target.baseUrl,
      requestedModel: target.model,
      responseModel,
      responseId,
      params: target.params,
      promptId: prompt.id,
      promptLabel: prompt.label,
      promptText: prompt.text,
      usedOverrides: target.usedOverrides,
      durationMs,
      attempts,
      usage,
      finishReason,
      flags,
      ok,
      aborted: stopped,
      hasSvg: false,
      svgPath: null,
      rawLength: raw.length,
      error: lastError,
    };

    const saved = await saveRun({
      record,
      svg: extracted,
      raw: cfg.saveRawResponse ? raw : null,
      reasoning: cfg.saveReasoning ? reasoning : null,
    });
    yield { type: 'done', record: saved };
  }

  return { events: events(), abort };
}
