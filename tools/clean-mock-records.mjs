/**
 * 删掉 smoke 跑测试留下的记录，保住真实记录。
 *
 * 为什么单独写一个而不是一行内联：这条清理命令差点把整个 data/records 抹掉过一次
 * （[datetime] 把 "...Z" 当本地时间解析，比较结果永远为 false）。所以现在固定流程是
 * ——先算，再打印，再断言，最后才删；断言不过就一个字都不动。
 *
 *   node tools/clean-mock-records.mjs          只预览，不删
 *   node tools/clean-mock-records.mjs --apply  真的删
 */
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'data/records';
/** 保留名单：这些是真实调用产生的记录，任何情况下都不能删 */
const KEEP_IDS = new Set(['20261007-003452-wwxim']);
/** 只有这些供应商名才允许被清掉，其余一律当真实数据保护起来 */
const MOCK_PROVIDERS = new Set([
  'mock-bad',
  'mock-good',
  'mock-truncated',
  'mock-mismatch',
  'mock-hang',
  'mock-error',
  'mock-thinking',
  'mock-paper',
  'mock-vivid',
  'mock-inkonly',
  '大小写测试',
  '中止测试',
  '注入测试',
]);

const apply = process.argv.includes('--apply');
const keep = [];
const del = [];
const suspicious = [];

for (const day of readdirSync(ROOT)) {
  const dayDir = join(ROOT, day);
  if (!statSync(dayDir).isDirectory()) continue;
  for (const file of readdirSync(dayDir).filter((f) => f.endsWith('.json'))) {
    const id = file.slice(0, -'.json'.length);
    let meta = {};
    try {
      meta = JSON.parse(readFileSync(join(dayDir, file), 'utf8'));
    } catch {
      /* 读不出来的当真实数据保护 */
    }
    const prov = meta.providerName;
    if (KEEP_IDS.has(id)) keep.push({ id, prov });
    else if (MOCK_PROVIDERS.has(prov)) del.push({ id, prov, model: meta.requestedModel });
    else suspicious.push({ id, prov, model: meta.requestedModel });
  }
}

console.log(`保留 ${keep.length} 条：`);
for (const r of keep) console.log(`   ${r.id}  ${r.prov}`);
console.log(`\n待删 ${del.length} 条：`);
for (const r of del) console.log(`   ${r.id}  ${r.prov} / ${r.model}`);

if (suspicious.length) {
  console.log(`\n拿不准、不动它 ${suspicious.length} 条：`);
  for (const r of suspicious) console.log(`   ${r.id}  ${r.prov} / ${r.model}`);
}

// 断言：保留名单里的每一条都必须真的还在文件系统上找得到
for (const id of KEEP_IDS) {
  if (!keep.some((r) => r.id === id)) {
    console.error(`\n[拒绝执行] 真实记录 ${id} 没有出现在保留名单里，一条都不删。`);
    process.exit(1);
  }
}
if (keep.length + del.length + suspicious.length === 0) {
  console.error('\n[拒绝执行] 一条记录都没扫到，路径不对？');
  process.exit(1);
}

if (!apply) {
  console.log('\n（预览模式，什么都没删。确认无误后加 --apply）');
  process.exit(0);
}

let n = 0;
for (const r of [...del, ...suspicious]) {
  const day = readdirSync(ROOT).find((d) => readdirSync(join(ROOT, d)).includes(`${r.id}.json`));
  if (!day) continue;
  for (const ext of ['.json', '.svg', '.raw.txt', '.reasoning.txt']) {
    rmSync(join(ROOT, day, `${r.id}${ext}`), { force: true });
  }
  n++;
}
console.log(`\n已删除 ${n} 条测试记录。`);
