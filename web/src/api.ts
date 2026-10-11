import type {
  AppConfig,
  PromptEntry,
  ProviderProfile,
  RunEvent,
  RunRecord,
  RunRequest,
} from '@shared/types';
import { listPrompts } from '@shared/prompts';
import {
  clearAllKeys,
  coerceProvider,
  deleteApiKey,
  getApiKey,
  hasApiKey,
  keyHealth,
  readAllKeys,
  readConfig,
  readPromptPool,
  setApiKey,
  storageInfo,
  writeConfig,
} from './lib/config';
import { dbCount, STORE_RECORDS } from './lib/idb';
import {
  deleteRecord as deleteRecordRow,
  getRecord as getRecordRow,
  listRecords,
  patchRecord,
  readSidecar,
  stats as recordStats,
} from './lib/records';
import { startRun, type RunHandle } from './lib/runner';
import { applyProxy, classifyFetchError, defaultViaProxy, isHttpUrl, isProxied } from './lib/net';
import {
  downloadExport,
  importZipFile,
  migrateFromDirectory,
  type ExportOptions,
  type ExportResult,
  type ImportReport,
} from './lib/zipcodec';

/**
 * 界面与数据之间的那一道门。
 *
 * 原来它是 10 个 `fetch('/api/...')` 调用，对面是 Express 后端。后端没了之后，
 * **这一层的方法名与返回形状全部照旧** —— 界面那一万多行代码里，除了「文件位置」
 * 那一小块，一行都不用改。变的是实现：数据来自 IndexedDB，运行在同一个线程里跑。
 *
 * 唯一换掉的字段是 `paths` → `storage`：桌面版能把三个文件的绝对路径摆在界面上，
 * 浏览器里没有「文件位置」这回事，能说的只有「用了多少、上限多少、会不会被清掉」。
 */

export interface PublicProvider extends ProviderProfile {
  hasKey: boolean;
}

export interface StorageStat {
  /** 浏览器答不答应长期保留。false 就意味着「清缓存」可能连记录一起清掉 */
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
  records: number;
  /** 解不开的 Key 把数（密文在、钥匙没了）。界面据此提示重填。 */
  brokenKeys: number;
  /** 是不是真的在加密存放。false = 这个浏览器没有 WebCrypto，Key 是明文。 */
  keysEncrypted: boolean;
}

export interface PublicConfig extends Omit<AppConfig, 'providers'> {
  providers: PublicProvider[];
  storage: StorageStat;
}

export interface RecordDetail {
  record: RunRecord;
  svg: string | null;
  raw: string | null;
  reasoning: string | null;
}

export interface ProbeResult {
  ok: boolean;
  message: string;
  models?: number;
}

async function toPublic(provider: ProviderProfile): Promise<PublicProvider> {
  return { ...provider, hasKey: await hasApiKey(provider.id) };
}

async function storageStat(): Promise<StorageStat> {
  const info = await storageInfo();
  // keyHealth 顺带做一次「旧明文行 → 密文」的升级，所以读一次配置就等于体检一次。
  const keys = await keyHealth();
  return {
    ...info,
    records: await dbCount(STORE_RECORDS),
    brokenKeys: keys.broken,
    keysEncrypted: keys.encrypted,
  };
}

/** 读一份完整的对外配置：设置 + 档案 + 每家的「有没有 Key」+ 存储占用 */
async function publicConfig(): Promise<PublicConfig> {
  const cfg = await readConfig();
  const providers = await Promise.all(cfg.providers.map(toPublic));
  return { ...cfg, providers, storage: await storageStat() };
}

