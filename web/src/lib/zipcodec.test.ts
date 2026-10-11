import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import type { ProviderProfile, RunRecord } from '@shared/types';
import { DEFAULT_CONFIG, readAllKeys, readConfig, writeConfig, writeKeys, writePromptPool } from './config';
import { STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, dbClearMany } from './idb';
import { listRecords, readSidecar, saveRun } from './records';
import { buildExportZip, collectFiles, importZip, suggestedFilename } from './zipcodec';

const RECORD_ID = '20261006-120000-aaaaa';

const PROFILE: ProviderProfile = {
  id: 'p_a',
  name: 'a6',
  protocol: 'openai',
  baseUrl: 'https://api.a6api.com',
  params: {},
  createdAt: '2026-10-06T00:00:00.000Z',
};

const PROMPT_POOL = {
  animals: ['猫'],
  template: '画一只骑单车的{animal}',
  templateEn: 'draw a {animal} on a bike',
  extras: [],
};

function makeRecord(over: Partial<RunRecord> = {}): RunRecord {
  return {
    id: RECORD_ID,
    createdAt: '2026-10-06T12:00:00.000Z',
    providerId: PROFILE.id,
    providerName: PROFILE.name,
    protocol: 'openai',
    baseUrl: PROFILE.baseUrl,
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

/** 装一台「旧版本」：设置 + 两个 Key + 一条带 SVG 的记录 */
async function seedLegacy() {
  await writeConfig({ ...DEFAULT_CONFIG, uiLang: 'en', retries: 3, providers: [PROFILE] });
  await writeKeys({ p_a: 'sk-a', p_orphan: 'sk-b' });
  await writePromptPool(PROMPT_POOL);
  await saveRun({ record: makeRecord(), svg: '<svg><rect/></svg>', raw: 'RAW', reasoning: null });
}

beforeEach(async () => {
  await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);
});

describe('导出：解开就是旧版的数据目录', () => {
  it('路径与旧 exe 的目录布局逐字一致', async () => {
    await seedLegacy();
    const res = await buildExportZip({ includeKeys: true });

    expect(res.records).toBe(1);
    expect(res.providers).toBe(1);
    expect(res.keys).toBe(2);

    const files = Object.keys(unzipSync(new Uint8Array(await res.blob.arrayBuffer())));
    expect(files.sort()).toEqual(
      [
        'config.json',
        'config.local.json',
        'prompts.json',
        `data/records/2026-10-06/${RECORD_ID}.json`,
        `data/records/2026-10-06/${RECORD_ID}.svg`,
        `data/records/2026-10-06/${RECORD_ID}.raw.txt`,
      ].sort(),
    );
  });

  it('不勾「包含 API Key」时不写 config.local.json', async () => {
    await seedLegacy();
    const res = await buildExportZip();
    expect(res.keys).toBe(0);
    const files = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
    expect(files['config.local.json']).toBeUndefined();
    // 设置本身照旧导出 —— 只有密钥那一个文件受影响
    expect(files['config.json']).toBeTruthy();
  });

  it('文件名带时间戳，落盘不会互相覆盖', () => {
    const name = suggestedFilename(new Date(2026, 9, 6, 12, 30, 45));
    expect(name).toBe('pelican-bench-20261006-123045.zip');
  });
});

describe('导入：往返一次就回到原来的样子', () => {
  it('记录、侧车、供应商、Key、设置全都回来', async () => {
    await seedLegacy();
    const res = await buildExportZip({ includeKeys: true });
    const bytes = new Uint8Array(await res.blob.arrayBuffer());

    // 换一台全新的浏览器：库清空
    await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);

    const rep = await importZip(bytes);
    expect(rep.recordsNew).toBe(1);
    expect(rep.recordsUpdated).toBe(0);
    expect(rep.recordsWithoutSvg).toBe(0);
    expect(rep.settings).toBe(true);
    expect(rep.prompts).toBe(true);
    expect(rep.keys).toBe(2);

    const cfg = await readConfig();
    // 设置是「恢复」而不是「落回默认值」：这两个数字都不是出厂值
    expect(cfg.uiLang).toBe('en');
    expect(cfg.retries).toBe(3);
    // 备份里只有一个档案（p_a），但带了两把 Key —— p_orphan 按设计会被建成占位档案。
    // 这正是用户那台机器上的真实形状：档案丢了，密钥还在。
    expect(cfg.providers.map((p) => p.id).sort()).toEqual(['p_a', 'p_orphan']);
    expect(rep.orphans).toEqual(['待认领的 Key 1']);
    expect(await readAllKeys()).toEqual({ p_a: 'sk-a', p_orphan: 'sk-b' });

    const list = await listRecords();
    expect(list).toHaveLength(1);
    expect(list[0].hasSvg).toBe(true);
    const side = await readSidecar(RECORD_ID);
    expect(side?.svg).toBe('<svg><rect/></svg>');
    expect(side?.raw).toBe('RAW');
  });

  it('记录自己说「有 SVG」、备份里却没有那个 .svg —— 要如实报出来', async () => {
    await seedLegacy();
    // 手工造一份「只有记录、没有图」的备份：这正是只导出记录会得到的东西
    const files = unzipSync(new Uint8Array(await (await buildExportZip()).blob.arrayBuffer()));
    delete files[`data/records/2026-10-06/${RECORD_ID}.svg`];
    delete files[`data/records/2026-10-06/${RECORD_ID}.raw.txt`];

    const bytes = zipSync(files);
    await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);

    const rep = await importZip(bytes);
    expect(rep.recordsNew).toBe(1);
    expect(rep.recordsWithoutSvg).toBe(1);
  });

  it('导入不删已有记录（拿三天前的备份回来不该抹掉今天的东西）', async () => {
    await seedLegacy();
    const bytes = new Uint8Array(await (await buildExportZip()).blob.arrayBuffer());

    // 今天新跑的一条，id 与备份里的不同
    await saveRun({
      record: makeRecord({ id: 'today-1', createdAt: '2026-10-09T09:00:00.000Z' }),
      svg: '<svg/>',
    });

    const rep = await importZip(bytes);
    // 备份里那条记录这台库已经有了（覆盖），今天的 today-1 不在备份里（不该被动）
    expect(rep.recordsNew).toBe(0);
    expect(rep.recordsUpdated).toBe(1);
    expect((await listRecords()).map((r) => r.id).sort()).toEqual(['20261006-120000-aaaaa', 'today-1']);
  });

  it('重复导入同一份：第二次算「覆盖」，条数不翻倍', async () => {
    await seedLegacy();
    const bytes = new Uint8Array(await (await buildExportZip()).blob.arrayBuffer());
    await importZip(bytes);
    const again = await importZip(bytes);
    expect(again.recordsNew).toBe(0);
    expect(again.recordsUpdated).toBe(1);
    expect(await listRecords()).toHaveLength(1);
  });

  it('库里已经有设置时，导入**只补空**：不覆盖用户的偏好，只把供应商并进来', async () => {
    await writeConfig({ ...DEFAULT_CONFIG, retries: 5, uiLang: 'zh', providers: [PROFILE] });
    const incoming = {
      ...DEFAULT_CONFIG,
      retries: 2,
      uiLang: 'en',
      providers: [{ ...PROFILE, id: 'p_b', name: 'banban', baseUrl: 'https://api.banban.plus' }],
    };
    const bytes = zipSync({ 'config.json': strToU8(JSON.stringify(incoming)) });

    const rep = await importZip(bytes);
    const cfg = await readConfig();
    expect(cfg.retries).toBe(5); // 用户的偏好没被改掉
    expect(cfg.uiLang).toBe('zh');
    expect(cfg.providers.map((p) => p.id).sort()).toEqual(['p_a', 'p_b']); // 供应商并进来了
    expect(rep.settings).toBe(true);
  });
});

