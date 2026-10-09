/**
 * SVG 清洗与沙箱包装。
 * 模型输出是不可信内容：渲染前必须去掉可执行/可外联的部分，
 * 再放进 sandbox iframe，并叠一层内联 CSP。
 *
 * 前后端共用：后端只负责「抽出 SVG」，渲染前由前端调用这里清洗。
 */

/** 从模型输出里抽出 SVG 源码（前后端共用同一套规则，保证判定一致） */
export function extractSvg(raw: string): string | null {
  if (!raw) return null;

  const candidates: string[] = [];

  // 1) 优先取 markdown 代码块里的 svg
  const fence = raw.match(/```(?:svg|xml|html)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1]);

  // 2) 取完整的 <svg ...>...</svg>
  const direct = raw.match(/<svg[\s\S]*?<\/svg\s*>/i);
  if (direct?.[0]) candidates.push(direct[0]);

  // 3) 容错：有 <svg 开头但没有闭合（被截断），仍保留以便用户看到画到哪
  const open = raw.match(/<svg[\s\S]*$/i);
  if (open?.[0]) candidates.push(open[0]);

  candidates.push(raw);

  // 要求开标签本身是完整的（`<svg ...>`）：只切到 `<svg ` 这种半截标签没有渲染价值，
  // 应当算作「没抽到 SVG」，让上游去打 not-svg / truncated 标签。
  for (const c of candidates) {
    if (/<svg\b[^>]*>/i.test(c)) return c.trim();
  }
  return null;
}

/** 是否看起来被截断（有 svg 开标签但没有闭合标签） */
export function looksTruncated(raw: string): boolean {
  return /<svg[\s>]/i.test(raw) && !/<\/svg\s*>/i.test(raw);
}

const DANGEROUS_TAGS = [
  'script',
  'foreignObject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'animate',
  'set',
  'handler',
  'link',
  'meta',
  'base',
];

/**
 * 把 <rect> 的圆角抹平，对齐页面的直角形式语言。
 *
 * 只动 <rect> 的 rx/ry：`<ellipse>` 的 rx/ry 是它成立的必要条件，
 * 全局清洗会让画面上的眼睛、石子、地面阴影全部消失。
 * 只作用于「渲染给人看」的这一层，落盘的 svg 源码原样可回溯（PRODUCT.md 第 1 条）；
 * 画作本身的底色、构图、笔触都不碰，工具不替模型补台面。
 */
export function squareRectCorners(svg: string): string {
  return svg.replace(/<rect\b[^>]*>/gi, (tag) =>
    // 三种写法都要覆盖：rx="8"、rx='8'、rx=8
    // 裸值那一条要排掉 `/`，否则 `rx=32/>` 会把自闭合的斜杠一起吃掉，留下一个没闭合的 <rect>
    tag
      .replace(/\s(?:rx|ry)\s*=\s*"[^"]*"/gi, '')
      .replace(/\s(?:rx|ry)\s*=\s*'[^']*'/gi, '')
      .replace(/\s(?:rx|ry)\s*=\s*[^\s>/]+/gi, '')
  );
}

/** 清洗 SVG：去掉脚本、外联引用与事件属性，并把 <rect> 的圆角抹平 */
export function sanitizeSvg(svg: string): string {
  let out = svg;

  // XML 声明与 doctype 在 iframe 内不需要，且容易干扰
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // 圆角：全站只有 0 和指示灯那个 50%（DESIGN.md）
  out = squareRectCorners(out);

  // 危险标签（成对与自闭合两种写法都处理）
  for (const tag of DANGEROUS_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  // 事件属性 on*="..."
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  // 外联引用（保留 #内部引用，如渐变、裁剪路径）
  out = out.replace(/\s(?:xlink:)?href\s*=\s*"(?!#)[^"]*"/gi, '');
  out = out.replace(/\s(?:xlink:)?href\s*=\s*'(?!#)[^']*'/gi, '');

  // javascript: 协议
  out = out.replace(/javascript:/gi, '');

  return out.trim();
}

/**
 * 为 <img src> 场景准备 SVG：补上 100% 尺寸，让它填满外层盒子。
 * <img> 加载 SVG 不会执行脚本，是画廊缩略图最安全的渲染方式；
 * 配合外层 CSS（width/height 100% + object-fit: contain）保证留白一致。
 */
export function prepareSvgForImg(svg: string): string {
  const cleaned = sanitizeSvg(svg);
  return cleaned.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    let next = attrs;
    if (!/\swidth\s*=/i.test(next)) next += ' width="100%"';
    if (!/\sheight\s*=/i.test(next)) next += ' height="100%"';
    if (!/preserveAspectRatio/i.test(next)) next += ' preserveAspectRatio="xMidYMid meet"';
    return `<svg${next}>`;
  });
}

/**
 * 包装成独立 HTML 文档，用于 iframe srcDoc。
 * 内联 CSP 再兜一层：禁止脚本与任何外部请求。
 *
 * 有 viewBox 的 SVG 会被拉满整帧（preserveAspectRatio 负责按比例居中留白）——
 * 否则模型写死在根标签上的 width="200" 会让它在标本页上小成一张邮票，
 * 而标本页存在的唯一理由就是把这张画看清楚。没有 viewBox 的不敢拉，
 * 拉了会变形，只做「不超过」的约束。
 */
export function wrapSvgForIframe(svg: string, background = 'transparent'): string {
  const cleaned = sanitizeSvg(svg);
  const hasViewBox = /<svg[^>]*\sviewBox\s*=/i.test(cleaned);
  const sizing = hasViewBox
    ? 'svg{width:100%;height:100%;display:block}'
    : 'svg{max-width:100%;max-height:100%;display:block}';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<style>
  html,body{margin:0;padding:0;height:100%;background:${background};overflow:hidden}
  ${sizing}
</style>
</head><body>${cleaned}</body></html>`;
}