function newProviderId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export const api = {
  getConfig: () => publicConfig(),

  saveConfig: async (patch: Partial<AppConfig>): Promise<PublicConfig> => {
    const current = await readConfig();
    await writeConfig({ ...current, ...patch });
    return publicConfig();
  },

  addProvider: async (body: Partial<ProviderProfile> & { apiKey?: string }): Promise<PublicProvider> => {
    const cfg = await readConfig();
    const { apiKey, ...rest } = body;
    const created = coerceProvider({
      ...rest,
      id: rest.id && !cfg.providers.some((p) => p.id === rest.id) ? rest.id : newProviderId(),
      createdAt: new Date().toISOString(),
    });
    if (!created) throw new Error('供应商需要一个名字');
    await writeConfig({ ...cfg, providers: [...cfg.providers, created] });
    // 空串也能进来：那表示「不要这个 Key」，走 deleteApiKey
    if (apiKey !== undefined) await setApiKey(created.id, apiKey);
    return toPublic(created);
  },

  updateProvider: async (
    id: string,
    body: Partial<ProviderProfile> & { apiKey?: string },
  ): Promise<PublicProvider> => {
    const cfg = await readConfig();
    const index = cfg.providers.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('找不到该供应商档案，请先在右侧添加');

    const { apiKey, ...rest } = body;
    const merged = coerceProvider({ ...cfg.providers[index], ...rest, id });
    if (!merged) throw new Error('供应商需要一个名字');

    const providers = [...cfg.providers];
    providers[index] = merged;
    await writeConfig({ ...cfg, providers });
    if (apiKey !== undefined) await setApiKey(id, apiKey);
    return toPublic(merged);
  },

  deleteProvider: async (id: string): Promise<{ ok: boolean }> => {
    const cfg = await readConfig();
    await writeConfig({ ...cfg, providers: cfg.providers.filter((p) => p.id !== id) });
    // Key 跟着档案一起走。留下的 Key 是孤儿：界面上没有它的入口，清空所有 Key 之外看不见。
    await deleteApiKey(id);
    return { ok: true };
  },

  // 界面当前没有调用它（题目是运行那一刻按 promptLang 现抽的），保留是为了不删掉
  // 一个「后端有的东西」。`promptsPath` 这个字段没有对应物了。
  getPrompts: async (): Promise<{ pool: unknown; entries: PromptEntry[]; lang: 'zh' | 'en' }> => {
    const cfg = await readConfig();
    const pool = await readPromptPool();
    return { pool, entries: listPrompts(pool, cfg.promptLang), lang: cfg.promptLang };
  },

  getRecords: async (): Promise<{
    records: RunRecord[];
    stats: { total: number; byProvider: Record<string, number>; byAnimal: Record<string, number> };
  }> => {
    const records = await listRecords();
    return { records, stats: await recordStats() };
  },

  getRecord: async (id: string): Promise<RecordDetail> => {
    const record = await getRecordRow(id);
    if (!record) throw new Error('这条记录已经不在了');
    const sidecar = await readSidecar(id);
    return {
      record,
      svg: sidecar?.svg ?? null,
      raw: sidecar?.raw ?? null,
      reasoning: sidecar?.reasoning ?? null,
    };
  },

  patchRecordFlags: async (id: string, flags: RunRecord['flags']): Promise<RunRecord> => {
    const next = await patchRecord(id, { flags });
    if (!next) throw new Error('这条记录已经不在了');
    return next;
  },

  deleteRecord: async (id: string): Promise<{ ok: boolean }> => {
    await deleteRecordRow(id);
    return { ok: true };
  },

  // ===== 下面这些是纯前端才有的东西 =====

  /**
   * 测一测这家站还活着吗、Key 对不对。
   *
   * 打 `GET {baseUrl}/v1/models`：**两家协议都支持这个端点**，而且不要钱 ——
   * Anthropic 那边也一样（不必发一次真正花钱的 messages 请求去试）。
   * 401 的正文是可以读到的（实测中转站会给「API Key 无效，请检查后重试」这种话），
   * 所以这里直接把供应商的原话端上来，比套一层自己的文案有用得多。
   */
  probeProvider: async (id: string): Promise<ProbeResult> => {
    const cfg = await readConfig();
    const profile = cfg.providers.find((p) => p.id === id);
    if (!profile) return { ok: false, message: '找不到该供应商档案' };
    // 空着和填错是两回事：手填成 `api.example.com` 的人明明看见格子里有字，
    // 却被告知「还没有填」只会以为自己点错了按钮。分开说。
    const rawBase = (profile.baseUrl ?? '').trim();
    if (!rawBase) return { ok: false, message: '还没有填服务器地址' };
    if (!isHttpUrl(rawBase)) {
      return { ok: false, message: `地址「${rawBase}」不是有效的 http(s) 地址，要以 http:// 或 https:// 开头` };
    }

    const key = await getApiKey(id);
    if (!key) return { ok: false, message: '还没有填 API Key' };

    const viaProxy = profile.viaProxy ?? defaultViaProxy(profile.baseUrl);
    const base = applyProxy(profile.baseUrl, viaProxy).replace(/\/+$/, '');
    const url = `${base}/v1/models`;

    const headers: Record<string, string> =
      profile.protocol === 'anthropic'
        ? {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          }
        : { authorization: `Bearer ${key}` };

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    } catch {
      // 只有网络层失败才需要分因；HTTP 报错本身就是一份可读的说明
      return { ok: false, message: await classifyFetchError(profile.baseUrl) };
    }

    if (res.ok) {
      let models = 0;
      try {
        const body = (await res.json()) as { data?: unknown[] };
        models = Array.isArray(body?.data) ? body.data.length : 0;
      } catch {
        /* 不是 JSON 也算通 —— 只要它答应了 */
      }
      return { ok: true, message: models ? `连上了，这个站点报了 ${models} 个模型` : '连上了', models };
    }

    const detail = await readErrorBrief(res);
    if (res.status === 404 && isProxied(profile.baseUrl, url)) {
      return { ok: false, message: `${detail || 'HTTP 404'} —— 本站没有部署代理，请关掉「经本站代理」` };
    }
    return { ok: false, message: detail || `HTTP ${res.status}` };
  },

  exportZip: async (opts: ExportOptions = {}): Promise<ExportResult> => downloadExport(opts),

  importZip: async (file: Blob): Promise<ImportReport> => importZipFile(file),

  /** 从旧版安装目录一次性迁移（不需要长期授权，选完就完） */
  migrateFromDirectory: async (files: File[]): Promise<ImportReport> => migrateFromDirectory(files),

  clearAllKeys: async (): Promise<{ ok: boolean }> => {
    await clearAllKeys();
    return { ok: true };
  },

  /** 「清空所有 Key」的确认文案里要报个数，所以得先看一眼有几把 */
  keyCount: async (): Promise<number> => Object.keys(await readAllKeys()).length,

  storageStat,
};

