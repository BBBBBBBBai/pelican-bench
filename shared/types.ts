/** 前后端共享类型定义 */

/** 支持的供应商协议 */
export type Protocol = 'openai' | 'anthropic';

/**
 * 思考强度。六档，与 ChatGPT 的档位同名 —— 这些字符串就是要发到线上的值，
 * 所以它们是数据不是文案，界面上也照原样印。
 *
 * 六档在真实负载上确实分得开（实测同一道题：minimal → max 思考字符 +61%、
 * 总输出 token +45%、耗时 +39%），但幅度温和 —— 它不是数量级开关。
 * 不发这个字段约等于 medium。
 */
export type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** 档位的固定顺序，界面上的分段按钮照这个顺序排。 */
export const EFFORT_LEVELS: EffortLevel[] = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** 一次生成用的请求参数（实际值会完整记入结果） */
export interface GenParams {
  temperature: number;
  maxTokens: number;
  topP?: number;
  /** 思考强度。它取代了旧的「是否开启思考」开关 —— 那个开关只对 Anthropic 生效，
   *  对 [OI] 兼容协议从来没有作用过。现在它由这一档统一管：越高模型想得越久。 */
  effort: EffortLevel;
}

/**
 * 供应商档案（可复用）。
 *
 * 档案只记「往哪儿发、拿什么密钥发、默认参数是什么」——**不记模型名**。
 * 模型名是每一次运行现场选的：这个工具的题目就是「同一个模型名在不同供应商
 * 名下表现如何」，所以模型名属于「这一次运行」，不属于某一家的档案。
 */
export interface ProviderProfile {
  id: string;
  /** 展示名，用于画廊分组与筛选 */
  name: string;
  protocol: Protocol;
  /** 例如 https://api.deepseek.com 或 https://api.anthropic.com */
  baseUrl: string;
  /**
   * 这家站自己覆盖的参数。**留空 = 跟随全局默认**（`AppConfig.defaultParams`）。
   *
   * 所以它是 Partial：以前这里必须存一个具体数字，于是「全局默认」这一层
   * 被每家的 8192 压着，改全局等于没改。
   */
  params: Partial<GenParams>;
  /** 该档案是否已被验证过（一次成功请求） */
  verified?: boolean;
  createdAt: string;
}

/** 本次运行的临时覆盖（会记入结果） */
export interface RunOverrides {
  params?: Partial<GenParams>;
}

export interface AppConfig {
  /** 数据目录（相对项目根或绝对路径） */
  dataDir: string;
  /** 题面语言 */
  promptLang: 'zh' | 'en';
  /** 单次请求超时（秒） */
  timeoutSec: number;
  /** 失败重试次数（0 = 不重试） */
  retries: number;
  /** 默认请求参数 */
  defaultParams: GenParams;
  /** 供应商档案 */
  providers: ProviderProfile[];
  /** 界面语言 */
  uiLang: 'zh' | 'en';
  /** 是否保存思考过程（reasoning） */
  saveReasoning: boolean;
  /** 是否保存完整原始响应 */
  saveRawResponse: boolean;
  /** 「要测哪个模型」那张候选表。用户可改，存在 config.json 里 —— 它仍然是
   *  给手用的快捷键，不是测量结果：不写进任何 record、不算异常标记、不进 data/。 */
  modelPresets: string[];
}

/** 异常标签（事实性标记，不打分） */
export type FlagCode =
  | 'render-failed'
  | 'not-svg'
  | 'truncated'
  | 'model-mismatch'
  | 'http-error'
  | 'timeout'
  | 'aborted';

