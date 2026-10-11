import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ProviderProfile, RunRecord } from '@shared/types';
import {
  coerceConfig,
  hasStoredConfig,
  hasStoredPrompts,
  readAllKeys,
  readConfig,
  readPromptPool,
  writeConfig,
  writeKeys,
  writePromptPool,
} from './config';
import { dayOf, listRecords, listSidecars, putRecordRaw, sidecarPath } from './records';
import type { Sidecar, SidecarExt } from './records';

/**
 * 导出 / 导入 / 从旧版本迁移，共用一个 codec。
 *
 * # 为什么导出坚持旧版的目录布局
 *
 * 抽出来的 zip 解开就是老 exe 的数据目录：
 *
 *   config.json
 *   prompts.json
 *   config.local.json          （只在勾选「包含 API Key」时）
 *   data/records/<YYYY-MM-DD>/<id>.json
 *   data/records/<YYYY-MM-DD>/<id>.svg
 *   data/records/<YYYY-MM-DD>/<id>.raw.txt
 *   data/records/<YYYY-MM-DD>/<id>.reasoning.txt
 *
 * 这不是为了好看，是因为 `RunRecord.svgPath` 这类字段**照旧写着
 * `records/<day>/<id>.svg`**（见 records.ts）。导出时只要在它前面加一个 `data/`
 * 就是 zip 条目名，导入时去掉前缀就是逻辑键 —— 新旧两版目录布局完全一致，
 * 中间一行转换代码都没有。于是：老 exe 的记录能原样搬进来，这边导出的 zip
 * 也能被老 exe 直接读 —— 两种实现互为备份，谁都不必知道对方存在。
 *
 * # 为什么这份 zip 不是「格式」
 *
 * 它就是一堆文件。哪天想换成 WebDAV / S3 同步，同步的还是这些字节，
 * 只是不再经过 `<a download>`。所以这里刻意没有清单文件、没有版本号字段。
 */

export interface ExportOptions {
  /** 默认 **不含** —— 导出物很可能被扔进网盘或者发给别人 */
  includeKeys?: boolean;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  records: number;
  providers: number;
  keys: number;
  bytes: number;
}

export interface ImportReport {
  /** 新写入的记录 */
  recordsNew: number;
  /** 覆盖了已有记录的条数 */
  recordsUpdated: number;
  /** 只有 json 没有 svg 正文的记录（标本页会空） */
  recordsWithoutSvg: number;
  providers: number;
  keys: number;
  /** 只有 Key、没有档案的那些：给它们建了占位档案，名字列在这 */
  orphans: string[];
  settings: boolean;
  prompts: boolean;
  warnings: string[];
}

const ZIP_MIME = 'application/zip';

// ===== 导出 =====

function stamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}`;
}

export function suggestedFilename(now: Date = new Date()): string {
  return `pelican-bench-${stamp(now)}.zip`;
}

/**
 * 把整个库打成一个 zip。
 *
 * 注意 `config.json` 里**永远没有 Key** —— 这是老版就定下的规矩
 * （Key 住 config.local.json，为的是别被误传）。这里沿用：Key 单独放一个文件，
 * 而且要用户显式勾选。
 */
export async function buildExportZip(opts: ExportOptions = {}): Promise<ExportResult> {
  const cfg = await readConfig();
  const pool = await readPromptPool();
  const records = await listRecords();
  const sidecars = await listSidecars();
  const byId = new Map(sidecars.map((s) => [s.id, s]));

  const files: Record<string, Uint8Array> = {};

  // 设置里不含 Key，直接整份写
  files['config.json'] = strToU8(`${JSON.stringify(cfg, null, 2)}\n`);
  files['prompts.json'] = strToU8(`${JSON.stringify(pool, null, 2)}\n`);

  let keys = 0;
  if (opts.includeKeys) {
    const all = await readAllKeys();
    if (Object.keys(all).length) {
      files['config.local.json'] = strToU8(`${JSON.stringify(all, null, 2)}\n`);
      keys = Object.keys(all).length;
    }
  }

  for (const r of records) {
    const dir = `data/records/${dayOf(r.createdAt)}`;
    files[`${dir}/${r.id}.json`] = strToU8(`${JSON.stringify(r, null, 2)}\n`);

    const side = byId.get(r.id);
    if (!side) continue;
    const put = (ext: SidecarExt, body: string | undefined) => {
      if (body) files[`data/${sidecarPath(r.id, r.createdAt, ext)}`] = strToU8(body);
    };
    put('.svg', side.svg);
    put('.raw.txt', side.raw);
    put('.reasoning.txt', side.reasoning);
  }

  const bytes = zipSync(files, { level: 6 });
  // Blob 想要 BlobPart，Uint8Array 的 ArrayBufferLike 泛型在这里对不上，直接给它的 buffer 切片
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return {
    blob: new Blob([buf], { type: ZIP_MIME }),
    filename: suggestedFilename(),
    records: records.length,
    providers: cfg.providers.length,
    keys,
    bytes: bytes.byteLength,
  };
}

/** 落盘。file:// 与 https 下都走 `<a download>` —— 探针实测这两种上下文都能落盘。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 立刻 revoke 会让部分浏览器来不及开始下载，给一秒
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadExport(opts: ExportOptions = {}): Promise<ExportResult> {
  const result = await buildExportZip(opts);
  downloadBlob(result.blob, result.filename);
  return result;
}

// ===== 读进来 =====

const SIDE_EXT: SidecarExt[] = ['.svg', '.raw.txt', '.reasoning.txt'];

function isRecord(v: unknown): v is RunRecord {
  const r = v as Partial<RunRecord> | null;
  return Boolean(r && typeof r.id === 'string' && typeof r.createdAt === 'string');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * 把路径统一成「相对数据根」。
 *
 * 两个来源的路径形状不一样：zip 条目本来就是 `config.json` / `data/...`，
 * 而 `<input webkitdirectory>` 给的 `webkitRelativePath` 是
 * `鹈鹕测试工具/config.json` / `鹈鹕测试工具/data/records/...`。用户选中的那层
 * 目录名要剥掉，否则后面谁也认不出来。
 */
function normalizePaths(paths: string[]): Map<string, string> {
  const cleaned = paths.map((p) => p.replace(/\\/g, '/').replace(/^\.\//, '')).filter((p) => p && !p.endsWith('/'));
  const out = new Map<string, string>(); // 归一化路径 → 原始路径

  if (cleaned.length === 0) return out;

  /**
   * 有几种「顶层目录名」不是用户随手起的项目名，而是数据结构本身：
   *
   *   - 他选了 `data` 目录 → `data/records/…`
   *   - 他选了 `records` 目录 → `records/…`
   *
   * 这两种正好是下面那两条记录路径正则认的形状。如果把这一层也当项目名剥掉，
   * 剩下的 `2026-10-06/xxx.json` 谁都认不出来 —— 记录会一条都找不到，
   * 而报告只会说「没有找到任何记录文件」，看不出是路径被剥多了一层。
   */
  const STRUCTURAL_ROOTS = new Set(['data', 'records']);

  const heads = new Set(cleaned.map((p) => p.split('/')[0]));
  const head = heads.size === 1 ? [...heads][0] : '';
  const strip =
    head && !STRUCTURAL_ROOTS.has(head) && cleaned.every((p) => p.includes('/')) ? `${head}/` : '';

  for (const p of cleaned) {
    const rel = strip && p.startsWith(strip) ? p.slice(strip.length) : p;
    out.set(rel, p);
  }
  return out;
}

interface Collected {
  configRaw: unknown;
  configFound: boolean;
  promptsRaw: unknown;
  promptsFound: boolean;
  keysRaw: Record<string, string>;
  records: { record: RunRecord; sidecar: Sidecar }[];
  /** 记录 json 的条数（含解析失败的） */
  recordFiles: number;
  warnings: string[];
}

/**
 * 从一堆「路径 → 内容」里把四类东西挖出来。
 *
 * 路径写法上特意宽容：`data/records/**` 找不到时再试 `records/**`，
 * 因为用户完全可能直接把 `data` 目录拖进来。
 */
