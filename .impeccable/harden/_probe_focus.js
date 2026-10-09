(() => {
  // 焦点环没法靠脚本 focus() 触发（:focus-visible 在无键盘交互时不匹配，实测 fvMatched 0），
  // 所以改成静态核对：把样式表里所有含 :focus-visible 的选择器抠出来，去掉伪类，
  // 再对每个可聚焦元素试匹配。能匹配上 = 至少有一条规则会给它画焦点环。
  const out = { rules: [], uncovered: [], covered: 0, checked: 0 };

  const strip = (sel) =>
    sel
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.includes(':focus-visible'))
      .map((s) => s.replace(/:focus-visible/g, '').trim() || '*');

  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const walk = (list, media) => {
      for (const r of list) {
        if (r.cssRules && r.conditionText !== undefined) {
          walk(r.cssRules, r.conditionText);
        } else if (r.selectorText && r.selectorText.includes(':focus-visible')) {
          out.rules.push({
            media: media || null,
            sel: r.selectorText,
            outline: `${r.style.outlineStyle} ${r.style.outlineWidth} ${r.style.outlineColor}`.trim(),
            offset: r.style.outlineOffset || null,
            boxShadow: r.style.boxShadow || null,
            borderColor: r.style.borderColor || null,
          });
        }
      }
    };
    walk(rules, null);
  }

  const bases = [];
  for (const r of out.rules) {
    if (r.media) continue; // 只按无媒体条件的规则判覆盖
    for (const b of strip(r.sel)) bases.push(b);
  }

  const all = [
    ...document.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => {
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && !el.disabled;
  });

  for (const el of all) {
    out.checked += 1;
    let hit = null;
    for (const b of bases) {
      try {
        if (el.matches(b)) {
          hit = b;
          break;
        }
      } catch {
        /* 选择器里可能还有别的伪类，跳过 */
      }
    }
    if (hit) out.covered += 1;
    else
      out.uncovered.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        id: el.id || null,
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20),
      });
  }

  // 去重，只留类名
  const seen = new Set();
  out.uncovered = out.uncovered.filter((x) => {
    const k = `${x.tag}|${x.cls}|${x.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return out;
})()