export interface Flag {
  code: FlagCode;
  /** 一句话说明，已按当前界面语言生成 */
  detail: string;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

/** 一条运行记录（元数据），SVG 单独存文件 */
export interface RunRecord {
  id: string;
  createdAt: string;
  /**
   * 通道号：该记录在所属机架（= 当天）内的永久序号，从 1 开始。
   * 它出现在缩略图、详情与截图里，用来指认某一次运行，不随筛选或排序变化。
   * 由 server/storage.ts 在落盘时分配；老记录缺失时在读取时回填。
   */
  channel?: number | null;
  /** 供应商档案 id；临时运行可能没有 */
  providerId: string | null;
  /** 供应商展示名（快照，档案改名不影响历史） */
  providerName: string;
  protocol: Protocol;
  baseUrl: string;
  /** 请求时指定的模型名 */
  requestedModel: string;
  /** 响应体里回显的模型名，可能为空 */
  responseModel: string | null;
  /** 响应 id */
  responseId: string | null;
  /** 本次实际使用的参数 */
  params: GenParams;
  /** 随机抽到的题目 */
  promptId: string;
  promptLabel: string;
  promptText: string;
  /** 是否为临时覆盖运行（档案 + 本次临时覆盖） */
  usedOverrides: boolean;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 实际尝试次数（含重试） */
  attempts: number;
  usage: TokenUsage | null;
  finishReason: string | null;
  flags: Flag[];
  /** 是否成功拿到 SVG */
  ok: boolean;
  /** 是否被手动中止 */
  aborted: boolean;
  /** 是否保存了 SVG 文件 */
  hasSvg: boolean;
  /** SVG 文件相对路径（相对数据目录） */
  svgPath: string | null;
  /** 完整原始输出的相对路径（开启 saveRawResponse 时存在） */
  rawPath?: string | null;
  /** 思考过程的相对路径（开启 saveReasoning 时存在） */
  reasoningPath?: string | null;
  /** 原始输出字符数 */
  rawLength: number;
  /** 错误信息（失败时） */
  error: string | null;
}

/** 列表页用的轻量记录 */
export type RunRecordSummary = Omit<RunRecord, 'promptText'> & { promptText: string };

export interface PromptEntry {
  id: string;
  label: string;
  text: string;
}

export interface PromptPool {
  animals: string[];
  template: string;
  templateEn: string;
  extras: PromptEntry[];
}

/** 运行请求 */
export interface RunRequest {
  providerId?: string;
  /** 临时供应商（不落档，直接用一次） */
  inline?: {
    name: string;
    protocol: Protocol;
    baseUrl: string;
    apiKey: string;
  };
  /**
   * 本次运行的被测模型名。必填 —— 没有它就不知道该把题目发给谁，
   * 所以服务端会拒绝，前端也不让按「开始生成」。
   */
  model?: string;
  overrides?: RunOverrides;
  /** 指定题目 id（不传则随机） */
  promptId?: string;
  /** 手动指定题面（配合 promptId='manual'） */
  manualPrompt?: string;
}

/** SSE 事件 */
export type RunEvent =
  | { type: 'start'; runId: string; prompt: PromptEntry; providerName: string; model: string; params: GenParams; attempt: number }
  | { type: 'delta'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'retry'; attempt: number; reason: string }
  | { type: 'done'; record: RunRecord }
  | { type: 'error'; message: string };

/**
 * 全局默认参数。它是参数的三层（全局默认 → 供应商覆盖 → 本次运行覆盖）里最底下那层，
 * 也是 config.json 里 `defaultParams` 的播种值。
 *
 * maxTokens 32000 不是「算出来的」而是「当作放开用」：这个工具自己一个 token 都不数，
 * 它把 max_tokens 原样交给供应商；而 [OI] 兼容协议里这**一个**数同时管思考链和正文，
 * 8192 会在模型还在想的时候就把额度用光 —— 实测有两条记录 8192 全花在思考上、
 * 正文一个字都没吐出来。32000 是给思考留出余量，不是精确值。
 */
export const DEFAULT_PARAMS: GenParams = {
  temperature: 1,
  maxTokens: 32000,
  effort: 'high',
};

/** 「要测哪个模型」那张候选表的出厂内容。它只是给手用的快捷键，不是测量结果 ——
 *  用户可以在全局设置里改，改完存进 config.json；改空了也不影响任何一次运行。 */
export const DEFAULT_MODEL_PRESETS: string[] = [
  'gpt-6.1-sol',
  'gpt-6.1',
  'gpt-5.2-turbo',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805',
  'deepseek-v3.2-reasoner-preview',
  'gemini-2.5-pro',
  'qwen3-max',
  'glm-4.6',
  'kimi-k2-0905-preview',
];
