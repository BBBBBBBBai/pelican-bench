import { beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { strToU8 } from 'fflate';
import type { RunRecord } from '@shared/types';
import { DEFAULT_CONFIG, readAllKeys, readConfig } from './lib/config';
import { STORE_CONFIG, STORE_KEYS, STORE_META, STORE_RECORDS, STORE_SIDECARS, dbClearMany, dbPut } from './lib/idb';
import { saveRun } from './lib/records';
import { api } from './api';

/**
 * `api` 是界面唯一碰数据的地方 —— 每个按钮背后都是这里的一个方法。
 *
 * 界面上的点击没法在 Node 里模拟，但按钮调到最后都是这几个函数；
 * 把它们逐条钉住，页面上的「点一下没反应」就没有藏身之处了。
 */

const RECORD_ID = '20261006-120000-aaaaa';

function makeRecord(over: Partial<RunRecord> = {}): RunRecord {
  return {
    id: RECORD_ID,
    createdAt: '2026-10-06T12:00:00.000Z',
    providerId: null,
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

beforeAll(() => {
  // 导出最后一步是「造一个 <a download> 并点它」——Node 里没有 document。
  // 给它一个只会点头的替身：这里要验证的是 zip 里装了什么，不是浏览器下载。
  const el: Record<string, unknown> = {};
  const stub = new Proxy(el, {
    get: (t, k) => (k in t ? t[k as string] : () => undefined),
    set: (t, k, v) => {
      t[k as string] = v;
      return true;
    },
  });
  (globalThis as Record<string, unknown>).document = {
    createElement: () => stub,
    body: { appendChild: () => undefined, removeChild: () => undefined },
  };
  (URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:test';
  (URL as unknown as Record<string, unknown>).revokeObjectURL = () => undefined;
});

beforeEach(async () => {
  await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, STORE_META]);
});

describe('出厂设置', () => {
  it('超时默认 300 秒 —— 实测一次 high effort 能跑到 146 秒，120 会把自己掐掉', async () => {
    expect(DEFAULT_CONFIG.timeoutSec).toBe(300);
    expect((await readConfig()).timeoutSec).toBe(300); // 库里没存过设置时就是这个数
  });

  it('模型候选清单的出厂值是那五家', async () => {
    expect(DEFAULT_CONFIG.modelPresets).toEqual([
      'gpt-6-astra',
      'gpt-6-sol',
      'gpt-6.1-sol',
      'claude-opus-5-5',
      'claude-sonnet-5-5',
    ]);
    // 库里没存过设置时读出来的就是这份（存过的不会被覆盖 —— 那是「恢复出厂清单」的事）
    expect((await readConfig()).modelPresets).toEqual(DEFAULT_CONFIG.modelPresets);
  });
});

describe('本地存储：加密状态要如实报给界面', () => {
  it('空库也算「已加密」—— 一把 Key 都没有，本来就没什么可泄露的', async () => {
    const stat = await api.storageStat();
    expect(stat.keysEncrypted).toBe(true);
    expect(stat.brokenKeys).toBe(0);
    expect(stat.records).toBe(0);
  });

  it('存了 Key 之后：界面看到的仍是「已加密」、没有坏 Key，记录一条不少', async () => {
    await api.addProvider({
      name: '加密测试',
      protocol: 'openai',
      baseUrl: 'https://api.a6api.com',
      apiKey: 'sk-encrypted-123456',
    });
    await saveRun({ record: makeRecord(), svg: null });

    const stat = await api.storageStat();
    expect(stat.keysEncrypted).toBe(true);
    expect(stat.brokenKeys).toBe(0);
    expect(stat.records).toBe(1);

    // 界面读的是 getConfig().storage 这一份，两条路必须给出同一个答案
    const cfg = await api.getConfig();
    expect(cfg.storage.keysEncrypted).toBe(true);
    expect(cfg.storage.brokenKeys).toBe(0);
    expect(cfg.providers[0].hasKey).toBe(true);
  });

  it('Key 解不开时：界面知道有几把要重填，档案不连坐被删', async () => {
    const prov = await api.addProvider({
      name: '坏钥匙',
      protocol: 'openai',
      baseUrl: 'https://api.a6api.com',
      apiKey: 'sk-broken-123456',
    });
    // 模拟「库是从别的电脑搬来的」：密文还在，钥匙柜里那把对不上
    await dbPut(STORE_META, {
      id: 'vault-key',
      v: 1,
      key: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]),
    });

    const stat = await api.storageStat();
    expect(stat.brokenKeys).toBe(1);
    expect(stat.keysEncrypted).toBe(true);

    const cfg = await api.getConfig();
    expect(cfg.providers.map((p) => p.id)).toContain(prov.id); // 档案还在
    expect(cfg.providers[0].hasKey).toBe(false); // 解不开 = 当没配
  });
});