describe('孤儿 Key：有密钥、没有档案', () => {
  it('每个孤儿建一个「待认领的 Key」，并在报告里点名', async () => {
    const cfg = { ...DEFAULT_CONFIG, providers: [PROFILE] };
    const bytes = zipSync({
      'config.json': strToU8(JSON.stringify(cfg)),
      'config.local.json': strToU8(JSON.stringify({ p_a: 'sk-a', p_orphan: 'sk-b' })),
    });

    const rep = await importZip(bytes);
    expect(rep.orphans).toEqual(['待认领的 Key 1']);

    const after = await readConfig();
    const placeholder = after.providers.find((p) => p.id === 'p_orphan');
    expect(placeholder?.name).toBe('待认领的 Key 1');
    expect(placeholder?.baseUrl).toBe('');
    // Key 本身留着 —— 地址是可以后补的，密钥补不回来
    expect((await readAllKeys()).p_orphan).toBe('sk-b');
  });

  it('跑过的孤儿 Key 能直接从记录里把档案还原出来，不必麻烦用户去认领', async () => {
    // 这正是那台机器上的形状：档案没了，但记录里留着 providerId + 名字 + 协议 + 地址
    await writeConfig({ ...DEFAULT_CONFIG, providers: [] });
    await writeKeys({ p_lost: 'sk-lost' });
    await saveRun({
      record: makeRecord({
        providerId: 'p_lost',
        providerName: 'a6',
        protocol: 'openai',
        baseUrl: 'https://api.a6api.com',
      }),
      svg: null,
      raw: null,
    });

    const bytes = new Uint8Array(await (await buildExportZip({ includeKeys: true })).blob.arrayBuffer());
    await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);

    const rep = await importZip(bytes);
    expect(rep.orphans).toEqual([]); // 没有需要用户认领的东西
    const cfg = await readConfig();
    const restored = cfg.providers.find((p) => p.id === 'p_lost');
    expect(restored?.name).toBe('a6');
    expect(restored?.protocol).toBe('openai');
    expect(restored?.baseUrl).toBe('https://api.a6api.com');
  });
});

