/**
 * 一次性清理：删掉 tools/seed-demo.mjs 灌进来的演示记录。
 *
 * 为什么不用 tools/clean-mock-records.mjs：那个脚本按 providerName 匹配，
 * 而 seed-demo 造的供应商名字（「原厂直连」「北方中转」…）是编的、不在它的
 * MOCK_PROVIDERS 名单里，所以 24 条全被归进「拿不准、不动它」，一条都删不掉。
 *
 * 这里的判据是三条并列，任一命中就算演示记录：
 *   1. requestedModel 以 mock- 开头
 *   2. baseUrl 指向本机的 mock provider（127.0.0.1:9911）
 *   3. providerName 在 seed-demo.mjs 的 PROFILES 里
 * 三条都命中的才删；只命中一部分的单独列出来人工看。
 *
 *   node .impeccable/_purge-mock.mjs          只预览
 *   node .impeccable/_purge-mock.mjs --apply  真的删
 */
import { readdirSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'data/records';
const SEED_PROVIDERS = new Set([
  '原厂直连',
  '北方中转',
  '南方中转',
  '聚合站 · 便宜档',
  '聚合站 · 极速档',
  '某二手额度站',
  '文字模型冒充',
  '官方格式 · 长思考',
]);
const EXTS = ['.json', '.svg', '.raw.txt', '.reasoning.txt'];

const apply = process.argv.includes('--apply');
const del = [];
const keep = [];
const partial = [];

for (const day of readdirSync(ROOT)) {
  const dayDir = join(ROOT, day);
  if (!statSync(dayDir).isDirectory()) continue;
  for (const file of readdirSync(dayDir).filter((f) => f.endsWith('.json'))) {
    const id = file.slice(0, -'.json'.length);
    const meta = JSON.parse(readFileSync(join(dayDir, file), 'utf8'));
    const hits = [
      String(meta.requestedModel ?? '').startsWith('mock-'),
      String(meta.baseUrl ?? '').includes('9911'),
      SEED_PROVIDERS.has(meta.providerName),
    ];
    const n = hits.filter(Boolean).length;
    const row = { day, id, prov: meta.providerName, model: meta.requestedModel, baseUrl: meta.baseUrl };
    if (n === 3) del.push(row);
    else if (n === 0) keep.push(row);
    else partial.push({ ...row, n });
  }
}

console.log(`\n真实记录 ${keep.length} 条（一条都不动）：`);
for (const r of keep) console.log(`   ${r.id}  ${r.prov} / ${r.model}`);

console.log(`\n演示记录 ${del.length} 条（待删）：`);
for (const r of del) console.log(`   ${r.id}  ${r.prov} / ${r.model}  ${r.baseUrl}`);

if (partial.length) {
  console.log(`\n只命中一部分、拿不准 ${partial.length} 条（不动）：`);
  for (const r of partial) console.log(`   ${r.id}  命中 ${r.n}/3  ${r.prov} / ${r.model}`);
}

// 断言：真实记录必须还在；演示记录必须是 24 条；两边不能有交集
if (keep.length === 0) {
  console.error('\n[拒绝执行] 一条真实记录都没扫到，路径不对？');
  process.exit(1);
}
if (del.length === 0) {
  console.error('\n[拒绝执行] 一条演示记录都没扫到，判据不对？');
  process.exit(1);
}
for (const k of keep) {
  if (del.some((d) => d.id === k.id)) {
    console.error(`\n[拒绝执行] ${k.id} 同时在保留和待删里，一条都不删。`);
    process.exit(1);
  }
}

if (!apply) {
  console.log(`\n（预览模式，什么都没删。确认无误后加 --apply）`);
  process.exit(0);
}

let files = 0;
for (const r of del) {
  for (const ext of EXTS) {
    const p = join(ROOT, r.day, `${r.id}${ext}`);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      files += 1;
    }
  }
}
console.log(`\n已删除 ${del.length} 条演示记录，共 ${files} 个文件。`);