describe('供应商档案：建 / 改 / 删，以及 Key 跟着谁走', () => {
  it('新建后能读回，且 hasKey 说的是「有没有 Key」而不是「有没有地址」', async () => {
    const created = await api.addProvider({
      name: 'banban',
      protocol: 'openai',
      baseUrl: 'https://api.banban.plus',
      apiKey: 'sk-banban',
      params: { temperature: 1 },
    });
    expect(created.id).toBeTruthy();
    expect(created.hasKey).toBe(true);
    expect(created.baseUrl).toBe('https://api.banban.plus');

    const cfg = await api.getConfig();
    expect(cfg.providers).toHaveLength(1);
    expect(cfg.providers[0].hasKey).toBe(true);
    // 界面拿到的对象里不该混进 Key 本身
    expect(JSON.stringify(cfg)).not.toContain('sk-banban');
  });

  it('不带 apiKey 新建时 hasKey 为假，但地址照旧存下来', async () => {
    const p = await api.addProvider({ name: '空壳', protocol: 'openai', baseUrl: 'https://x.test' });
    expect(p.hasKey).toBe(false);
    expect(p.baseUrl).toBe('https://x.test');
  });

  it('改档案是**合并**：只传 viaProxy 不会把名字和地址冲掉', async () => {
    const p = await api.addProvider({ name: 'a6', protocol: 'openai', baseUrl: 'https://api.a6api.com', apiKey: 'sk-a' });
    const next = await api.updateProvider(p.id, { viaProxy: true });
    expect(next.viaProxy).toBe(true);
    expect(next.name).toBe('a6');
    expect(next.baseUrl).toBe('https://api.a6api.com');
    expect(next.hasKey).toBe(true); // Key 没被这一改带走
  });

  it('删档案连 Key 一起删 —— 留着一把没有归属的密钥只会变成雷', async () => {
    const p = await api.addProvider({ name: 'a6', protocol: 'openai', baseUrl: 'https://api.a6api.com', apiKey: 'sk-a' });
    await api.deleteProvider(p.id);
    expect(await api.getConfig().then((c) => c.providers)).toHaveLength(0);
    expect(await readAllKeys()).toEqual({});
  });

  it('keyCount 与 clearAllKeys：清空的是密钥，不是档案', async () => {
    await api.addProvider({ name: 'a6', protocol: 'openai', baseUrl: 'https://api.a6api.com', apiKey: 'sk-a' });
    await api.addProvider({ name: 'banban', protocol: 'openai', baseUrl: 'https://api.banban.plus', apiKey: 'sk-b' });
    expect(await api.keyCount()).toBe(2);

    await api.clearAllKeys();
    expect(await api.keyCount()).toBe(0);
    const cfg = await api.getConfig();
    expect(cfg.providers).toHaveLength(2);
    expect(cfg.providers.every((p) => !p.hasKey)).toBe(true);
  });

  it('saveConfig 只改传进来的那几个字段', async () => {
    await api.saveConfig({ uiLang: 'en', retries: 4 });
    const cfg = await api.getConfig();
    expect(cfg.uiLang).toBe('en');
    expect(cfg.retries).toBe(4);
    expect(cfg.promptLang).toBe(DEFAULT_CONFIG.promptLang);
  });
});

