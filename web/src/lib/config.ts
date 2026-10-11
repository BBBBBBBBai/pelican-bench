import type { AppConfig, EffortLevel, GenParams, PromptEntry, PromptPool, ProviderProfile } from '@shared/types';
import { DEFAULT_MODEL_PRESETS, DEFAULT_PARAMS, EFFORT_LEVELS } from '@shared/types';
import { DEFAULT_PROMPTS } from '@shared/prompts';
import { STORE_CONFIG, STORE_KEYS, dbClear, dbDelete, dbGet, dbGetAll, dbPut, storageInfo } from './idb';
import {
  VaultError,
  decryptKey,
  dropVault,
  encryptKey,
  isSecretRow,
  vaultSupported,
  type KeyRow,
} from './keyvault';

/**
 * 设置 / Key / 题池的读写。
 *
 * 对应原来的 `server/config.ts` + `server/prompts.ts` 里的文件那一半。三个东西
 * 在浏览器里都变成了 IndexedDB 里的对象，但**清洗规则一字未改** —— 那些 coerce
 * 函数才是这个模块真正的价值：老 config.json 里可能留着 `model` / `thinking` 这类
 * 已经作废的字段，坏数据只该丢掉它自己。
 */

const CONFIG_ROW = 'config';
const PROMPTS_ROW = 'prompts';

export const DEFAULT_CONFIG: AppConfig = {
  dataDir: './data',
  promptLang: 'zh',
  // 300 而不是 120：实测一次 high effort 的正文 + 思考能跑到 146 秒，
  // 120 秒会把「模型其实画出来了」的那一趟掐掉。改小是用户自己的自由。
  timeoutSec: 300,
  retries: 1,
  defaultParams: { ...DEFAULT_PARAMS },
  providers: [],
  uiLang: 'zh',
  saveReasoning: false,
  saveRawResponse: false,
  modelPresets: [...DEFAULT_MODEL_PRESETS],
};

/** 候选清单的清洗：逐项转字符串、去首尾空白、丢掉空串、去重（保序）。 */
function coercePresets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_MODEL_PRESETS];
  const out: string[] = [];
  for (const item of raw) {
    const name = typeof item === 'string' ? item.trim() : '';
    if (name && !out.includes(name)) out.push(name);
  }
  return out.length ? out : [...DEFAULT_MODEL_PRESETS];
}

