# 手机适配：顶部收成一行、控制台提到机架之前

## 任务

用户原话（m00817）：

> 手机端顶部太占位置，底部生成模块太远，要滑动好几次才能看见

这是两个独立的毛病，追问后用户各自拍板（m01720）：

| # | 分支 | 决定 | 依据 |
|---|---|---|---|
| 1 | 模块位置 | **整块提到机架之前**（`.panel` 挪到 `.bay` 前面），打开即见供应商 + 模型 + 开始生成 | 只压缩「开始生成」与画廊之间的顺序，不动任何内容 |
| 2 | 顶部 | **收成一行摘要，点开才展开全部筛选项** | 复用既有的 `.fold` / `.prov-slot` 那一套 `interpolate-size` 编排动作，不新增动画 |

第一条是「把要用的东西挪到手边」，第二条是「把不常用的东西折起来」——都不是缩放像素。

## 改前的实测（390×844，`tools/edge-cdp.mjs --mobile --touch`）

- `pageH 5614`，整页滚（`.rack-scroll` / `.panel-scroll` 都不是滚动容器）。
- 顶部 chrome 合计 **326px = 首屏的 38.6%**：`.busbar` 88px（`flex-wrap` 折成两行）+ `.rail` **238px**（四个筛选组挤成四行）。
- `.rail` 是 `position: sticky; top: 0`，`.rack-band`（日期带）也是 `sticky; top: 0` —— **两者抢同一个顶端**：滚到 900 时横杆钉在 0 高 238，日期带被压到 **y = −574**，`elementFromPoint(180, 20)` 命中的是横杆里的按钮。238px 常驻吃掉 28% 的视口。
- `.panel` 排在整面机架之后（`top 4506.8`），「开始生成」在 **y 5232.7** —— 从首屏到它约 **5 屏**。
- 触控落点：`.sw > button` 高 **25px**、`.detents > button` 高 **29px**、`.rail select` 29px、`.btn` 33px、`.mp-cell` 28px —— 全在 44px 之下。

## 改动

不是 git 仓库，以下是手写清单。

### `web/index.html`

viewport 加 `viewport-fit=cover`。不加的话 `env(safe-area-inset-*)` 恒为 0，底部那条安全区就是白写的。

### `web/src/App.tsx`

`.bench` 的三个直接子节点改成 **总线条 → 控制台 → 机架**（原来控制台排在机架后面）。宽屏靠网格把它放回右列，屏幕上看到的还是原来那一台。

### `web/src/components/Rack.tsx`

`.rail` 拆成两层：`.rail-line`（常驻摘要行）+ `.rail-full`（全部控件）。原来的 JSX 逐字搬进 `.rail-full > .rail-groups`，一个控件都没删——只是套了两层容器。摘要只列**非默认值**：

```tsx
const active: string[] = [];
if (profile !== 'all') active.push(profiles.find((p) => p.id === profile)?.name ?? profile);
if (promptId !== 'all') active.push(prompts.find((p) => p.id === promptId)?.label ?? promptId);
if (order === 'old') active.push(t('rail.old'));
if (size !== 'm') active.push(t(size === 's' ? 'rail.dense' : 'rail.wide'));
if (onlyIssues) active.push(t('rail.onlyIssues'));
```

一个都没改时显示 `t('rail.all')`。开关键带 `aria-expanded` 与 `aria-controls="rail-full"`。

### `web/src/i18n.ts`

新增一个 key：`'rail.filters': { zh: '筛选', en: 'FILTERS' }`。

### `web/src/styles.css`

- `:root` 新增 `--rail-line-h: 44px`、`--safe-b/--safe-l/--safe-r: env(safe-area-inset-*, 0px)`。`--switch-h: 44px` 原来声明了没人用，这次真的用上了。
- `.bench` 改用 `grid-template-areas`（`'bus bus' / 'bay panel'`）而不是靠 DOM 顺序——手机单列时控制台要挪到机架前面。同时吃到安全区（左右与底部）。
- `.rail` 宽屏时仍是 `flex-wrap: wrap`；`≤900px` 收成 sticky 的一行 45px。
- `≤900px`：`.bench` 单列 `'bus' / 'panel' / 'bay'`；`.panel` 去掉左边框改上边框；`.bay{min-height:70vh}`；**`.rack-scroll{flex:none;overflow:visible}`** —— 单列时那句 `overflow-y: auto` 是个「假滚动」：它自己不滚却构成滚动容器，把里面 `.rack-band` 的 sticky 关在盒子里。
- `.rack-band` 在窄屏钉 `calc(var(--rail-line-h) + 1px)`（+1px 是横杆那条 `border-bottom`），让两条粘性不再互相压。
- 新增 `@media (pointer: coarse)`（**按主指针判断，不按宽度** —— 带触屏的笔记本两个指针都真，那里主要用鼠标）：`.sw > button` / `.detents > button` / `.btn` / 输入框 / `.mp-cell` / `.fold > summary` / `.check` 全部抬到 `--switch-h`；`.check input` 14px → 20px；**`#mp-grid` 从固定 220px 改成 `calc(var(--switch-h) * 3 + 2px)`**（固定 220px 在手机上等于四行，会把「开始生成」顶出首屏；改成三行仍与内容无关）；`.ch:hover .ch-plate{filter:none}`（手指没有 hover）。
- 新增手机横屏档 `(max-width: 900px) and (min-width: 560px) and (max-height: 520px)`：回两列、控制台右侧 300px、各自滚自己的。
- `@media (max-width: 620px)` 把 `.bay-section` 内边距收到 12px，`.run-facts` 每行收到 28px —— 控制台现在是首屏，每一 px 都是从「够不够得着开始生成」里省出来的。
- `prefers-reduced-motion` 下横杆展开直接跳变。

