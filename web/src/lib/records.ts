import type { RunRecord } from '@shared/types';
import { STORE_RECORDS, STORE_SIDECARS, dbDeleteMany, dbGet, dbGetAll, dbPut, dbPutMany } from './idb';

/**
 * 记录的读写。
 *
 * 对应原来的 `server/storage.ts`。**三件事逐字保留**，因为它们是这个工具的语义：
 *
 *   1. `channel` 是「记录在所属机架（=当天）内的永久序号，从 1 开始」。删掉中间一条
 *      不会让后面的改号 —— 空出来的号就空着，像机架上空着的槽位。
 *   2. 缺通道号的老记录在**读取时**按当天时间顺序回填，不落盘。
 *   3. `newId()` 的形状：`YYYYMMDD-HHmmss-xxxxx`，本地时间，按天分目录要靠它。
 *
 * 变的只有存放方式：元数据进 `records` 表，svg / raw / reasoning 的正文进 `sidecars`
 * 表。但 `svgPath` 这类字段**照旧写成 `records/<day>/<id>.svg` 的相对路径** ——
 * 它现在是逻辑键而不是真实文件路径，好处是导出/导入直接拿它当 zip 里的条目名，
 * 新旧两版的目录布局一模一样，一行转换代码都不用写。
 */

export type SidecarExt = '.svg' | '.raw.txt' | '.reasoning.txt';

export interface Sidecar {
  id: string;
  svg?: string;
  raw?: string;
  reasoning?: string;
}

/** 相对数据目录（旧版语义）的逻辑路径。导出时前面加 `data/` 就是 zip 条目名。 */
export function sidecarPath(id: string, createdAt: string, ext: SidecarExt): string {
  return `records/${dayOf(createdAt)}/${id}${ext}`;
}

export function dayOf(iso: string): string {
  return String(iso).slice(0, 10);
}

export function newId(now: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 分配通道号：机架就是一天，通道号是记录在当天的永久序号（从 1 开始）。
 * 传进来的是「当天已经被占掉的号」，返回最小的空号。
 */
export function nextChannel(used: Iterable<number>): number {
  const taken = new Set<number>();
  for (const n of used) if (typeof n === 'number' && n > 0) taken.add(n);
  let n = 1;
  while (taken.has(n)) n += 1;
  return n;
}

/** 给缺通道号的老记录按当天时间顺序回填，保证地址永远可指认。原地改传入的对象。 */
export function backfillChannels(records: RunRecord[]): void {
  const byDay = new Map<string, RunRecord[]>();
  for (const r of records) {
    const day = dayOf(r.createdAt);
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

/** 从库里读出来的东西未必是记录（可能是被手改过的导出/导入产物）。 */
function looksLikeRecord(v: unknown): v is RunRecord {
  const r = v as Partial<RunRecord> | null;
  return Boolean(r && typeof r.id === 'string' && typeof r.createdAt === 'string');
}

/** 列出全部记录，按时间倒序，并回填通道号 */
export async function listRecords(): Promise<RunRecord[]> {
  const raw = await dbGetAll<RunRecord>(STORE_RECORDS);
  const out = raw.filter(looksLikeRecord);
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  backfillChannels(out);
  return out;
}

export async function getRecord(id: string): Promise<RunRecord | null> {
  const rec = await dbGet<RunRecord>(STORE_RECORDS, id);
  return looksLikeRecord(rec) ? rec : null;
}

export async function readSidecar(id: string): Promise<Sidecar | null> {
  return (await dbGet<Sidecar>(STORE_SIDECARS, id)) ?? null;
}

export async function listSidecars(): Promise<Sidecar[]> {
  return await dbGetAll<Sidecar>(STORE_SIDECARS);
}

export interface SaveInput {
  record: RunRecord;
  svg: string | null;
  raw?: string | null;
  reasoning?: string | null;
}

/**
 * 落库：元数据 + 侧车正文，一次事务写完（少一半断在半路的机会）。
 * 记录与侧车同生共死 —— 只有 hasSvg 为真却没有 svg 正文的话，标本页打开就是一片空白。
 */
export async function saveRun(input: SaveInput): Promise<RunRecord> {
  const day = dayOf(input.record.createdAt);
  const all = await dbGetAll<RunRecord>(STORE_RECORDS);
  const used: number[] = [];
  for (const r of all) {
    if (looksLikeRecord(r) && dayOf(r.createdAt) === day && typeof r.channel === 'number' && r.channel > 0) {
      used.push(r.channel);
    }
  }

  const id = input.record.id;
  const svgPath = input.svg ? sidecarPath(id, input.record.createdAt, '.svg') : null;
  const rawPath = input.raw ? sidecarPath(id, input.record.createdAt, '.raw.txt') : null;
  const reasoningPath = input.reasoning ? sidecarPath(id, input.record.createdAt, '.reasoning.txt') : null;

  const record: RunRecord = {
    ...input.record,
    channel: nextChannel(used),
    svgPath,
    hasSvg: Boolean(input.svg),
    rawPath,
    reasoningPath,
  };

  const sidecar: Sidecar = { id };
  if (input.svg) sidecar.svg = input.svg;
  if (input.raw) sidecar.raw = input.raw;
  if (input.reasoning) sidecar.reasoning = input.reasoning;

  const writes: { store: string; value: unknown }[] = [{ store: STORE_RECORDS, value: record }];
  // 一个字段都没有的侧车（没 svg、没 raw、没 reasoning）不必占一行
  if (input.svg || input.raw || input.reasoning) writes.push({ store: STORE_SIDECARS, value: sidecar });
  await dbPutMany(writes);

  return record;
}

/** 追加/更新一条记录（例如前端回报渲染失败） */
export async function patchRecord(id: string, patch: Partial<RunRecord>): Promise<RunRecord | null> {
  const rec = await getRecord(id);
  if (!rec) return null;
  const next: RunRecord = { ...rec, ...patch, id: rec.id, createdAt: rec.createdAt };
  await dbPut(STORE_RECORDS, next);
  return next;
}

/** 直接写入一条记录（导入用）。**不重新分配通道号** —— 导入的记录带着自己的号。 */
export async function putRecordRaw(record: RunRecord, sidecar: Sidecar | null): Promise<void> {
  const writes: { store: string; value: unknown }[] = [{ store: STORE_RECORDS, value: record }];
  if (sidecar && (sidecar.svg || sidecar.raw || sidecar.reasoning)) {
    writes.push({ store: STORE_SIDECARS, value: sidecar });
  }
  await dbPutMany(writes);
}

export async function deleteRecord(id: string): Promise<boolean> {
  const rec = await getRecord(id);
  if (!rec) return false;
  await dbDeleteMany([
    { store: STORE_RECORDS, key: id },
    { store: STORE_SIDECARS, key: id },
  ]);
  return true;
}

/** 统计各供应商 / 各题目的记录数，供界面展示 */
export async function stats(): Promise<{
  total: number;
  byProvider: Record<string, number>;
  byAnimal: Record<string, number>;
}> {
  const all = await listRecords();
  const byProvider: Record<string, number> = {};
  const byAnimal: Record<string, number> = {};
  for (const r of all) {
    byProvider[r.providerName] = (byProvider[r.providerName] ?? 0) + 1;
    byAnimal[r.promptLabel] = (byAnimal[r.promptLabel] ?? 0) + 1;
  }
  return { total: all.length, byProvider, byAnimal };
}