/** 档位白名单。认不出来的值一律退回默认，绝不原样透传到线上。 */
function coerceEffort(raw: unknown): EffortLevel {
  return EFFORT_LEVELS.includes(raw as EffortLevel) ? (raw as EffortLevel) : DEFAULT_PARAMS.effort;
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 全局默认那一层：字段必须齐 —— 它是三层参数里最底下的兜底。 */
function coerceParams(raw: unknown): GenParams {
  const p = (raw ?? {}) as Partial<GenParams>;
  return {
    temperature: numOr(p.temperature, DEFAULT_PARAMS.temperature),
    maxTokens: Math.max(1, Math.floor(numOr(p.maxTokens, DEFAULT_PARAMS.maxTokens))),
    effort: coerceEffort(p.effort),
    ...(typeof p.topP === 'number' ? { topP: p.topP } : {}),
  };
}

/**
 * 供应商那一层：**只保留用户真写了的那几项**，没写的留空。
 *
 * 这是「留空 = 跟随全局默认」这条规矩的落点 —— 逐项都填成具体数字的话，
 * 供应商就永远在压着全局，改全局默认等于没改。
 */
function coercePartialParams(raw: unknown): Partial<GenParams> {
  const p = (raw ?? {}) as Partial<GenParams>;
  const out: Partial<GenParams> = {};
  if (typeof p.temperature === 'number' && Number.isFinite(p.temperature)) out.temperature = p.temperature;
  if (typeof p.maxTokens === 'number' && Number.isFinite(p.maxTokens)) {
    out.maxTokens = Math.max(1, Math.floor(p.maxTokens));
  }
  if (typeof p.topP === 'number' && Number.isFinite(p.topP)) out.topP = p.topP;
  if (p.effort !== undefined) out.effort = coerceEffort(p.effort);
  return out;
}

/**
 * 注意：老 config.json 里可能还留着 `model` 字段（档案曾经自带模型名），
 * 这里静默丢弃 —— 模型名已经从档案搬到「每一次运行」上了。老的 `thinking`
 * 布尔也一样被丢掉：它已经被 effort 取代。
 *
 * 与桌面版的唯一差别：**这里不再要求 baseUrl 非空**。迁移旧数据时，
 * 会有几个 Key 找不到对应的供应商档案（config.local.json 里有、config.json 的
 * providers 里没有），我们给它们建的就是「名字有、地址待补」的占位档案。
 * 桌面版那种「缺 baseUrl 就整条丢掉」的规矩会把 Key 变成永远看不见的孤儿，
 * 所以改由运行前的校验来挡（见 `web/src/lib/runner.ts` 的 resolveTarget）。
 */
export function coerceProvider(raw: unknown): ProviderProfile | null {
  const p = (raw ?? {}) as Partial<ProviderProfile>;
  if (!p.name) return null;
  const provider: ProviderProfile = {
    id: typeof p.id === 'string' && p.id ? p.id : `p_${Math.random().toString(36).slice(2, 10)}`,
    name: String(p.name),
    protocol: p.protocol === 'anthropic' ? 'anthropic' : 'openai',
    baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl.trim().replace(/\/+$/, '') : '',
    params: coercePartialParams(p.params),
    verified: Boolean(p.verified),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
  };
  if (typeof p.viaProxy === 'boolean') provider.viaProxy = p.viaProxy;
  return provider;
}

/** 整份配置的清洗。旧文件、被手改坏的文件、导入来的文件都走这条路。 */
export function coerceConfig(raw: unknown): AppConfig {
  const r = (raw ?? {}) as Partial<AppConfig>;
  const providers = Array.isArray(r.providers)
    ? (r.providers.map(coerceProvider).filter(Boolean) as ProviderProfile[])
    : [];
  return {
    dataDir: typeof r.dataDir === 'string' && r.dataDir ? r.dataDir : DEFAULT_CONFIG.dataDir,
    promptLang: r.promptLang === 'en' ? 'en' : 'zh',
    timeoutSec: typeof r.timeoutSec === 'number' && r.timeoutSec > 0 ? r.timeoutSec : DEFAULT_CONFIG.timeoutSec,
    retries: typeof r.retries === 'number' && r.retries >= 0 ? Math.floor(r.retries) : DEFAULT_CONFIG.retries,
    defaultParams: coerceParams(r.defaultParams),
    providers,
    uiLang: r.uiLang === 'en' ? 'en' : 'zh',
    saveReasoning: Boolean(r.saveReasoning),
    saveRawResponse: Boolean(r.saveRawResponse),
    modelPresets: coercePresets(r.modelPresets),
  };
}

export async function readConfig(): Promise<AppConfig> {
  const row = await dbGet<{ key: string; value: unknown }>(STORE_CONFIG, CONFIG_ROW);
  if (!row) return { ...DEFAULT_CONFIG, providers: [] };
  return coerceConfig(row.value);
}

export async function writeConfig(cfg: AppConfig): Promise<AppConfig> {
  const clean = coerceConfig(cfg);
  await dbPut(STORE_CONFIG, { key: CONFIG_ROW, value: clean });
  return clean;
}

/** 局部更新。界面上每一次 saveGlobal 都走这里，所以清洗只做一遍。 */
export async function saveConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readConfig();
  return writeConfig({ ...current, ...patch });
}

/**
 * 库里到底存没存过设置。
 *
 * 导入时要用这一条来决定是「整体还原」还是「只并供应商」：全新浏览器里
 * readConfig() 会返回一份默认值，跟「用户真的把每一项都设成了默认值」看起来
 * 一模一样 —— 光比较字段是分不出来的，必须问「那一行存在吗」。
 */
export async function hasStoredConfig(): Promise<boolean> {
  return Boolean(await dbGet(STORE_CONFIG, CONFIG_ROW));
}

export async function hasStoredPrompts(): Promise<boolean> {
  return Boolean(await dbGet(STORE_CONFIG, PROMPTS_ROW));
}

// ===== 题池 =====

/** 题池清洗。坏的一项只丢自己，整池永远有东西可抽。 */
export function coercePromptPool(raw: unknown): PromptPool {
  const r = (raw ?? {}) as Partial<PromptPool>;
  const animals = Array.isArray(r.animals)
    ? r.animals.filter((a): a is string => typeof a === 'string' && Boolean(a.trim()))
    : [];
  const extras = Array.isArray(r.extras)
    ? r.extras
        .filter((e): e is PromptEntry => Boolean(e && typeof e.text === 'string' && Boolean(e.text.trim())))
        .map((e, i) => ({
          id: e.id || `extra-${i}`,
          label: e.label || e.id || `额外题目 ${i + 1}`,
          text: e.text,
        }))
    : [];
  return {
    animals: animals.length ? animals : [...DEFAULT_PROMPTS.animals],
    template: typeof r.template === 'string' && r.template ? r.template : DEFAULT_PROMPTS.template,
    templateEn: typeof r.templateEn === 'string' && r.templateEn ? r.templateEn : DEFAULT_PROMPTS.templateEn,
    extras: extras.length ? extras : DEFAULT_PROMPTS.extras.map((e) => ({ ...e })),
  };
}

export async function readPromptPool(): Promise<PromptPool> {
  const row = await dbGet<{ key: string; value: unknown }>(STORE_CONFIG, PROMPTS_ROW);
  if (!row) return coercePromptPool(DEFAULT_PROMPTS);
  return coercePromptPool(row.value);
}