## 改后实测

### 顶部与位置（390×844）

| 量 | 改前 | 改后 |
|---|---|---|
| 整页高 | 5614px | **5426px** |
| `.rail` 高度 | 238px | **45px** |
| `.rail` 摘要行 | 无 | 44px（`全部` + `显示 28 / 28` + `筛选`） |
| 「开始生成」位置 | y 5232.7（约第 5 屏） | **y 767.4，整个按钮在首屏内** |
| `.panel` 位置 | 机架之后（top 4506.8） | **机架之前（top 107）** |
| 两条粘性 | 横杆把日期带压到 −574 | `rail vpY 0 h45` / `band vpY 45`，`hitAtRailMid` = `.rail-line`、`hitJustUnderRail` = `.rack-band` |

摘要行真的在说事（`tools/adapt-rail-active.js`，逐次点选）：

```
全部 → 北方中转 → 北方中转 · 旧的在前 → 北方中转 · 旧的在前 · 小
显示 28 / 28 → 显示 3 / 28 → …… → 点重置回 全部 / 28
```

横杆展开：`railH 350`（`line 44 + full 305`），11 颗挡位全部可见，`docOverflowX 0`；滚到画廊中段它仍钉在 0（`position sticky`、`alignSelf auto`、`overflow visible`，父链上没有 `overflow: hidden` 把它关住）。展开时下一条日期带停在 y 45 —— 在横杆下沿之外，没有被压住。

### 断点扫描（`tools/adapt-measure3.js`，`--mobile --touch`）

| 档 | areas | `.busbar` | `.rail` | `.panel` 宽 | 首屏见「开始生成」 |
|---|---|---|---|---|---|
| 320×640 | 单列 | — | 45 | 320 | 要一次短滚动（`startY 767.4`） |
| 390×844 | `bus / panel / bay` | 107 | 45 | 390 | **是** |
| 559×540 | 单列 | 63 | 45 | 559 | 否（视口只有 540） |
| 560×540 | `bus bus / bay panel` | 54 | 45 | 300 | 否（同上） |
| 620×900 | 单列 | 63 | 45 | 620 | **是**（`startY 723.4`） |
| 740×420 | `bus bus / bay panel` | 54 | 45 | 300 | — |
| 768×1024 | 单列 | 54 | 45 | 768 | **是**（`740.4`） |
| 844×390 | `bus bus / bay panel` | 54 | 45 | 300 | — |
| 900×900 | 单列 | 54 | 45 | 900 | **是** |
| 901×900 | `bus bus / bay panel` | 54 | 222 | 300 | 是（`755.4`） |
| 1024×768 | `bus bus / bay panel` | 54 | 194 | 300 | 否 |
| 1440×900（corase 关） | `bus bus / bay panel` | 54 | 89 | 348 | 是（`778.9`） |

900 上下翻转正常（`901` 起横杆摊回，`.rail-line` 收掉）——「收不收由宽度决定」这条边界是准的。

### 横屏那一档：一个真缺陷，已修

两列档 `(≤900px, ≥560px, ≤520px)` 一开始只有布局，**没有把 `.rack-scroll` 的滚动区还回去**：上一档刚把它拆成 `overflow: visible`，于是机架撑到 4926px 从 `.bay`（336px）里溢出去，`docScrollH` 变成 **5025** —— 390px 高的窗口里一往下滚，右边的控制台跟着一起滚走。真手指验出来的：`--drag=200,300,120` 的 `innerCls` 是 `.rack-scroll` 但 `innerTop` 不动、`deltaWin` 才是那 900px。

修法是那三行：