describe('collectFiles：路径归一化', () => {
  it('剥掉 webkitdirectory 带来的顶层目录名', () => {
    const map = new Map<string, Uint8Array>([
      ['鹈鹕测试工具/config.json', strToU8(JSON.stringify(DEFAULT_CONFIG))],
      [`鹈鹕测试工具/data/records/2026-10-06/${RECORD_ID}.json`, strToU8(JSON.stringify(makeRecord()))],
    ]);

    const c = collectFiles(map);
    expect(c.configFound).toBe(true);
    expect(c.records).toHaveLength(1);
    expect(c.records[0].record.id).toBe(RECORD_ID);
  });

  it('没有 data/ 这一层（直接把 records 目录拖进来）也认', () => {
    const map = new Map<string, Uint8Array>([
      [`records/2026-10-06/${RECORD_ID}.json`, strToU8(JSON.stringify(makeRecord()))],
      [`records/2026-10-06/${RECORD_ID}.svg`, strToU8('<svg/>')],
    ]);

    const c = collectFiles(map);
    expect(c.records).toHaveLength(1);
    expect(c.records[0].sidecar.svg).toBe('<svg/>');
  });

  it('找不到对应记录的侧车只记一条警告，不让整次导入失败', () => {
    const map = new Map<string, Uint8Array>([['data/records/2026-10-06/孤儿.svg', strToU8('<svg/>')]]);
    const c = collectFiles(map);
    expect(c.records).toHaveLength(0);
    expect(c.warnings.join(' ')).toContain('孤儿.svg');
  });

  it('坏掉的 config.json 被记下并跳过，不炸掉整次导入', () => {
    const map = new Map<string, Uint8Array>([['config.json', strToU8('{ 这不是 JSON')]]);
    const c = collectFiles(map);
    expect(c.configFound).toBe(false);
    expect(c.warnings.join(' ')).toContain('config.json');
  });
});

describe('importZip：坏输入', () => {
  it('不是 zip 的字节要抛一句人话，不能是 unzip 的原始异常', async () => {
    await expect(importZip(strToU8('这不是压缩包'))).rejects.toThrow(/不是有效的 zip/);
  });

  it('空 zip 也要说清楚', async () => {
    const bytes = zipSync({});
    await expect(importZip(bytes)).rejects.toThrow(/zip 是空的|不是有效的 zip/);
  });
});
