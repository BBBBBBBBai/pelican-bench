/**
 * squareRectCorners 的单元断言。
 *
 * 为什么要单独留一个：smoke-sanitize 走的是整条链路，只覆盖双引号那一种写法；
 * 而这条规则最容易踩的坑恰好是「裸值 + 自闭合」——`rx=32/>` 里那个斜杠
 * 一旦被正则吃掉，<rect> 就变成没闭合的标签，整张图直接解析失败。
 * 这里把三种写法、跨行、大小写都钉死，跑法：npm run check:svg
 */
import { sanitizeSvg, squareRectCorners } from '../shared/svg.ts';

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const pass = got === want;
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) console.log(`        实际: ${JSON.stringify(got)}\n        期望: ${JSON.stringify(want)}`);
}

console.log('三种 rx 写法都要抹掉，且不能吃掉自闭合的斜杠：');
check(
  '双引号 rx="32"',
  squareRectCorners(`<svg><rect width="8" height="6" rx="32" fill="#fff"/></svg>`),
  `<svg><rect width="8" height="6" fill="#fff"/></svg>`,
);
check(
  '单引号 rx=\'32\'',
  squareRectCorners(`<svg><rect width="8" height="6" rx='32'/></svg>`),
  `<svg><rect width="8" height="6"/></svg>`,
);
check(
  '裸值 rx=32（自闭合斜杠必须还在）',
  squareRectCorners(`<svg><rect width="8" height="6" rx=32/></svg>`),
  `<svg><rect width="8" height="6"/></svg>`,
);
check('rx 与 ry 同时出现', squareRectCorners(`<svg><rect width="8" height="6" rx="4" ry="9"/></svg>`), `<svg><rect width="8" height="6"/></svg>`);
check('本来就没有 rx 的 rect 不动', squareRectCorners(`<svg><rect width="8" height="6" fill="#eee"/></svg>`), `<svg><rect width="8" height="6" fill="#eee"/></svg>`);
// 跨行写的 rect：这里断的是「语义」而不是逐字节相等——正则只会吃掉 rx 前面
// 的一个空白，剩下一个空格和换行。多一个空格对 XML 无影响，不值得为它写更复杂的正则。
const multiline = squareRectCorners(`<svg><rect\n  width="8"\n  rx="4"\n  height="6"/></svg>`);
check('跨行的 rect 也要认得（rx 已消失）', /\brx\s*=/.test(multiline), false);
check('跨行处理后仍是自闭合的单个 rect', /^<svg><rect[^>]*\/><\/svg>$/.test(multiline), true);
check('跨行处理后其它属性都在', /width="8"/.test(multiline) && /height="6"/.test(multiline), true);
check('大写 <RECT RX="5"> 同样处理', squareRectCorners(`<svg><RECT RX="5" width="8"/></svg>`), `<svg><RECT width="8"/></svg>`);

console.log('\n绝不能碰 <ellipse>：rx/ry 是它成立的必要条件，抹了就什么都看不见：');
const onlyEllipse = `<svg><ellipse cx="1" cy="2" rx="8" ry="10"/></svg>`;
check('只有 ellipse 时输出逐字节不变', squareRectCorners(onlyEllipse), onlyEllipse);
check(
  'ellipse 与 rect 混排：只动 rect',
  squareRectCorners(`<svg><ellipse cx="1" cy="2" rx="8" ry="10"/><rect width="8" height="6" rx="32"/></svg>`),
  `<svg><ellipse cx="1" cy="2" rx="8" ry="10"/><rect width="8" height="6"/></svg>`,
);
check('rx 出现在非 rect 标签上不碰', squareRectCorners(`<svg><image rx="5" href="#"/></svg>`), `<svg><image rx="5" href="#"/></svg>`);
check('<rectangle> 这种前缀相同的标签不能被误伤', squareRectCorners(`<svg><rectangle rx="5"/></svg>`), `<svg><rectangle rx="5"/></svg>`);

console.log('\n整条 sanitizeSvg 跑完，画该留下的还得留下：');
const full = sanitizeSvg(
  `<svg viewBox="0 0 10 10"><style>.a{fill:red}</style><rect width="10" height="10" rx="4" fill="url(#g)"/><ellipse rx="2" ry="3"/></svg>`,
);
check('style 块保留', /<style>/.test(full), true);
check('rect 圆角被抹平', /<rect[^>]*\brx=/.test(full), false);
check('ellipse 的 rx/ry 保留', /<ellipse rx="2" ry="3"\/>/.test(full), true);
check('rect 的其它属性没丢', /fill="url\(#g\)"/.test(full), true);

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`);
if (failures > 0) process.exitCode = 1;
