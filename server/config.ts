import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';
import type { AppConfig, EffortLevel, GenParams, ProviderProfile } from '../shared/types.ts';
import { DEFAULT_MODEL_PRESETS, DEFAULT_PARAMS, EFFORT_LEVELS } from '../shared/types.ts';

/**
 * 是不是被 SEA 打进单个 exe 里跑。
 *
 * 直接问 `node:sea`，不靠猜路径 —— 打包之后 `import.meta.url` 指的是 bundle 里那个
 * 临时脚本名，不是 exe，`path.resolve(here, '..')` 会指到一个根本不存在的目录。
 */
export const PACKAGED: boolean = isSea();

/**
 * 开发模式下的项目根 = server/ 的上一级。
 *
 * 打包后 `import.meta.url` 在 CommonJS bundle 里是 undefined（esbuild 只能把 import.meta
 * 置空），`fileURLToPath` 会直接抛 ERR_INVALID_ARG_TYPE。所以这里既做成函数（打包时压根
 * 不会调用它），又留了一层兜底 —— 万一哪天开发路径也拿不到 url，退回当前工作目录，
 * 而不是让整个程序在加载配置这一行就崩掉。
 */
function devProjectRoot(): string {
  const url = import.meta.url;
  if (!url) return process.cwd();
  return path.resolve(path.dirname(fileURLToPath(url)), '..');
}

/** 项目根目录：开发时是 server/ 的上一级；打包后是 exe 所在目录（只用于诊断显示）。 */
export const PROJECT_ROOT = PACKAGED ? path.dirname(process.execPath) : devProjectRoot();

/**
 * 所有**可写**文件的家：config.json / config.local.json / prompts.json / data/。
 *
 * 开发时就是项目根，行为与从前一字不差。打包后落到 `%APPDATA%\PelicanBench` ——
 * exe 可能被丢进 Program Files 或者任何只读目录，配置和数据不能跟着它走。
 * 另外这也让「换一个 exe」和「保住已有记录」变成两件互不干扰的事。
 */
export const USER_ROOT = PACKAGED ? userDataDir() : PROJECT_ROOT;

function userDataDir(): string {
  const base =
    process.env.APPDATA ||
    (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'PelicanBench');
}

// 建目录放在模块加载时。写配置、写题池、落记录散在好几个模块里，与其要求每个
// 写入口都记得先 mkdir，不如在这里保证它一定存在（开发模式下 PROJECT_ROOT 本来就在）。
try {
  fs.mkdirSync(USER_ROOT, { recursive: true });
} catch (err) {
  console.error('[config] 建不出数据目录，后面的写入会失败：', USER_ROOT, err);
}

const CONFIG_PATH = path.join(USER_ROOT, 'config.json');
const PROMPTS_PATH = path.join(USER_ROOT, 'prompts.json');

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getPromptsPath(): string {
  return PROMPTS_PATH;
}

const DEFAULT_CONFIG: AppConfig = {
  dataDir: './data',
  promptLang: 'zh',
  timeoutSec: 120,
  retries: 1,
  defaultParams: { ...DEFAULT_PARAMS },
  providers: [],
  uiLang: 'zh',
  saveReasoning: false,
  saveRawResponse: false,
  modelPresets: [...DEFAULT_MODEL_PRESETS],
};

/** 候选清单的清洗：逐项转字符串、去首尾空白、丢掉空串、去重（保序）。
 *  和 providers 一样，坏数据只丢掉它自己，不拖垮整份配置。 */
function coercePresets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_MODEL_PRESETS];
  const out: string[] = [];
  for (const item of raw) {
    const name = typeof item === 'string' ? item.trim() : '';
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
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
 * 这是「留空 = 跟随全局默认」这条规矩的落点 —— 以前这里用 coerceParams 把每一项
 * 都填成具体数字，于是供应商永远在压着全局，改全局默认等于没改。
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

function coerceProvider(raw: unknown): ProviderProfile | null {
  const p = (raw ?? {}) as Partial<ProviderProfile>;
  // 注意：老 config.json 里可能还留着 `model` 字段（档案曾经自带模型名）。
  // 它在这里被静默丢弃 —— 模型名已经从档案搬到「每一次运行」上了。
  // 老的 `thinking` 布尔也一样被丢掉：它已经被 effort 取代。
  if (!p.name || !p.baseUrl) return null;
  return {
    id: typeof p.id === 'string' && p.id ? p.id : `p_${Math.random().toString(36).slice(2, 10)}`,
    name: String(p.name),
    protocol: p.protocol === 'anthropic' ? 'anthropic' : 'openai',
    baseUrl: String(p.baseUrl).replace(/\/+$/, ''),
    params: coercePartialParams(p.params),
    verified: Boolean(p.verified),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
  };
}

export function readConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    writeConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, providers: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Partial<AppConfig>;
    const providers = Array.isArray(raw.providers)
      ? (raw.providers.map(coerceProvider).filter(Boolean) as ProviderProfile[])
      : [];
    return {
      dataDir: typeof raw.dataDir === 'string' && raw.dataDir ? raw.dataDir : DEFAULT_CONFIG.dataDir,
      promptLang: raw.promptLang === 'en' ? 'en' : 'zh',
      timeoutSec:
        typeof raw.timeoutSec === 'number' && raw.timeoutSec > 0 ? raw.timeoutSec : DEFAULT_CONFIG.timeoutSec,
      retries:
        typeof raw.retries === 'number' && raw.retries >= 0 ? Math.floor(raw.retries) : DEFAULT_CONFIG.retries,
      defaultParams: coerceParams(raw.defaultParams),
      providers,
      uiLang: raw.uiLang === 'en' ? 'en' : 'zh',
      saveReasoning: Boolean(raw.saveReasoning),
      saveRawResponse: Boolean(raw.saveRawResponse),
      modelPresets: coercePresets(raw.modelPresets),
    };
  } catch (err) {
    console.error('[config] 读取 config.json 失败，回退默认配置：', err);
    return { ...DEFAULT_CONFIG, providers: [] };
  }
}

export function writeConfig(cfg: AppConfig): void {
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

/** 数据目录绝对路径 */
export function resolveDataDir(cfg?: AppConfig): string {
  const c = cfg ?? readConfig();
  return path.isAbsolute(c.dataDir) ? c.dataDir : path.resolve(USER_ROOT, c.dataDir);
}

/**
 * API key 不写进 config.json，单独存 config.local.json，避免误传/误同步时泄露。
 * 该文件已在 .gitignore 中。
 */
const KEYS_PATH = path.join(USER_ROOT, 'config.local.json');

type KeyMap = Record<string, string>;

function readKeys(): KeyMap {
  if (!fs.existsSync(KEYS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8')) as KeyMap;
  } catch {
    return {};
  }
}

function writeKeys(keys: KeyMap): void {
  const tmp = `${KEYS_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(keys, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, KEYS_PATH);
}

export function getApiKey(providerId: string): string {
  return readKeys()[providerId] ?? '';
}

export function setApiKey(providerId: string, apiKey: string): void {
  const keys = readKeys();
  if (apiKey) keys[providerId] = apiKey;
  else delete keys[providerId];
  writeKeys(keys);
}

export function hasApiKey(providerId: string): boolean {
  return Boolean(getApiKey(providerId));
}

export function deleteApiKey(providerId: string): void {
  setApiKey(providerId, '');
}
