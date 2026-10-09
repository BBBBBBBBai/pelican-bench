// 审计用：验证 shared/svg.ts 的 sanitizeSvg() 对「斜杠分隔的事件属性」是否漏过。
// 目的：确认消毒器是否只认前置空白，从而放过 <svg/onload=…>。
// 跑法：node --experimental-strip-types tools/probe-sanitize.mjs
import { sanitizeSvg, prepareSvgForImg } from '../shared/svg.ts';

const cases = [
  '<svg onload="alert(1)"></svg>',
  "<svg/onload=alert(1)></svg>",
  '<svg\nonload="alert(1)"></svg>',
  '<svg\tonload=alert(1)></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<svg><a xlink:href="http://evil.test/x">x</a></svg>',
  '<rect fill="url(javascript:alert(1))"/>',
];

for (const src of cases) {
  const out = sanitizeSvg(src);
  console.log(`IN : ${src}`);
  console.log(`OUT: ${out}`);
  console.log(`leftover-on*: ${/\bon[a-z]+\s*=/i.test(out)}`);
  console.log('---');
}

// prepareSvgForImg 是 <img src> 那条路径实际用的函数
console.log('prepareSvgForImg(<svg/onload=alert(1)></svg>) =>', prepareSvgForImg('<svg/onload=alert(1)></svg>'));
