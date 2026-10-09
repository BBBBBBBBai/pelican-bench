// 交叉核对：TSX/TS 里用到的每个 className，恢复回来的 CSS 里是否都有规则。
// 这是「1 字节事故」之后确认抢救完整的最后一道关 —— 光看几行锚点不够，
// 要确认没有任何一个类在恢复过程中被丢掉。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync('web/src/styles.css', 'utf8');
const cssClasses = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})('web/src');

const used = new Map();
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  // className="a b c"  和  className={`a ${cond ? 'b' : ''}`}
  for (const m of s.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = m[1] ?? m[2] ?? '';
    for (const tok of raw.split(/[\s`$]+/)) {
      const t = tok.trim();
      if (!t || /[{}?:()'"]/.test(t)) continue;
      if (!/^[a-z][\w-]*$/.test(t)) continue;
      if (!used.has(t)) used.set(t, f);
    }
  }
}

const missing = [...used].filter(([c]) => !cssClasses.has(c));
console.log('css classes:', cssClasses.size, '| used in tsx/ts:', used.size);
if (!missing.length) {
  console.log('OK — every className used in TSX/TS has a rule in the recovered CSS');
} else {
  console.log('MISSING from css:');
  for (const [c, f] of missing) console.log('  ', c, '<-', f);
}
