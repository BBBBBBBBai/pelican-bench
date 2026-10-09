import { extractSvg, sanitizeSvg } from '@shared/svg';

export interface SvgCheck {
  ok: boolean;
  reason?: string;
}

/**
 * 渲染前的可判定性检查：能不能被浏览器解析成一个 SVG 根节点。
 * 用来打「渲染失败」标签——不靠 iframe 内部回报，判定确定且可复现。
 */
export function checkSvg(raw: string | null): SvgCheck {
  if (!raw || !raw.trim()) return { ok: false, reason: '空内容' };

  const extracted = extractSvg(raw);
  if (!extracted) return { ok: false, reason: '没有 <svg> 根节点' };

  const cleaned = sanitizeSvg(extracted);
  if (!/<svg[\s>]/i.test(cleaned)) return { ok: false, reason: '没有 <svg> 根节点' };

  try {
    const doc = new DOMParser().parseFromString(cleaned, 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    if (err) return { ok: false, reason: 'XML 解析失败' };
    if (doc.documentElement?.nodeName.toLowerCase() !== 'svg') {
      return { ok: false, reason: '根节点不是 svg' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
