/**
 * 验检测器报的 text-occlusion 是不是真的：
 *   div.note「只影响这一次运行…」（在 .fold 里）被 button.btn.arm.xl.wide 100% 盖住？
 * 如果那个 note 属于一个关着的 <details>，它的面积应当是 0 ——
 * 那样「100% 被盖住」就是退化情形，是假阳性，不能写进报告。
 */
const out = {};

const note = [...document.querySelectorAll('div.note')].find((n) => n.textContent.includes('只影响这一次运行'));
out.noteFound = !!note;
if (note) {
  const r = note.getBoundingClientRect();
  const st = getComputedStyle(note);
  const fold = note.closest('details');
  out.note = {
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    area: Math.round(r.width * r.height),
    display: st.display,
    visibility: st.visibility,
    opacity: st.opacity,
    inClosedFold: fold ? !fold.open : false,
    foldOpen: fold ? fold.open : null,
    // 该元素到底占不占布局
    offsetParent: note.offsetParent ? note.offsetParent.className || note.offsetParent.tagName : null,
  };
  // ::details-content 的 content-visibility 决定了关着的抽屉还占不占位置
  if (fold) {
    const dc = getComputedStyle(fold, '::details-content');
    out.detailsContent = {
      contentVisibility: dc.contentVisibility,
      blockSize: dc.blockSize,
      overflow: dc.overflow,
    };
    const fr = fold.getBoundingClientRect();
    out.foldRect = [Math.round(fr.left), Math.round(fr.top), Math.round(fr.width), Math.round(fr.height)];
    const fb = fold.querySelector('.fold-body');
    if (fb) {
      const br = fb.getBoundingClientRect();
      out.foldBodyRect = [Math.round(br.left), Math.round(br.top), Math.round(br.width), Math.round(br.height)];
      out.foldBodyArea = Math.round(br.width * br.height);
    }
  }
}

// 运行按钮的位置，看它和那个 note 是否真的重叠
const runBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始生成'));
if (runBtn) {
  const r = runBtn.getBoundingClientRect();
  out.runBtn = { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], cls: runBtn.className };
}

// 抽屉关上时，它下面那个运行按钮在什么位置？用来核对布局是否被关着的抽屉撑开
out.foldVsRunGap = (out.foldRect && out.runBtn) ? out.runBtn.rect[1] - (out.foldRect[1] + out.foldRect[3]) : null;

// 把抽屉打开再量一次：如果 note 之前面积是 0，现在应当有面积
const fold = document.querySelector('details.fold');
if (fold) {
  fold.open = true;
  out.foldOpenedRect = (() => { const r = fold.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })();
  const n2 = [...document.querySelectorAll('div.note')].find((n) => n.textContent.includes('只影响这一次运行'));
  if (n2) {
    const r = n2.getBoundingClientRect();
    out.noteWhenOpen = { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], area: Math.round(r.width * r.height) };
  }
  const rb = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始生成'));
  if (rb) {
    const r = rb.getBoundingClientRect();
    out.runBtnWhenOpen = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  }
  fold.open = false;
}

return JSON.stringify(out, null, 1);
