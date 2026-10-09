/**
 * 后端侧的 SVG 处理：实现放在 shared/svg.ts，前后端共用同一套规则，
 * 保证「后端判定能抽出 SVG」与「前端判定能渲染」不会出现分歧。
 */
export { extractSvg, looksTruncated, sanitizeSvg, wrapSvgForIframe } from '../shared/svg.ts';
