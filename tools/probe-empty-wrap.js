(async () => {
/* 全站最糟的那处本地化失效，量在真实容器里。
   英文空态提示句原来需要 687px，而 390px 手机上只有 350px 可用——
   也就是说那句英文在手机上从来没能被读完过。这里把真实字符串塞进真实的
   .empty 容器里量，而不是量一个我临时搭的盒子。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sw = [...document.querySelectorAll('.sw button')].find((b) => /EN/i.test(b.textContent || ''));
if (sw) {
  sw.click();
  await sleep(700);
}

const EMPTY_HEADING = 'NO RECORDS YET';
const EMPTY_HINT =
  'Pick a provider on the right, then press START RUN. Each run lands here as a channel with its own number.';

const host = document.querySelector('.empty') || document.querySelector('.rack-scroll');
if (!host) return { error: 'no .empty and no .rack-scroll' };

const probe = document.createElement('div');
probe.className = 'empty';
probe.style.position = 'absolute';
probe.style.left = '-9999px';
probe.style.width = host.getBoundingClientRect().width + 'px';
probe.innerHTML =
  '<span class="silk silk-note"></span><span class="silk silk-note" data-old></span>';
const h = probe.querySelector('.silk');
const old = probe.querySelector('[data-old]');
old.classList.remove('silk-note');
old.style.whiteSpace = 'nowrap';
h.textContent = EMPTY_HEADING;
old.textContent = EMPTY_HEADING;
const hintHtml = EMPTY_HINT;
document.body.appendChild(probe);

function measure(el, html) {
  const box = el.getBoundingClientRect();
  const prev = el.innerHTML;
  el.textContent = html;
  const h2 = el.getBoundingClientRect().height;
  const over = el.scrollWidth - el.clientWidth;
  el.innerHTML = prev;
  return { w: +box.width.toFixed(1), h: +h2.toFixed(1), overflow: +over.toFixed(1) };
}

// 换成一个带提示句的完整空态，量总高度和横向溢出
probe.innerHTML = '<span class="silk silk-note"></span><span data-hint></span>';
const head = probe.querySelector('.silk');
const hint = probe.querySelector('[data-hint]');
head.textContent = EMPTY_HEADING;
hint.textContent = EMPTY_HINT;

const hintBox = hint.getBoundingClientRect();
const hintCs = getComputedStyle(probe);
const lineH = parseFloat(hintCs.lineHeight) || 20.25;
const lines = Math.round(hintBox.height / lineH);

const out = {
  lang: document.documentElement.lang,
  hostClass: host.className,
  hostW: +host.getBoundingClientRect().width.toFixed(1),
  heading: {
    text: EMPTY_HEADING,
    w: +head.getBoundingClientRect().width.toFixed(1),
    h: +head.getBoundingClientRect().height.toFixed(1),
    overflow: +(head.scrollWidth - head.clientWidth).toFixed(1),
    wraps: getComputedStyle(head).whiteSpace,
  },
  headingOld: measure(old, EMPTY_HEADING),
  hint: {
    text: EMPTY_HINT,
    w: +hintBox.width.toFixed(1),
    h: +hintBox.height.toFixed(1),
    lines,
    lineHeight: lineH,
    overflow: +(hint.scrollWidth - hint.clientWidth).toFixed(1),
    docOverflow: +(document.documentElement.scrollWidth - document.documentElement.clientWidth).toFixed(1),
  },
  probeOverflow: +(probe.scrollWidth - probe.clientWidth).toFixed(1),
  probeH: +probe.getBoundingClientRect().height.toFixed(1),
};
probe.remove();
return out;
})()
