import { useMemo } from 'react';
import { extractSvg, sanitizeSvg, wrapSvgForIframe } from '@shared/svg';

/**
 * 把一段 SVG 放进沙箱 iframe 里渲染。
 *
 * 三层防护叠在一起：提取 → 剥掉危险标签 → 沙箱 iframe + 内联 CSP。
 * sandbox="" 连脚本都不给（没有 allow-scripts），所以哪怕清洗漏了什么也跑不起来。
 * 详情页里仍然保留「看源码」入口，那里显示的是未经清洗的原文。
 */
export function SvgFrame({ svg, title, fallback = '—' }: { svg: string; title?: string; fallback?: string }) {
  const doc = useMemo(() => {
    const extracted = extractSvg(svg);
    if (!extracted) return '';
    return wrapSvgForIframe(sanitizeSvg(extracted));
  }, [svg]);

  if (!doc) {
    return (
      <div className="broken">
        <span className="silk">{fallback}</span>
      </div>
    );
  }

  return <iframe title={title ?? 'svg'} srcDoc={doc} sandbox="" referrerPolicy="no-referrer" loading="lazy" />;
}
