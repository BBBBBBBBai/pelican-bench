/**
 * probe-colorscheme.js —— 暗色仪器有没有声明 color-scheme。
 * 没有声明时，浏览器自带的那一层（select 弹出的下拉、滚动条、表单控件、
 * 首屏画布）会按亮色方案渲染 —— 与 ::selection / caret-color / 滚动条都上了色的
 * 其余部分不一致。用 --expr 传给 edge-cdp.mjs。
 */
(async () => {
  const html = document.documentElement;
  const body = document.body;
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const sel = document.querySelector('select');
  const out = {
    htmlColorScheme: cs(html).colorScheme,
    bodyColorScheme: cs(body).colorScheme,
    selectColorScheme: sel ? cs(sel).colorScheme : null,
    // 浏览器在没声明 color-scheme 时用的画布底色
    canvasColor: getComputedStyle(html).backgroundColor,
    bodyBg: cs(body).backgroundColor,
    // 表单控件外观：auto 表示交给系统（亮色）
    selectAppearance: sel ? cs(sel).appearance : null,
    inputAppearance: (() => { const i = document.querySelector('input[type=text]'); return i ? cs(i).appearance : null; })(),
    metaColorScheme: (() => { const m = document.querySelector('meta[name="color-scheme"]'); return m ? m.content : null; })(),
    // ::selection / caret 已上色（对照组，证明「浏览器那层」确实被照顾了）
    caretColor: cs(html).caretColor,
    scrollbarColor: cs(html).scrollbarColor,
  };
  return out;
})()