/** 从响应里抠出人能看懂的一句。供应商的原话优先 —— 它比我们编的准。 */
async function readErrorBrief(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    try {
      const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const inner = typeof body?.error === 'string' ? body.error : body?.error?.message;
      if (inner) return inner;
      if (body?.message) return body.message;
    } catch {
      /* 不是 JSON，直接把正文当话 */
    }
    return text.slice(0, 200);
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * 发起一次生成，用回调消费事件；返回中止函数。
 *
 * 签名与后端时代**一模一样**，连 `messages` 那两颗回调文案的位置都没动 ——
 * App.tsx 那边一行都不用改。里面不再是「POST 自己的后端读 SSE」，而是直接驱动
 * `startRun` 的异步生成器：原来穿过一条 TCP 连接的事件，现在只是同一个函数里的 yield。
 *
 * 之所以还要保留 `messages.network` / `messages.interrupted` 这两句：**这两种失败
 * 依然存在**，只是原因换了。`network` 现在指「拼 baseUrl 的那一步就炸了」，
 * `interrupted` 指生成器没走完就断了（比如页面被关掉之前那一刻）。
 */
export function runStream(
  body: RunRequest,
  onEvent: (evt: RunEvent) => void,
  onError: (message: string) => void,
  messages: { network: string; interrupted: string } = {
    network: 'Failed to fetch',
    interrupted: 'The stream ended before the run reported a result.',
  },
): () => void {
  const controller = new AbortController();
  let aborted = false;
  let settled = false;

  (async () => {
    let handle: RunHandle;
    try {
      handle = await startRun(body, controller.signal);
    } catch (err) {
      // 这一步的失败都是「话已经说清楚了」的（没选模型名、没填 Key、地址不对、
      // 找不到档案），照原样端出来。只有 TypeError 才需要换成给操作员看的那句。
      if (aborted) return;
      onError(err instanceof TypeError ? messages.network : err instanceof Error ? err.message : String(err));
      return;
    }

    // 在「解析目标 / 抽题」这段时间里用户按了中止：那时还没有 handle 可以掐。
    if (aborted) handle.abort();

    try {
      for await (const evt of handle.events) {
        if (evt.type === 'done' || evt.type === 'error') settled = true;
        onEvent(evt);
      }
      if (!settled && !aborted) onError(messages.interrupted);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || aborted) return;
      onError(err instanceof TypeError ? messages.network : err instanceof Error ? err.message : String(err));
    }
  })();

  return () => {
    aborted = true;
    controller.abort();
  };
}

export type { ExportOptions, ExportResult, ImportReport };
