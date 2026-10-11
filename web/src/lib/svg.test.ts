import { describe, expect, it } from 'vitest';
import {
  extractSvg,
  looksTruncated,
  prepareSvgForImg,
  sanitizeSvg,
  squareRectCorners,
  wrapSvgForIframe,
} from '@shared/svg';

/**
 * SVG 这一层的两个职责各测一半：
 *   - `extractSvg` / `looksTruncated` 决定「这一趟算不算成功」，
 *     判错会让一条好记录被打上 not-svg，或者一条废记录被当成干净成功；
 *   - `sanitizeSvg` 系列把模型输出（不可信内容）送进渲染之前做减法，
 *     漏一个 `onload` 就是把别人服务器上的脚本请进了本页。
 */

describe('extractSvg：从模型输出里抠出 SVG', () => {
  const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

  it('裸的 SVG 原样取出', () => {
    expect(extractSvg(svg)).toBe(svg);
  });

  it('前后有废话也能取出', () => {
    expect(extractSvg(`这是你要的画：\n${svg}\n希望满意。`)).toBe(svg);
  });

  it('优先取 ``` 代码块里的那一份', () => {
    const raw = `先解释一下\n\`\`\`svg\n${svg}\n\`\`\`\n就这样`;
    expect(extractSvg(raw)).toBe(svg);
  });

  it('被截断的（有开标签、没有闭标签）仍然取出来，好让人看见画到哪', () => {
    const cut = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/><path d="M0';
    expect(extractSvg(cut)).toBe(cut);
    expect(looksTruncated(cut)).toBe(true);
  });

  it('半截的开标签不算 SVG —— 抽出来也渲染不了', () => {
    expect(extractSvg('正在写 <svg ')).toBeNull();
    expect(extractSvg('<svg')).toBeNull();
  });

  it('压根没有 SVG 的返回 null', () => {
    expect(extractSvg('这道题我不会')).toBeNull();
    expect(extractSvg('')).toBeNull();
  });
});

describe('looksTruncated', () => {
  it('完整的不算截断', () => {
    expect(looksTruncated('<svg><g/></svg>')).toBe(false);
  });

  it('没有 SVG 的更不算截断（那是另一件事：not-svg）', () => {
    expect(looksTruncated('什么都没有')).toBe(false);
  });
});

describe('squareRectCorners：只抹 <rect> 的圆角', () => {
  it('双引号 / 单引号 / 裸值三种写法都能抹掉', () => {
    expect(squareRectCorners('<rect x="1" y="2" rx="8" ry="8"/>')).toBe('<rect x="1" y="2"/>');
    expect(squareRectCorners("<rect rx='4'/>")).toBe('<rect/>');
    expect(squareRectCorners('<rect rx=8/>')).toBe('<rect/>');
  });

  it('自闭合的斜杠不能被吃掉', () => {
    // 裸值那条规则要排掉 `/`，否则 `rx=32/>` 会变成 `<rect`（没闭合的标签）
    expect(squareRectCorners('<rect rx=32/>')).not.toContain('<rect rx');
    expect(squareRectCorners('<rect rx=32/>')).toContain('/>');
  });

  it('不动 <ellipse> —— 它的 rx/ry 是它成立的必要条件', () => {
    const ellipse = '<ellipse cx="5" cy="5" rx="5" ry="3"/>';
    expect(squareRectCorners(ellipse)).toBe(ellipse);
  });
});

describe('sanitizeSvg：渲染前的减法', () => {
  it('删掉成对的 <script>', () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><rect/></svg>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
  });

  it('删掉 <foreignObject>（能带进来一整段 HTML）', () => {
    const out = sanitizeSvg('<svg><foreignObject><div>x</div></foreignObject></svg>');
    expect(out.toLowerCase()).not.toContain('foreignobject');
  });

  it('删掉 on* 事件属性', () => {
    expect(sanitizeSvg('<svg onload="x()"><rect/></svg>')).toBe('<svg><rect/></svg>');
    expect(sanitizeSvg("<svg onload='x()'><rect/></svg>")).toBe('<svg><rect/></svg>');
  });

  it('外联 href 删掉，内部 # 引用留着（渐变和裁剪路径全靠它）', () => {
    const out = sanitizeSvg('<svg><image href="https://evil.example/a.png"/><use href="#grad"/></svg>');
    expect(out).not.toContain('evil.example');
    expect(out).toContain('href="#grad"');
  });

  it('javascript: 协议删掉', () => {
    const out = sanitizeSvg('<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>');
    expect(out).not.toContain('javascript:');
  });

  it('XML 声明与 doctype 删掉（iframe 里不需要）', () => {
    const out = sanitizeSvg('<?xml version="1.0"?><!DOCTYPE svg><svg><rect/></svg>');
    expect(out).not.toContain('<?xml');
    expect(out.toLowerCase()).not.toContain('doctype');
    expect(out.startsWith('<svg')).toBe(true);
  });
});

describe('prepareSvgForImg', () => {
  it('补上 100% 尺寸与 preserveAspectRatio', () => {
    const out = prepareSvgForImg('<svg viewBox="0 0 10 10"><rect/></svg>');
    expect(out).toContain('width="100%"');
    expect(out).toContain('height="100%"');
    expect(out).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it('已经有了的就不重复补', () => {
    const out = prepareSvgForImg('<svg width="10" height="10"><rect/></svg>');
    expect(out).not.toContain('width="100%"');
    expect(out).not.toContain('height="100%"');
  });
});

describe('wrapSvgForIframe', () => {
  it('带内联 CSP：禁脚本、禁一切外部请求', () => {
    const html = wrapSvgForIframe('<svg viewBox="0 0 10 10"><rect/></svg>');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('img-src data:');
  });

  it('有 viewBox 才敢拉满整帧（没有就只做「不超过」）', () => {
    expect(wrapSvgForIframe('<svg viewBox="0 0 10 10"><rect/></svg>')).toContain(
      'svg{width:100%;height:100%;display:block}',
    );
    expect(wrapSvgForIframe('<svg width="10"><rect/></svg>')).toContain(
      'svg{max-width:100%;max-height:100%;display:block}',
    );
  });

  it('底色写进样式', () => {
    expect(wrapSvgForIframe('<svg><rect/></svg>', '#ffffff')).toContain('background:#ffffff');
  });
});