describe('记录：列表 / 单条 / 打标签 / 删除', () => {
  it('列表带统计，单条带三个正文', async () => {
    await saveRun({ record: makeRecord(), svg: '<svg><rect/></svg>', raw: 'RAW', reasoning: 'THINK' });

    const list = await api.getRecords();
    expect(list.records).toHaveLength(1);
    expect(list.records[0].hasSvg).toBe(true);
    expect(list.stats.total).toBe(1);
    expect(list.stats.byProvider.a6).toBe(1);

    const detail = await api.getRecord(RECORD_ID);
    expect(detail.svg).toContain('<svg');
    expect(detail.raw).toBe('RAW');
    expect(detail.reasoning).toBe('THINK');
  });

  it('渲染失败这类标签能追加上去（App 就是这么回报的）', async () => {
    await saveRun({ record: makeRecord(), svg: '<svg/>', raw: null });
    const next = await api.patchRecordFlags(RECORD_ID, [
      { code: 'render-failed', detail: '图没画出来' },
    ]);
    expect(next.flags).toHaveLength(1);
    expect((await api.getRecord(RECORD_ID)).record.flags[0].code).toBe('render-failed');
  });

  it('给已经不存在的记录打标签要说人话，不能静默成功', async () => {
    await expect(api.patchRecordFlags('nope', [])).rejects.toThrow(/记录/);
  });

  it('删除记录连侧车一起删', async () => {
    await saveRun({ record: makeRecord(), svg: '<svg/>', raw: 'RAW' });
    expect(await api.deleteRecord(RECORD_ID)).toEqual({ ok: true });
    await expect(api.getRecord(RECORD_ID)).rejects.toThrow(/记录/);
    expect(await api.getRecords().then((r) => r.records)).toHaveLength(0);
  });

  it('storage.records 就是记录条数', async () => {
    expect((await api.getConfig()).storage.records).toBe(0);
    await saveRun({ record: makeRecord(), svg: null, raw: null });
    expect((await api.getConfig()).storage.records).toBe(1);
  });
});

describe('测连接：地址本身不合法时当场说清，不发请求', () => {
  it('地址是空的时候直接判死', async () => {
    const p = await api.addProvider({ name: '待认领', protocol: 'openai', baseUrl: '', apiKey: 'sk-x' });
    const res = await api.probeProvider(p.id);
    expect(res.ok).toBe(false);
    expect(res.message.length).toBeGreaterThan(0);
  });

  it('少了协议头的地址也直接判死（用户手填时最常犯的错）', async () => {
    const p = await api.addProvider({ name: '手填', protocol: 'openai', baseUrl: 'api.a6api.com', apiKey: 'sk-x' });
    const res = await api.probeProvider(p.id);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/http/i);
  });
});

describe('导出 / 导入：走 api 这一层也要对得上', () => {
  it('导出的 zip 就是旧版目录，导入能读回来', async () => {
    await api.addProvider({ name: 'a6', protocol: 'openai', baseUrl: 'https://api.a6api.com', apiKey: 'sk-a' });
    await saveRun({ record: makeRecord(), svg: '<svg><rect/></svg>', raw: 'RAW' });

    const res = await api.exportZip({ includeKeys: true });
    expect(res.records).toBe(1);
    const files = Object.keys(unzipSync(new Uint8Array(await res.blob.arrayBuffer())));
    expect(files).toContain('config.json');
    expect(files).toContain('data/records/2026-10-06/20261006-120000-aaaaa.json');
    expect(files).toContain('config.local.json');

    await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, STORE_META]);
    const rep = await api.importZip(new Blob([zipSync(unzipSync(new Uint8Array(await res.blob.arrayBuffer())))]));
    expect(rep.recordsNew).toBe(1);
    expect(rep.keys).toBe(1);
    expect(await api.getRecord(RECORD_ID).then((d) => d.svg)).toContain('<svg');
  });

  it('不勾「包含 Key」时，zip 里就没有 config.local.json', async () => {
    await api.addProvider({ name: 'a6', protocol: 'openai', baseUrl: 'https://api.a6api.com', apiKey: 'sk-a' });
    const res = await api.exportZip();
    const files = Object.keys(unzipSync(new Uint8Array(await res.blob.arrayBuffer())));
    expect(files).not.toContain('config.local.json');
    expect(res.keys).toBe(0);
  });

  it('从目录迁移也走同一条路', async () => {
    const cfg = { ...DEFAULT_CONFIG, retries: 7, providers: [] };
    const files = [
      Object.assign(new File([strToU8(JSON.stringify(cfg))], 'config.json'), { webkitRelativePath: '旧目录/config.json' }),
      Object.assign(new File([strToU8(JSON.stringify(makeRecord()))], `${RECORD_ID}.json`), {
        webkitRelativePath: `旧目录/data/records/2026-10-06/${RECORD_ID}.json`,
      }),
    ];

    const rep = await api.migrateFromDirectory(files);
    expect(rep.settings).toBe(true);
    expect(rep.recordsNew).toBe(1);
    expect((await readConfig()).retries).toBe(7);
  });
});
