import { beforeEach, describe, expect, it } from 'vitest';
import type { RunRecord } from '@shared/types';
import { STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, dbClearMany } from './idb';
import {
  backfillChannels,
  dayOf,
  deleteRecord,
  getRecord,
  listRecords,
  newId,
  nextChannel,
  readSidecar,
  saveRun,
  sidecarPath,
  stats,
} from './records';

function makeRecord(over: Partial<RunRecord> = {}): RunRecord {
  return {
    id: '20261006-120000-aaaaa',
    createdAt: '2026-10-06T12:00:00.000Z',
    providerId: 'p_a',
    providerName: 'a6',
    protocol: 'openai',
    baseUrl: 'https://api.a6api.com',
    requestedModel: 'gpt-6.1-sol',
    responseModel: 'gpt-6.1-sol',
    responseId: 'r1',
    params: { temperature: 1, maxTokens: 32000, effort: 'high' },
    promptId: 'cat',
    promptLabel: '猫',
    promptText: '画一只骑单车的猫',
    usedOverrides: false,
    durationMs: 1234,
    attempts: 1,
    usage: null,
    finishReason: 'stop',
    flags: [],
    ok: true,
    aborted: false,
    hasSvg: true,
    svgPath: null,
    rawLength: 100,
    error: null,
    ...over,
  };
}

beforeEach(async () => {
  await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);
});

describe('通道号', () => {
  it('取当天最小空号，不是「最大号 + 1」', () => {
    expect(nextChannel([])).toBe(1);
    expect(nextChannel([1, 2, 3])).toBe(4);
    // 删掉中间一条，那个号就空着 —— 后面的记录不改号，像机架上空着的槽位
    expect(nextChannel([1, 3])).toBe(2);
  });

  it('0 和负数不是有效的占位', () => {
    expect(nextChannel([0, -1])).toBe(1);
  });
});

describe('缺号的老记录按天回填', () => {
  it('同一天内按时间顺序补最小空号，已有的号不动', () => {
    const a = makeRecord({ id: 'a', createdAt: '2026-10-06T01:00:00.000Z', channel: null });
    const b = makeRecord({ id: 'b', createdAt: '2026-10-06T02:00:00.000Z', channel: 5 });
    const c = makeRecord({ id: 'c', createdAt: '2026-10-06T03:00:00.000Z', channel: undefined });

    backfillChannels([c, b, a]); // 故意乱序传进去

    expect(a.channel).toBe(1);
    expect(c.channel).toBe(2); // 5 已被占，于是 1、2 顺次补
    expect(b.channel).toBe(5);
  });

  it('另一天从 1 重新开始 —— 机架就是一天', () => {
    const d = makeRecord({ id: 'd', createdAt: '2026-10-07T01:00:00.000Z', channel: null });
    const e = makeRecord({ id: 'e', createdAt: '2026-10-06T01:00:00.000Z', channel: null });
    backfillChannels([d, e]);
    expect(d.channel).toBe(1);
    expect(e.channel).toBe(1);
  });
});

describe('id 与路径形状', () => {
  it('newId 是 YYYYMMDD-HHmmss-xxxxx（本地时间，按天分目录靠它）', () => {
    expect(newId(new Date(2026, 9, 6, 12, 0, 0))).toMatch(/^20261006-120000-[a-z0-9]{5}$/);
  });

  it('sidecarPath 就是旧版那个相对路径（导出时加 data/ 即 zip 条目名）', () => {
    expect(sidecarPath('abc', '2026-10-06T12:00:00.000Z', '.svg')).toBe('records/2026-10-06/abc.svg');
    expect(sidecarPath('abc', '2026-10-06T12:00:00.000Z', '.raw.txt')).toBe(
      'records/2026-10-06/abc.raw.txt',
    );
  });

  it('dayOf 取 ISO 的前十位', () => {
    expect(dayOf('2026-10-06T23:59:59.000Z')).toBe('2026-10-06');
  });
});

describe('落库与读回', () => {
  it('记录与侧车一起写，路径字段照旧写着 records/… 的形状', async () => {
    const rec = await saveRun({
      record: makeRecord({ hasSvg: false, svgPath: null }),
      svg: '<svg/>',
      raw: 'RAW',
      reasoning: null,
    });

    expect(rec.channel).toBe(1);
    expect(rec.hasSvg).toBe(true);
    expect(rec.svgPath).toBe('records/2026-10-06/20261006-120000-aaaaa.svg');
    expect(rec.rawPath).toBe('records/2026-10-06/20261006-120000-aaaaa.raw.txt');
    expect(rec.reasoningPath).toBeNull();

    const side = await readSidecar(rec.id);
    expect(side?.svg).toBe('<svg/>');
    expect(side?.raw).toBe('RAW');
    expect(side?.reasoning).toBeUndefined();

    const back = await getRecord(rec.id);
    expect(back?.id).toBe(rec.id);
  });

  it('一个字段都没有的侧车不必占一行', async () => {
    const rec = await saveRun({ record: makeRecord(), svg: null, raw: null, reasoning: null });
    expect(await readSidecar(rec.id)).toBeNull();
    expect(rec.hasSvg).toBe(false);
  });

  it('当天第二条拿通道号 2；换一天从 1 开始', async () => {
    const first = await saveRun({ record: makeRecord({ id: 'a' }), svg: '<svg/>' });
    const second = await saveRun({ record: makeRecord({ id: 'b' }), svg: '<svg/>' });
    const nextDay = await saveRun({
      record: makeRecord({ id: 'c', createdAt: '2026-10-07T09:00:00.000Z' }),
      svg: '<svg/>',
    });

    expect([first.channel, second.channel, nextDay.channel]).toEqual([1, 2, 1]);
  });

  it('listRecords 按时间倒序，并回填缺号的老记录', async () => {
    await saveRun({ record: makeRecord({ id: 'old', createdAt: '2026-10-06T01:00:00.000Z' }), svg: null });
    await saveRun({ record: makeRecord({ id: 'new', createdAt: '2026-10-06T05:00:00.000Z' }), svg: null });

    const list = await listRecords();
    expect(list.map((r) => r.id)).toEqual(['new', 'old']);
    expect(list.map((r) => r.channel)).toEqual([2, 1]);
  });

  it('删除一条会连它的侧车一起删', async () => {
    const rec = await saveRun({ record: makeRecord(), svg: '<svg/>', raw: 'RAW' });
    expect(await deleteRecord(rec.id)).toBe(true);
    expect(await getRecord(rec.id)).toBeNull();
    expect(await readSidecar(rec.id)).toBeNull();
    expect(await listRecords()).toEqual([]);
  });

  it('删一条不存在的返回 false（界面据此说「已经不在了」）', async () => {
    expect(await deleteRecord('不存在')).toBe(false);
  });
});

describe('stats', () => {
  it('按供应商名与题目名计数', async () => {
    await saveRun({ record: makeRecord({ id: 'a', providerName: 'a6', promptLabel: '猫' }), svg: null });
    await saveRun({ record: makeRecord({ id: 'b', providerName: 'a6', promptLabel: '猫' }), svg: null });
    await saveRun({
      record: makeRecord({ id: 'c', providerName: 'banban', promptLabel: '狗' }),
      svg: null,
    });

    const s = await stats();
    expect(s.total).toBe(3);
    expect(s.byProvider).toEqual({ a6: 2, banban: 1 });
    expect(s.byAnimal).toEqual({ 猫: 2, 狗: 1 });
  });
});
