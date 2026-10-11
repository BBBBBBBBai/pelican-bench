import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 产物是一堆静态文件，它不该挑自己被放在哪儿：GitHub Pages 的项目页、内网某个目录、
 * `vite preview` 挂在非根路径 —— 全都得能用。
 *
 * `vite.config.ts` 里的 `base: './'` 只治构建时注入的那几个地址（脚本、样式、字体），
 * 组件里自己写死的绝对地址它管不着。而这种地址一旦漏下一个，放到子路径下就是白屏，
 * 而且**在有数据的那台机器上才看得出来**。
 *
 * 这条用例补的是一次真实事故：名册里每一格的缩略图原来写的是
 * `<img src={`/api/records/${record.id}/svg`}>` —— 后端删掉之后它没被一起删，
 * 于是每一格都在请求一个已经不存在的接口。注释里提到旧写法不算违规，
 * 所以下面那台小扫描器会自己认块注释。
 */
// 这个文件自己住在 src/test/ 里，扫的是上一层的整个 src/
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /\.test\.tsx?$/;
/** `<img src="/..."` 与 `<img src={`/...`}` 两种写法都要逮住 */
const ABSOLUTE_SRC = /\bsrc=\{?\s*["'`]\/[^"'`]*["'`]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !SKIP.test(entry.name)) out.push(full);
  }
  return out;
}

/** 逐行扫，但跳过注释 —— 只认真代码里的地址 */
function offendingLines(source: string): { line: number; text: string }[] {
  const bad: { line: number; text: string }[] = [];
  let inBlock = false;

  source.split('\n').forEach((raw, i) => {
    const t = raw.trim();
    const wasInBlock = inBlock;
    if (inBlock && t.includes('*/')) inBlock = false;
    if (!inBlock && !wasInBlock && t.startsWith('/*')) inBlock = !t.includes('*/');

    if (wasInBlock || inBlock || t.startsWith('//') || t.startsWith('/*')) return;
    if (ABSOLUTE_SRC.test(raw)) bad.push({ line: i + 1, text: t });
  });

  return bad;
}

describe('静态产物不许写死以 / 开头的资源地址', () => {
  it('组件里每个 src 都是相对路径或运行时算出来的', () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(10); // 走错了目录就会「一条都没问题」地通过

    const bad: string[] = [];
    for (const file of files) {
      for (const hit of offendingLines(readFileSync(file, 'utf8'))) {
        bad.push(`${path.relative(SRC, file)}:${hit.line}  ${hit.text}`);
      }
    }

    expect(bad).toEqual([]);
  });

  it('扫描器认得出真代码、也认得下注释', () => {
    expect(offendingLines('const a = <img src="/api/x" />;')).toHaveLength(1);
    expect(offendingLines('const a = <img src={"/api/" + id} />;')).toHaveLength(1);
    expect(offendingLines('const a = <img src="./logo.svg" />;')).toHaveLength(0);
    expect(offendingLines('const a = <img src={blobUrl} />;')).toHaveLength(0);
    expect(offendingLines('/* 旧写法 src="/api/x" */')).toHaveLength(0);
    expect(offendingLines('/**\n * 旧写法 src="/api/x"\n */')).toHaveLength(0);
  });
});
