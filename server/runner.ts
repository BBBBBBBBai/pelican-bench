import type {
  Flag,
  GenParams,
  PromptEntry,
  ProviderProfile,
  RunEvent,
  RunRecord,
  RunRequest,
} from '../shared/types.ts';
import { ADAPTERS, HttpError } from './chat/types.ts';
import type { ChatMessage } from './chat/types.ts';
import { getApiKey, readConfig } from './config.ts';
import { pickPrompt } from './prompts.ts';
import { newId, saveRun } from './storage.ts';
import { extractSvg, looksTruncated } from './svg.ts';

export interface ResolvedTarget {
  providerId: string | null;
  providerName: string;
  protocol: ProviderProfile['protocol'];
  baseUrl: string;
  apiKey: string;
  model: string;
  params: GenParams;
  usedOverrides: boolean;
}

export class RunError extends Error {}

/** 把「档案 + 本次模型名 + 本次临时覆盖」解析成一次真实请求的目标 */
export function resolveTarget(req: RunRequest): ResolvedTarget {
  const cfg = readConfig();

  // 模型名是每一次运行现场选的，档案里不再有默认值可退。没有它就没有收件人。
  const model = String(req.model ?? '').trim();
  if (!model) throw new RunError('还没有选择模型名');

  if (req.inline) {
    if (!req.inline.baseUrl) {
      throw new RunError('临时供应商缺少 baseUrl');
    }
    if (!req.inline.apiKey) throw new RunError('临时供应商缺少 API Key');
    return {
      providerId: null,
      providerName: req.inline.name || '临时供应商',
      protocol: req.inline.protocol,
      baseUrl: req.inline.baseUrl,
      apiKey: req.inline.apiKey,
      model,
      params: mergeParams(cfg.defaultParams, undefined, req.overrides?.params),
      usedOverrides: Boolean(req.overrides?.params),
    };
  }

  const profile = cfg.providers.find((p) => p.id === req.providerId);
  if (!profile) throw new RunError('找不到该供应商档案，请先在右侧添加');

  const apiKey = getApiKey(profile.id);
  if (!apiKey) throw new RunError(`供应商「${profile.name}」还没有填写 API Key`);

  return {
    providerId: profile.id,
    providerName: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
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
 * 执行一次生成：随机抽题 → 流式请求 → 重试 → 打标签 → 落盘。
 * 无论成功、失败还是中止，都会留下一条记录。
 */
export function startRun(req: RunRequest, externalSignal?: AbortSignal): RunHandle {
  const cfg = readConfig();
  const target = resolveTarget(req);

  const prompt =
    req.promptId === 'manual' && req.manualPrompt?.trim()
      ? { id: 'manual', label: '手动题面', text: req.manualPrompt.trim() }
      : pickPrompt(cfg.promptLang, req.promptId);

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
          baseUrl: target.baseUrl,
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
        break; // 成功走完，跳出重试
      } catch (err) {
        clearTimeout(timer);
        currentAbort = null;

        if (stopped) break;

        const message =
          err instanceof HttpError
            ? `HTTP ${err.status} ${err.body.slice(0, 200)}`
            : err instanceof Error
              ? err.message
              : String(err);
        lastError = timedOut ? `请求超时（${cfg.timeoutSec}s）` : message;

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
      flags.push({ code: 'http-error', detail: lastError });
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

    const saved = saveRun({
      record,
      svg: extracted,
      raw: cfg.saveRawResponse ? raw : null,
      reasoning: cfg.saveReasoning ? reasoning : null,
    });
    yield { type: 'done', record: saved.record };
  }

  return { events: events(), abort };
}