```css
.rack-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

修后：`docScrollH 390`、`rackScrollClient 291 / content 4926 / canScroll true`；真手指机架区竖滑 `deltaInner 165 / deltaWin 0`，控制台区竖滑 `deltaInner 179`；`740×420` 的 `overflowBy 0`。

### 手势（真 `Input.dispatchTouchEvent`，`tools/edge-cdp.mjs --drag`）

- `.mp-grid` 内竖直拖（`180,600,200`）：`deltaInner 308`、`deltaWin 0`、**`sel 0` / `input ""`** —— 滚的是列表，没顺手选中。
- 画廊上竖直拖（`180,1500,1000`）：`deltaWin 962`、`deltaInner 0`。
- 触摸下点第一格（`tools/adapt-mpgrid-tap.js`）：`selected ["gpt-6.1-sol"]`、`#o-model = "gpt-6.1-sol"`、「开始生成」`y 767.4 / h45 / disabled false`。

**已知边界（未处理，非新引入）**：在 `.mp-grid` 里做一次**水平**拖（touchStart 与 touchEnd 落在同一像素）仍会被 Chromium 合成成 click 而选中一格。这不是这次改动带出来的——`.mp-cell` 一直是 click 选中；所有可滚的选择列表都有这个行为。记为已命名边界。

### 无障碍与缩放

- `tools/audit-interact.mjs` 390×844：**30/30 tab stop 有 `:focus-visible`**，`withoutAnyIndicator []`；标本弹窗焦点陷阱 `sheetFocusEscape 0`，Escape 后焦点回 `.ch` 且仍可见。
- 横杆开关键：从 body 起按 **15 次 Tab** 到达（`reached true`），Enter 展开、空格收回（按钮的原生行为，两边都通），`aria-expanded` 与 `aria-controls="rail-full"` 同步且目标存在。Escape 不响应——它是个横杆不是弹窗，按词表如此。
- 缩放 150/200/300%：`docOverflowX 0`，横杆 `pinned sticky`。
- 默认审计四档（390×844 / 320×640 / 844×390 / 1440×900）：`overflowX 0`、`contrastOffenders []`、`clipped []`；`smallTargets` 只剩两个 `.check input`——手机档已从 14×14 放大到 **20×20**（24px 阈值仍报，但它不再是 14）。
- `prefers-reduced-motion: reduce`：横杆展开 `transition none / 0s`，40ms 后高度就已经是终值（`jumped true`）；不减少动效时同一时刻还在 225px 中途。

### 构建与生产构建

- `npm run typecheck` 干净；`npm run build` → `dist/web/assets/index-DgqXS9OH.css`（32.05 kB / gzip 6.66）、`index-DysElxzm.js`（194.31 kB / gzip 62.24）。
- **8787**（`server/index.ts:272-278` 托管 `dist/web`）引用的是同一对 hash；在 8787 上复量：390×844 `pageH 5426 / startY 767.4 / first true / railH 45`，844×390 `docScrollH 390 / canScroll true`，审计三项全 0。

## 截图

`.impeccable/review/`：`adapt-phone-first.png`（390×844 首屏整块控制台）、`adapt-small-first.png`（320×640）、`adapt-landscape.png`（844×390）、`adapt-desktop.png`（1440×900）。

## 留档的探针

`tools/adapt-measure3.js`（全档位布局 + `startInFirstScreen` + `stuck`）、`tools/adapt-mpgrid-tap.js`、`tools/adapt-rail-toggle.js`、`tools/adapt-rail-sticky.js`、`tools/adapt-rail-lang.js`、`tools/adapt-rail-active.js`、`tools/adapt-rail-bandcheck.js`、`tools/adapt-rail-keys.mjs`、`tools/adapt-rail-reduced.js`、`tools/adapt-busbar-probe.js`、`tools/adapt-landscape-boundary.js`、`tools/adapt-landscape-overflow.js`、`tools/adapt-landscape-scroll.js`、`tools/adapt-landscape-band.js`、`tools/adapt-sweep-summarize.mjs`。`tools/edge-cdp.mjs` 新增 `--touch` 与 `--drag=x,y1,y2`。

## 没验到的

- **真机**。全部证据来自无头 Chromium（Edge）的仿真视口与 CDP 合成触摸。Chromium 不是 Safari：iOS Safari 的 `interpolate-size`、`position: sticky` 与 100vh 行为都可能不同，而这套改动三处都用到了它们。
- **真实辅助技术**。`role="status"`、`aria-expanded` / `aria-controls` 只核对了 DOM 属性，没有在 VoiceOver / TalkBack / NVDA 里听过。
- **`pointer: coarse` 的实机组合**。带触屏的笔记本（两个指针都真，取主指针 = fine）只按媒体查询推演过，没有实机。
- **软件键盘**。手机上点进 `.mp-input` 时键盘会顶起视口，首屏那 767.4 的位置会变；没有验。
