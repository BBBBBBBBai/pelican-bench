import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { readAllKeys, readConfig, readPromptPool } from './config';
import { STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS, dbClearMany } from './idb';
import { listRecords, readSidecar } from './records';
import { migrateFromDirectory } from './zipcodec';

/**
 * 拿**仓库里那份真实的旧安装目录**当夹具，跑一次完整的迁移。
 *
 * 单测里的夹具是编出来的；这一份不是 —— 它就是用户机器上那个
 * `config.json`（providers 已经被清空）/ `config.local.json`（7 把 Key）/
 * `prompts.json` / `data/records/**`（14 条记录）。它最能证明「迁移这条路真的通」，
 * 所以刻意不把它做成合成数据。
 *
 * `config.local.json` 与 `data/` 都在 .gitignore 里，别的机器克隆下来不会有这些文件，
 * 那种情况下整组测试会跳过 —— 而不是报一堆看起来像代码坏了的失败。
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HAS_LEGACY = existsSync(join(ROOT, 'data', 'records')) && existsSync(join(ROOT, 'config.json'));

/** 用户是「选中项目根目录」再交给 <input webkitdirectory> 的，所以路径里会带这一层 */
const PICKED_FOLDER = '鹈鹕测试工具';

function collectRealFiles(): File[] {
  const out: File[] = [];

  const push = (rel: string) => {
    const bytes = readFileSync(join(ROOT, rel));
    const file = new File([bytes], rel.split('/').pop() as string);
    Object.defineProperty(file, 'webkitRelativePath', { value: `${PICKED_FOLDER}/${rel}` });
    out.push(file);
  };

  for (const name of ['config.json', 'config.local.json', 'prompts.json']) {
    if (existsSync(join(ROOT, name))) push(name);
  }

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else push(rel);
    }
  };
  walk('data/records');

  return out;
}

describe.skipIf(!HAS_LEGACY)('迁移：仓库里那份真实的旧安装目录', () => {
  beforeEach(async () => {
    await dbClearMany([STORE_CONFIG, STORE_KEYS, STORE_RECORDS, STORE_SIDECARS]);
  });

  it('14 条记录、设置、题池、7 把 Key 一次全搬过来，不缺件', async () => {
    const files = collectRealFiles();
    expect(files.length).toBeGreaterThan(30); // 夹具本身在

    const rep = await migrateFromDirectory(files);

    expect(rep.settings).toBe(true);
    expect(rep.prompts).toBe(true);
    expect(rep.keys).toBe(7);
    expect(rep.recordsNew).toBe(14);
    expect(rep.recordsUpdated).toBe(0);
    expect(rep.recordsWithoutSvg).toBe(0);
    expect(rep.warnings).toEqual([]);

    // 7 把 Key 里 3 把能从记录里还原出档案，剩下 4 把真的无从得知地址
    expect(rep.providers).toBe(7);
    expect(rep.orphans).toHaveLength(4);
  });

  it('三个 Key 的档案从记录里原样还原：名字、协议、地址都对', async () => {
    await migrateFromDirectory(collectRealFiles());

    const cfg = await readConfig();
    const byId = new Map(cfg.providers.map((p) => [p.id, p]));

    const a6 = byId.get('p_78j76c5s');
    expect(a6?.name).toBe('a6');
    expect(a6?.protocol).toBe('openai');
    expect(a6?.baseUrl).toBe('https://api.a6api.com');

    const banban = byId.get('p_d34xbpav');
    expect(banban?.baseUrl).toBe('https://api.banban.plus');

    // 认不出来的那几把退化成占位档案，但**密钥本身留着** —— 地址能后补，密钥补不回来
    const placeholder = byId.get('p_0cvfw812');
    expect(placeholder?.baseUrl).toBe('');
    expect((await readAllKeys()).p_0cvfw812).toBeTruthy();
  });

  it('记录连正文一起进来了：通道号齐、带图的那 12 条打开就有图', async () => {
    await migrateFromDirectory(collectRealFiles());

    const records = await listRecords();
    expect(records).toHaveLength(14);
    // 没有一条缺通道号 —— 缺的话标本页上就指不出是哪一格
    expect(records.every((r) => typeof r.channel === 'number' && r.channel > 0)).toBe(true);

    const withSvg = records.filter((r) => r.hasSvg);
    expect(withSvg).toHaveLength(12);
    for (const r of withSvg) {
      const side = await readSidecar(r.id);
      expect(side?.svg ?? '').toContain('<svg');
    }

    // 按天分机架：同一天里通道号不重复（这正是「机架空一格」的语义）
    const byDay = new Map<string, number[]>();
    for (const r of records) {
      const day = String(r.createdAt).slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), r.channel as number]);
    }
    for (const channels of byDay.values()) {
      expect(new Set(channels).size).toBe(channels.length);
    }
  });

  it('题池也搬过来了（20 种动物）', async () => {
    await migrateFromDirectory(collectRealFiles());
    const pool = await readPromptPool();
    expect(pool.animals.length).toBe(20);
    expect(pool.template.length).toBeGreaterThan(0);
    expect(pool.templateEn.length).toBeGreaterThan(0);
  });
});
