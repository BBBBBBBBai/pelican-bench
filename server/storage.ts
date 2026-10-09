import fs from 'node:fs';
import path from 'node:path';
import type { RunRecord } from '../shared/types.ts';
import { readConfig, resolveDataDir } from './config.ts';

const RECORDS_DIR = 'records';

function dataDir(): string {
  return resolveDataDir(readConfig());
}

function recordsRoot(): string {
  return path.join(dataDir(), RECORDS_DIR);
}

function dayDir(iso: string): string {
  return path.join(recordsRoot(), iso.slice(0, 10));
}

let cache: RunRecord[] | null = null;

function invalidate(): void {
  cache = null;
}

/**
 * 分配通道号：机架就是一天，通道号是记录在当天的永久序号（从 1 开始）。
 * 删掉中间某条不会让后面的通道改号——空出来的号就空着，像机架上空着的槽位。
 */
function nextChannel(dir: string): number {
  const used = new Set<number>();
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const c = (JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as RunRecord).channel;
        if (typeof c === 'number' && c > 0) used.add(c);
      } catch {
        /* 损坏的记录不参与占号 */
      }
    }
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/** 给缺通道号的老记录按当天时间顺序回填，保证地址永远可指认 */
function backfillChannels(records: RunRecord[]): void {
  const byDay = new Map<string, RunRecord[]>();
  for (const r of records) {
    const day = r.createdAt.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(r);
    else byDay.set(day, [r]);
  }
  for (const list of byDay.values()) {
    const used = new Set<number>();
    for (const r of list) if (typeof r.channel === 'number' && r.channel > 0) used.add(r.channel);
    const missing = list
      .filter((r) => typeof r.channel !== 'number' || !(r.channel > 0))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    let n = 1;
    for (const r of missing) {
      while (used.has(n)) n += 1;
      r.channel = n;
      used.add(n);
    }
  }
}

export function newId(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}`;
  return `${stamp}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface SaveResult {
  record: RunRecord;
  /** SVG 的绝对路径，供前端通过接口读取 */
  svgAbsPath: string | null;
}

/**
 * 落盘：元数据 JSON + 独立 .svg 文件，按日期分目录。
 * 使用 .tmp + rename，避免写一半被读到。
 */
export function saveRun(input: {
  record: RunRecord;
  svg: string | null;
  raw?: string | null;
  reasoning?: string | null;
}): SaveResult {
  const dir = dayDir(input.record.createdAt);
  fs.mkdirSync(dir, { recursive: true });

  const rel = (p: string) => path.relative(dataDir(), p).split(path.sep).join('/');
  const writeSide = (ext: string, content: string): string => {
    const abs = path.join(dir, `${input.record.id}${ext}`);
    const tmp = `${abs}.tmp`;
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, abs);
    return rel(abs);
  };

  let svgAbsPath: string | null = null;
  let svgPath: string | null = null;

  if (input.svg) {
    svgAbsPath = path.join(dir, `${input.record.id}.svg`);
    const tmp = `${svgAbsPath}.tmp`;
    fs.writeFileSync(tmp, input.svg, 'utf8');
    fs.renameSync(tmp, svgAbsPath);
    svgPath = rel(svgAbsPath);
  }

  const rawPath = input.raw ? writeSide('.raw.txt', input.raw) : null;
  const reasoningPath = input.reasoning ? writeSide('.reasoning.txt', input.reasoning) : null;

  const record: RunRecord = {
    ...input.record,
    channel: nextChannel(dir),
    svgPath,
    hasSvg: Boolean(svgAbsPath),
    rawPath,
    reasoningPath,
  };
  const jsonPath = path.join(dir, `${record.id}.json`);
  const tmpJson = `${jsonPath}.tmp`;
  fs.writeFileSync(tmpJson, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpJson, jsonPath);

  invalidate();
  return { record, svgAbsPath };
}

/** 列出全部记录，按时间倒序 */
export function listRecords(): RunRecord[] {
  if (cache) return cache;
  const root = recordsRoot();
  const out: RunRecord[] = [];
  if (fs.existsSync(root)) {
    for (const day of fs.readdirSync(root)) {
      const dir = path.join(root, day);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const rec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as RunRecord;
          out.push(rec);
        } catch (err) {
          console.error(`[storage] 记录损坏，已跳过：${path.join(dir, file)}`, err);
        }
      }
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  backfillChannels(out);
  cache = out;
  return out;
}

export function getRecord(id: string): RunRecord | null {
  return listRecords().find((r) => r.id === id) ?? null;
}

/** 读取任意侧车文件（svg / raw.txt / reasoning.txt），带路径穿越防护 */
export function readSideFile(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  const root = path.resolve(dataDir());
  const abs = path.resolve(path.join(root, relPath));
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

export function readSvg(record: RunRecord): string | null {
  return readSideFile(record.svgPath);
}

export function deleteRecord(id: string): boolean {
  const rec = getRecord(id);
  if (!rec) return false;
  const dir = dayDir(rec.createdAt);
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file === `${id}.json` || file.startsWith(`${id}.`)) {
        fs.rmSync(path.join(dir, file), { force: true });
      }
    }
  }
  invalidate();
  return true;
}

/** 追加/更新一条记录（例如前端回报渲染失败） */
export function patchRecord(id: string, patch: Partial<RunRecord>): RunRecord | null {
  const rec = getRecord(id);
  if (!rec) return null;
  const next: RunRecord = { ...rec, ...patch, id: rec.id, createdAt: rec.createdAt };
  const jsonPath = path.join(dayDir(rec.createdAt), `${id}.json`);
  const tmp = `${jsonPath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, jsonPath);
  invalidate();
  return next;
}

/** 统计各供应商记录数，供界面展示 */
export function stats(): { total: number; byProvider: Record<string, number>; byAnimal: Record<string, number> } {
  const all = listRecords();
  const byProvider: Record<string, number> = {};
  const byAnimal: Record<string, number> = {};
  for (const r of all) {
    byProvider[r.providerName] = (byProvider[r.providerName] ?? 0) + 1;
    byAnimal[r.promptLabel] = (byAnimal[r.promptLabel] ?? 0) + 1;
  }
  return { total: all.length, byProvider, byAnimal };
}
