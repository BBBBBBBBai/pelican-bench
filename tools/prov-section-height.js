// 只量两版构建里都存在的元素，用来做 A/B 对照：
// 新代码给名册节外面包了一层 `.prov-head`（多一条 border-bottom + 10px padding，
// 同时把 `.bay-head` 自己的 11px 下边距收成 0），要确认这一节的总高**没有漂移**。
// 因此这里绝不 querySelector('.prov-head') —— 旧构建里没有它。
// 用法：node tools/edge-cdp.mjs probe <url> --width=390 --height=844 --mobile --touch --do=tools/prov-section-height.js
const box = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    marginBottom: cs.marginBottom, paddingBottom: cs.paddingBottom, borderBottom: cs.borderBottomWidth,
  };
};
return {
  viewport: { w: window.innerWidth, h: window.innerHeight },
  // 名册节（供应商那一节）
  section: box('.bay-section'),
  head: box('.bay-head'),
  // 名册列表与第一节的关系（不依赖 prov-head）
  roster: box('.roster'),
  slot: box('.roster .slot'),
  // 整个右栏与页面高度
  panel: box('.panel'),
  panelScroll: box('.panel-scroll'),
  pageH: document.documentElement.scrollHeight,
  // 供应商节后面的第二节起点，用来核对「下一节没有被推下去」
  sections: [...document.querySelectorAll('.bay-section')].map((el) => {
    const r = el.getBoundingClientRect();
    return { y: +r.y.toFixed(1), h: +r.height.toFixed(1) };
  }),
};