export function collectFiles(map: Map<string, Uint8Array>): Collected {
  const out: Collected = {
    configRaw: null,
    configFound: false,
    promptsRaw: null,
    promptsFound: false,
    keysRaw: {},
    records: [],
    recordFiles: 0,
    warnings: [],
  };

  const paths = normalizePaths([...map.keys()]);
  const read = (rel: string): Uint8Array | null => {
    const orig = paths.get(rel);
    return orig ? (map.get(orig) ?? null) : null;
  };

  const configBytes = read('config.json');
  if (configBytes) {
    out.configRaw = parseJson(strFromU8(configBytes));
    out.configFound = out.configRaw !== null;
    if (!out.configFound) out.warnings.push('config.json 不是合法 JSON，已跳过');
  }

  const promptsBytes = read('prompts.json');
  if (promptsBytes) {
    out.promptsRaw = parseJson(strFromU8(promptsBytes));
    out.promptsFound = out.promptsRaw !== null;
    if (!out.promptsFound) out.warnings.push('prompts.json 不是合法 JSON，已跳过');
  }

  const keyBytes = read('config.local.json');
  if (keyBytes) {
    const raw = parseJson(strFromU8(keyBytes));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [id, key] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof key === 'string' && key) out.keysRaw[id] = key;
      }
    } else {
      out.warnings.push('config.local.json 不是「Key → 值」的对象，已跳过');
    }
  }

  // 记录文件：先认 data/records，再退到 records
  const recordEntries = [...paths.entries()].filter(([rel]) => /^(data\/)?records\/.+\.json$/.test(rel));
  const byId = new Map<string, { record: RunRecord; sidecar: Sidecar }>();

  for (const [rel, orig] of recordEntries) {
    out.recordFiles += 1;
    const bytes = map.get(orig);
    if (!bytes) continue;
    const parsed = parseJson(strFromU8(bytes));
    if (!isRecord(parsed)) {
      out.warnings.push(`${rel} 不是一条记录，已跳过`);
      continue;
    }
    byId.set(parsed.id, { record: parsed, sidecar: { id: parsed.id } });
  }

  // 侧车：同一目录下的同名文件
  for (const [rel, orig] of paths.entries()) {
    const ext = SIDE_EXT.find((e) => rel.endsWith(e));
    if (!ext) continue;
    if (!/^(data\/)?records\//.test(rel)) continue;
    const base = rel.slice(rel.lastIndexOf('/') + 1, rel.length - ext.length);
    const hit = byId.get(base);
    if (!hit) {
      out.warnings.push(`${rel} 找不到对应的记录，已跳过`);
      continue;
    }
    const body = strFromU8(map.get(orig) as Uint8Array);
    if (ext === '.svg') hit.sidecar.svg = body;
    else if (ext === '.raw.txt') hit.sidecar.raw = body;
    else hit.sidecar.reasoning = body;
  }

  out.records = [...byId.values()];
  return out;
}