export async function writePromptPool(pool: unknown): Promise<PromptPool> {
  const clean = coercePromptPool(pool);
  await dbPut(STORE_CONFIG, { key: PROMPTS_ROW, value: clean });
  return clean;
}

// ===== API Key =====

/**
 * Key 单独一张表，而且**存的是密文**（加解密与理由都在 keyvault.ts）。
 *
 * 这一层对外的签名和明文时代一模一样 —— 所以 runner / zipcodec / api 一个字都不用改。
 * 三种「不是密文」的情况各有各的走法：
 *
 *   1. 表里是旧版留下的明文行 → 读出来照用，并顺手升级成密文（用户无感）；
 *   2. 浏览器没有 WebCrypto → 退回明文，界面会直说「API Key 是明文」——
 *      不能让「加不了密」变成「用不了」；
 *   3. 密文解不开（钥匙换过、库是从别的电脑搬来的）→ 当没配（上层会照旧报
 *      「这家还没有填 API Key」），计入 `keyHealth().broken` 让界面提示重填。
 *      **绝不删行** —— 删了就真的没救了。
 */

/** 写一把 Key。有 WebCrypto 就密文，没有就明文（唯一一处明文落库的地方）。 */
async function writeRow(providerId: string, plain: string): Promise<void> {
  if (vaultSupported()) {
    await dbPut(STORE_KEYS, await encryptKey(providerId, plain));
    return;
  }
  await dbPut(STORE_KEYS, { id: providerId, key: plain });
}

/** 旧明文行 → 密文行。成功返回 true（界面那句「已加密」要靠它）。 */
async function upgradeRow(providerId: string, plain: string): Promise<boolean> {
  if (!vaultSupported()) return false;
  try {
    await dbPut(STORE_KEYS, await encryptKey(providerId, plain));
    return true;
  } catch {
    // 加密失败就继续用明文：宁可没加密，也不能让用户读不到自己的 Key。
    return false;
  }
}

/** 一行 → 明文。密文解密、明文顺手升级，解不开的当空。 */
async function readRow(row: KeyRow): Promise<string> {
  if (isSecretRow(row)) {
    try {
      return await decryptKey(row);
    } catch (err) {
      if (err instanceof VaultError) {
        console.warn(`[pelican-bench] ${err.message}`);
        return '';
      }
      throw err;
    }
  }

  const plain = typeof row.key === 'string' ? row.key : '';
  if (plain) await upgradeRow(row.id, plain);
  return plain;
}

export async function getApiKey(providerId: string): Promise<string> {
  const row = await dbGet<KeyRow>(STORE_KEYS, providerId);
  return row ? readRow(row) : '';
}

export async function hasApiKey(providerId: string): Promise<boolean> {
  return Boolean(await getApiKey(providerId));
}

export async function setApiKey(providerId: string, apiKey: string): Promise<void> {
  if (apiKey) await writeRow(providerId, apiKey);
  else await deleteApiKey(providerId);
}

export async function deleteApiKey(providerId: string): Promise<void> {
  await dbDelete(STORE_KEYS, providerId);
}

export async function readAllKeys(): Promise<Record<string, string>> {
  const rows = await dbGetAll<KeyRow>(STORE_KEYS);
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!row?.id) continue;
    const value = await readRow(row);
    if (value) out[row.id] = value;
  }
  return out;
}

export async function writeKeys(keys: Record<string, string>): Promise<void> {
  for (const [id, key] of Object.entries(keys)) {
    if (key) await writeRow(id, key);
  }
}

export async function clearAllKeys(): Promise<void> {
  await dbClear(STORE_KEYS);
  // 清空 = 「就当没存过」：钥匙柜一起清掉。这里不缓存柜子钥匙，所以另一个标签页
  // 不会用旧柜子加出一把永远解不开的密文（下次写入时自动重建柜子）。
  await dropVault();
}

export interface KeyHealth {
  /** 解不开的 Key 把数（密文还在、钥匙没了）。界面据此提示重填。 */
  broken: number;
  /** 是不是真的在加密存放。false = 这个浏览器没有 WebCrypto，走的是明文。 */
  encrypted: boolean;
}

/**
 * 「本地存储」那一块要看到的两件事。顺手把旧明文行升级掉 —— 也就是说，
 * 打开设置面板这一次点击本身就会把老数据搬进密文，不用等用户去动哪把 Key。
 */
export async function keyHealth(): Promise<KeyHealth> {
  const rows = await dbGetAll<KeyRow>(STORE_KEYS);
  let broken = 0;
  let allSecret = true;

  for (const row of rows) {
    if (!row?.id) continue;

    if (isSecretRow(row)) {
      try {
        await decryptKey(row);
      } catch {
        broken += 1;
      }
      continue;
    }

    const plain = typeof row.key === 'string' ? row.key : '';
    if (!plain) continue; // 空行没什么可保护的，不参与判定
    if (!(await upgradeRow(row.id, plain))) allSecret = false;
  }

  return { broken, encrypted: vaultSupported() && allSecret };
}

export { storageInfo };
