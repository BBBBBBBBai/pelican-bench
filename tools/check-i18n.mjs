/**
 * check-i18n.mjs —— i18n 键完整性检查。
 * 1. 每个 t('key') 是否都在字典里
 * 2. 字典里每个键是否都真的有 zh 和 en 两个值（不能有一个语言缺失）
 * 3. 有没有孤儿键（定义了但从没用过）
 * 用法：node tools/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const I18N = 'web/src/i18n.ts';
const src = readFileSync(I18N, 'utf8');

// ---- 字典：抓 'key': { zh: ..., en: ... } ----
// 先按行扫，记录每个键出现的位置，再在原串里找出它到下一个键之间的片段
const dict = new Map();
const keyRe = /^\s{2}'([a-zA-Z0-9_.\-]+)':\s*\{/gm;
const entries = [];
let m;
while ((m = keyRe.exec(src)) !== null) entries.push({ key: m[1], at: m.index, end: keyRe.lastIndex });
for (let i = 0; i < entries.length; i += 1) {
  const body = src.slice(entries[i].end, i + 1 < entries.length ? entries[i + 1].at : src.length);
  const zh = /(?:^|[\s{,])zh:\s*(['"`])((?:\\.|(?!\1).)*)\1/s.exec(body);
  const en = /(?:^|[\s{,])en:\s*(['"`])((?:\\.|(?!\1).)*)\1/s.exec(body);
  dict.set(entries[i].key, {
    zh: zh ? zh[2] : null,
    en: en ? en[2] : null,
    hasZh: Boolean(zh),
    hasEn: Boolean(en),
  });
}

// ---- 用法：扫所有源文件里的 t('...') 与 t(`...`) ----
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (['.ts', '.tsx'].includes(extname(p))) acc.push(p);
  }
  return acc;
}
const files = walk('web/src');
const literal = new Map(); // key -> [files]
const template = new Set();
// 匹配整个 t(...) 调用的参数区，直到配对的右括号；参数里可能出现三元
// t(cond ? 'a' : 'b')、t('k', { … })、t(`flag.${x}`)
const callRe = /\bt\(/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/');
  let c;
  while ((c = callRe.exec(s)) !== null) {
    // 从 t( 之后开始，按括号深度找配对的右括号
    let depth = 1;
    let i = callRe.lastIndex;
    let inStr = null;
    while (i < s.length && depth > 0) {
      const ch = s[i];
      if (inStr) {
        if (ch === '\\') i += 1;
        else if (ch === inStr) inStr = null;
      } else if (ch === "'" || ch === '"' || ch === '`') inStr = ch;
      else if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    const args = s.slice(callRe.lastIndex, i - 1);
    // 参数区里所有字符串字面量都算「用到了」（含三元与 as 断言）
    for (const mm of args.matchAll(/'([a-zA-Z0-9_.\-]+)'/g)) {
      if (!literal.has(mm[1])) literal.set(mm[1], []);
      if (!literal.get(mm[1]).includes(rel)) literal.get(mm[1]).push(rel);
    }
    for (const mm of args.matchAll(/`([^`]+)`/g)) template.add(mm[1]);
  }
}

const missing = [...literal.keys()].filter((k) => !dict.has(k));
const orphans = [...dict.keys()].filter((k) => !literal.has(k));
const halfTranslated = [...dict.entries()].filter(([, v]) => !v.hasZh || !v.hasEn).map(([k, v]) => `${k} (zh:${v.hasZh} en:${v.hasEn})`);

console.log(`dict keys:        ${dict.size}`);
console.log(`literal t() keys: ${literal.size}`);
console.log(`template t() keys: ${template.size ? [...template].join(', ') : '(none)'}`);
console.log('');
console.log(`[1] USED BUT NOT IN DICT (${missing.length}):`, missing.length ? missing : '(none)');
console.log(`[2] IN DICT BUT NEVER USED (${orphans.length}):`, orphans.length ? orphans : '(none)');
console.log(`[3] MISSING A LANGUAGE (${halfTranslated.length}):`, halfTranslated.length ? halfTranslated : '(none)');

// ---- 双语长度比：找出最容易被挤爆的字符串 ----
const ratios = [...dict.entries()]
  .filter(([, v]) => v.hasZh && v.hasEn && v.zh && v.en)
  .map(([k, v]) => ({ key: k, zh: v.zh.length, en: v.en.length, ratio: Math.round((v.en.length / v.zh.length) * 100) / 100 }))
  .sort((a, b) => b.ratio - a.ratio);
console.log('');
console.log('[4] LONGEST EN/ZH EXPANSION (top 8):');
ratios.slice(0, 8).forEach((r) => console.log(`    ${String(r.ratio).padEnd(5)} ${r.key.padEnd(26)} zh=${String(r.zh).padStart(3)} en=${String(r.en).padStart(3)}`));
const avg = ratios.reduce((a, b) => a + b.ratio, 0) / ratios.length;
console.log(`    average EN/ZH ratio across ${ratios.length} strings: ${Math.round(avg * 100) / 100}`);

process.exit(missing.length || halfTranslated.length ? 1 : 0);