async function applyImport(collected: Collected): Promise<ImportReport> {
  const report: ImportReport = {
    recordsNew: 0,
    recordsUpdated: 0,
    recordsWithoutSvg: 0,
    providers: 0,
    keys: 0,
    orphans: [],
    settings: false,
    prompts: false,
    warnings: [...collected.warnings],
  };

  // ---- 设置与题池：**只补空**。库里已经有设置的用户不该被一次导入改掉自己的偏好；
  //      而在全新浏览器里导入备份时，「那一行不存在」—— 于是这里就是完整还原。
  //      判断依据是「存过没有」而不是「值等于默认值吗」：这两件事在界面上分不出来。
  const freshConfig = !(await hasStoredConfig());
  if (collected.configFound) {
    const incoming = coerceConfig(collected.configRaw);
    if (freshConfig) {
      await writeConfig(incoming);
      report.settings = true;
    } else {
      // 只并供应商：按 id 覆盖，其余留着
      const existingCfg = await readConfig();
      const merged = new Map(existingCfg.providers.map((p) => [p.id, p]));
      for (const p of incoming.providers) merged.set(p.id, p);
      await writeConfig({ ...existingCfg, providers: [...merged.values()] });
      report.settings = incoming.providers.length > 0;
    }
  }

  if (collected.promptsFound && !(await hasStoredPrompts())) {
    await writePromptPool(collected.promptsRaw);
    report.prompts = true;
  }

  // ---- Key：写入不删。已有同 id 的 Key 会被覆盖 —— 备份的意义就在这。
  const keyIds = Object.keys(collected.keysRaw);
  if (keyIds.length) {
    await writeKeys(collected.keysRaw);
    report.keys = keyIds.length;
  }

  // ---- 孤儿 Key：config.local.json 里有、providers 里没有的那些（用户那台机器上真实存在
  //      这个情况：7 个 Key 没有对应档案）。桌面版没有这一套，因为它的 config.json
  //      和 config.local.json 是同一个进程写的、不会分家。
  //
  //      但「没档案」分两种，得区别对待：
  //        1. 只要跑过，记录里就留着 providerId + providerName + protocol + baseUrl 四件套 ——
  //           档案可以从记录里**原样还原**出来（那台机器上的 a6 / banban 就是这么救回来的：
  //           config.json 的 providers 已经空了，记录还在）。
  //        2. 一次都没用过、也没有记录的，才真的无从得知地址 —— 建「待认领」占位档案，
  //           用户在界面上补个地址就能用；否则这些 Key 在界面上永远不出现。
  const cfgNow = await readConfig();
  const known = new Set(cfgNow.providers.map((p) => p.id));

  const fromRecords = new Map<string, RunRecord>();
  for (const { record } of collected.records) {
    const id = record.providerId;
    if (!id || known.has(id) || fromRecords.has(id)) continue;
    if (record.baseUrl) fromRecords.set(id, record);
  }

  const added: ProviderProfile[] = [];
  let orphanIdx = cfgNow.providers.filter((p) => !p.baseUrl).length;
  for (const id of keyIds) {
    if (known.has(id)) continue;
    known.add(id);

    const src = fromRecords.get(id);
    if (src) {
      added.push({
        id,
        name: src.providerName || id,
        protocol: src.protocol ?? 'openai',
        baseUrl: src.baseUrl,
        params: {},
        verified: false,
        createdAt: src.createdAt || new Date().toISOString(),
      });
      continue;
    }

    orphanIdx += 1;
    const name = `待认领的 Key ${orphanIdx}`;
    added.push({
      id,
      name,
      protocol: 'openai',
      baseUrl: '',
      params: {},
      verified: false,
      createdAt: new Date().toISOString(),
    });
    report.orphans.push(name);
  }
  if (added.length) {
    await writeConfig({ ...cfgNow, providers: [...cfgNow.providers, ...added] });
  }
  report.providers = cfgNow.providers.length + added.length;

  // ---- 记录：按 id upsert，**不删已有的**。
  //      「导入一份三天前的备份」不该把今天新跑的东西抹掉。
  const existing = new Set((await listRecords()).map((r) => r.id));
  for (const { record, sidecar } of collected.records) {
    const hasSvg = Boolean(sidecar.svg);
    const fresh: RunRecord = {
      ...record,
      hasSvg,
      svgPath: hasSvg ? sidecarPath(record.id, record.createdAt, '.svg') : (record.svgPath ?? null),
      rawPath: sidecar.raw ? sidecarPath(record.id, record.createdAt, '.raw.txt') : (record.rawPath ?? null),
      reasoningPath: sidecar.reasoning
        ? sidecarPath(record.id, record.createdAt, '.reasoning.txt')
        : (record.reasoningPath ?? null),
    };
    await putRecordRaw(fresh, sidecar.svg || sidecar.raw || sidecar.reasoning ? sidecar : null);
    if (existing.has(record.id)) report.recordsUpdated += 1;
    else report.recordsNew += 1;
    // 记录自己说「我有 SVG」，但这份备份里没有对应的 .svg 文件 —— 标本页会是一片空白。
    // 说清楚比让用户对着空白页自己猜要好。
    if (record.hasSvg && !hasSvg) report.recordsWithoutSvg += 1;
  }

  if (collected.recordFiles > 0 && collected.records.length === 0) {
    report.warnings.push('没有找到任何记录文件（期望 data/records/<日期>/<id>.json）');
  }
  return report;
}

/** 从 zip 导入。zip 里的路径就是导出时的路径。 */
export async function importZip(bytes: Uint8Array): Promise<ImportReport> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('这个文件不是有效的 zip（或者已经损坏）');
  }

  const map = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(files)) {
    if (!data) continue;
    map.set(name, data);
  }
  if (map.size === 0) throw new Error('这个 zip 是空的');

  const collected = collectFiles(map);
  return applyImport(collected);
}

export async function importZipFile(file: Blob): Promise<ImportReport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importZip(bytes);
}

/**
 * 从旧版本的数据目录迁移。
 *
 * 用 `<input type="file" webkitdirectory>` 拿到的 `FileList` —— 每一层目录都能读到，
 * 但**浏览器不会给长期授权**，所以这是一次性的：选完目录、读一遍、写进 IndexedDB，
 * 之后跟那个目录再无关系。这正好：不用维护句柄，也不用担心用户挪走了目录。
 */
export async function migrateFromDirectory(files: File[]): Promise<ImportReport> {
  const map = new Map<string, Uint8Array>();
  await Promise.all(
    files.map(async (file) => {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      // 只读这几类，别把图标、exe、node_modules 也读进内存
      if (!/\.(json|svg|txt)$/i.test(rel)) return;
      if (/node_modules|\.git\//.test(rel)) return;
      map.set(rel, new Uint8Array(await file.arrayBuffer()));
    }),
  );

  if (map.size === 0) {
    throw new Error('这个目录里没有找到 config.json / prompts.json / data/records —— 请选择项目根目录');
  }

  const collected = collectFiles(map);
  if (!collected.configFound && !collected.promptsFound && collected.records.length === 0) {
    throw new Error('这个目录里没有找到 config.json / prompts.json / data/records —— 请选择项目根目录');
  }

  return applyImport(collected);
}

export type { Sidecar };
export { sidecarPath };
