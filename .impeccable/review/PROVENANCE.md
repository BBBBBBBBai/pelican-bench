# 巡检截图的来源

这些图**不是手截的**，全部由 `tools/edge-cdp.mjs` 走无头 Edge 的 DevTools 协议生成，
所以每一张都可以原样复现。

| 文件 | 捕获命令 | 视口 | 页面状态 |
| --- | --- | --- | --- |
| `desktop.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/desktop.png --width=1440 --height=1800` | 1440×1800 | 机架首页，24 条演示记录，默认筛选 |
| `mobile.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/mobile.png --width=390 --height=844 --mobile` | 390×844 | 同上（620px 断点） |
| `sheet.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/sheet.png --width=1440 --height=1000 --do=tools/do-open-sheet.js` | 1440×1000 | 点开第一格有图的通道后的标本页（`--do` 脚本负责点开） |
| `live.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/live.png --width=1440 --height=1000 --do=tools/do-live-run.js` | 1440×1000 | **正在跑**的状态：临时档案指向 `mock-hang`，点开始生成后 1.4s 截图（用来验证活通道那一格） |
| `empty.png` | 见 `PROVENANCE.md` 下方「补验」一节 | 1440×620 | 筛选结果为空的状态（选一个从没出过问题的供应商 + 打开「仅看挂了标记的」） |
| `bus-track.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/bus-track.png --width=1440 --height=520 --do=tools/do-bus-track.js` | 1440×520 | 刚跑完一次之后：总线条右端的跟踪读数与网格里被套上琥珀轮廓的那一格 |

**数据来源：** `npm run seed`（`tools/seed-demo.mjs`）—— 8 个指向本地假供应商
（`tools/mock-provider.mjs`，127.0.0.1:9911）的档案，各跑 3 只动物，共 24 条记录。
**全部是合成的演示数据，不是真实供应商的输出。**

**量测的旁证（同一套工装跑的，与截图同源）：**

- `probe` 在 1440 与 390 两个宽度上：`cellHeights` 全等、`overflowX: 0`、
  `contrastOffenders: []`、`clipped: []`。`smallTargets` 只报出三个 14×14 的
  `<input>`，三处都包在 `<label class="check">` 里（命中区是 label），属误报。
- `do-open-sheet.js` 回读标本页：`addr = "R 2026-10-06 / CH 24"`、画面 1098×642、
  16 行 facts。
- `do-live-run.js` 回读活通道：`livePresent: true`、`hasStop: true`、`lampLive: true`、
  画面里已有流式正文 `<svg `、题面行 `考拉 · __LIVE_PROBE__ · mock-hang`。
  （探针用的临时档案与它跑出的那条记录事后已删。）
- `do-bus-track.js` 回读被跟踪项跨带高亮：`busTrackPresent: true`、
  `busTrackText: "CH 25章鱼原厂直连574ms"`、`trackedCell: "CH 25"`、跑完按钮回到
  `开始生成`。**它跑出的那条 CH 25 记录事后已删，机架仍是 24 条、通道 1..24。**
- `cellHeights` 从 324.6 变成 341.6、`silkHeights` 从 97.3 变成 114.3，是因为格子丝印
  多了一行 `.ch-when`（日期与时刻）；两个宽度下仍然全等。

`desktop.png` / `mobile.png` 是 finish review 的**必需捕获**；`sheet.png`、`live.png`
与 `bus-track.png` 是另外几个界面状态，一并送审。

## 补验（不在必需捕获里，但都亲眼看图确认过）

- **英文界面**：由一段临时 `--do` 脚本点右上角 `EN` 后截图。回读结果：
  `RACK 1 / CH 24 / IDLE`、`PROFILE PROMPT ORDER CELL`、
  `NEWEST OLDEST DENSE MID WIDE ALL FLAGGED ONLY`、`START RUN`、`NO SVG`、`MODEL MISMATCH`、
  `WILL NOT RENDER`。判定：**界面外壳全部换到英文，而供应商名与题目名仍是中文**——这两样是
  记录里的数据（当时实际发出去的题面就是中文），按「原样留存优先」的原则不该被翻译。
  这条是设计意图，不是漏翻。
- **筛选结果为空**：选一个从没出过问题的供应商 + 打开「仅看挂了标记的」触发。回读结果：
  `emptyPresent: true`、`emptyText: "NO CHANNELS MATCH THIS FILTERRESET"`、
  `cellCount: 0`、`shown: "SHOWING 0 / 24"`、筛选条上出现 `RESET`。

两段补验用的临时档案事后都已删除，机架仍是 24 条、档案 8 个，`uiLang` 已还原成 `zh`。

## 拨档开关宽度修复（2026-10-07）

| 文件 | 捕获命令 | 视口 |
| --- | --- | --- |
| `before-switch.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/before-switch.png --width=1440 --height=900` | 1440×900 |
| `after-switch.png` | 同上，输出 `.impeccable/review/after-switch.png` | 1440×900 |
| `before-switch-zoom.png` | 上面那张裁 `(1080,615)-(1440,680)` 后 4× 最近邻放大 | — |
| `before-rail-zoom.png` | 从 `before-switch.png` 裁横杆里 4 个正常拨档 | — |
| `cmp-switch-stacked.png` | 同一块区域 `(1080,615)-(1440,680)` 4× 放大，上=修复前、下=修复后 | — |

**改了什么：** `web/src/styles.css:372-384` 的 `.sw` 加一条 `width: fit-content;`。

**为什么：** `.sw` 原先是 `display:inline-flex; flex:none`。在 ControlPanel 的
`.field`（`web/src/styles.css:1020-1026`，`flex-direction: column`）里，`flex:none`
管的是**主轴**即高度，宽度是交叉轴，仍被 `align-items: stretch` 拉到整栏宽度。
所以「题面语言」那一处的凹槽被拉成 **315px**，而两个挡位只占 131.4px，
右边空出 **181.6px**——用户看到的「太宽、文字不居中」是同一个根因的两种观感。

**修复前后实测**（`node tools/edge-cdp.mjs probe`，1440×900）：

| `.sw` | 父容器 | 修复前凹槽 | 修复后凹槽 | 死区 |
| --- | --- | --- | --- | --- |
| 语种（`.busbar`） | row | 68.2 | 68.2 | 0 |
| 排序（`.rail-group`） | row | 133.4 | 133.4 | 0 |
| 格宽（`.rail-group`） | row | 97.9 | 97.9 | 0 |
| 仅看异常（`.rail`） | row | 144.7 | 144.7 | 0 |
| **题面语言（`.field`）** | **column** | **315.0** | **133.4** | **181.6 → 0** |

另在 390×844 与 860×900 两个宽度复测：无 `.sw` 溢出父级、`scrollWidth == clientWidth`、
5 个拨档死区全为 0。`alignSelf` 全程保持 `auto`——**没有**改成 `flex-start`，
那样会把总线条里垂直居中的拨档顶到上沿。

**为什么不用 `letter-spacing` 解决：** DESIGN.md 的 Width Axis Rule 明令
「永远不要用 letter-spacing 去假装窄体」，丝印一律靠 Archivo 的宽度轴压窄。
本次只动宽度，未碰字距。

**同时重建了 `dist/web`**（`npm run build`，2026-10-07 01:0x）：`启动.bat` 托管的是
构建产物而不是开发服务器，不重建的话双击 bat 看到的还是旧的 `.sw` 规则。
新产物 `dist\web\assets\index-BgYVffZ5.css` 里 `.sw{...flex:none;width:fit-content}`，
并在 8787 上复测通过。旧的 `index-ovgcZJg6.css` 已由 vite 自动清除。

## 画作圆角抹平（2026-10-07）

| 文件 | 捕获命令 | 视口 |
| --- | --- | --- |
| `round-before-sheet.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:8787/ .impeccable/review/round-before-sheet.png --width=1440 --height=1000 --do=tools/do-open-pelican.js` | 1440×1000 |
| `round-after-sheet.png` | 同上，输出 `.impeccable/review/round-after-sheet.png` | 1440×1000 |
| `round-after-rack-full.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:8787/ .impeccable/review/round-after-rack-full.png --width=1440 --height=1000` | 1440×1000 |
| `cmp-rounded-corner.png` | `python tools/cmp-rounded-corner.py`（裁 `(140,60)-(440,260)` 后 3× 最近邻放大，上=修复前、下=修复后） | — |
| `round-final-rack.png` | 清掉测试记录、只剩真实记录时复拍机架 | 1440×1000 |

重建 `dist/web` 后复拍的标本页与 `round-after-sheet.png` 逐字节相同（MD5 `30D45F89…`），
没有另存一份重复文件。

`round-before-sheet.png` 里那份画是**修复前**的标本页：天空的四角是圆的，
暗色房间底色从圆角里透出来，跟页面上所有直角表面（`.plate`、`.ch-plate`、工位牌）对不上。

**改了什么：** `shared/svg.ts` 新增 `squareRectCorners(svg: string): string`，
由 `sanitizeSvg` 调用，抹掉 `<rect>` 上的 `rx`/`ry`（双引号、单引号、裸值三种写法都覆盖）。

**为什么是 `<rect>` 而不是全局：** 这条记录里唯一的 `<rect>` 是
`<rect width="800" height="600" rx="32" fill="url(#sky)"/>`——`rx="32"` 就是那个圆角的全部来源。
但同一份文件里另有 6 个 `<ellipse>`（地面阴影 `rx="233" ry="17"`、鹈鹕眼睛 `rx="8" ry="10"`、
水花 `rx="7" ry="3"`、`rx="9" ry="3"`、石子 `rx="4" ry="2"` ×2），
它们的 `rx`/`ry` 是图形成立的必要条件，全局清洗会把它们全部抹没。**所以只动 `<rect>`。**
该文件内没有 `<style>` 块声明 `rx`，全项目也没有任何 `<rect>`/`<ellipse>` 之外的标签带 `rx`/`ry`。

**为什么算合法修改：** `PRODUCT.md:63` 的「原样留存优先于整洁」明确把清洗限定在
「渲染给人看」的那一层，且要求源码层永远可回溯；`DESIGN.md:260` 规定全站只有两个
`border-radius` 值（`0` 和 7px 指示灯那个 `50%`），`DESIGN.md:331` 的 Don'ts 直接写
「**Don't** 用圆角」。把画作的圆角抹平是把它归到页面的形式语言上，
**不是**给作品补台面——`.ch-plate` / `.plate` 的背景仍然透明，没加任何底色。

**实现时踩到的坑（已修）：** 裸值那条正则一开始写成 `[^\s>]+`，会把自闭合的斜杠一起吃掉
——`rx=32/>` 变成没闭合的 `<rect>`，整张图直接解析失败。把 `/` 排除后才对。
这类错只在「裸值 + 自闭合」同时出现时触发，双引号写法看不出来，所以专门留了单元断言。

**源码层未受影响（实测）：**

- `data\records\2026-10-06\20261007-003452-wwxim.svg` 落盘文件里仍是 `rx="32"`；`server/runner.ts` 只引入 `extractSvg, looksTruncated`，不写回清洗结果。
- `/api/records/:id` 的 `detail.svg` 仍是 `6133` 字符且含 `rx="32"`，所以标本页的「SVG 源码」折叠块与「下载 SVG」拿到的都是模型原样。
- 两条渲染路径都覆盖到：`/api/records/:id/svg`（`prepareSvgForImg`，机架缩略图 `<img>`）与 `web/src/components/SvgFrame.tsx`（`sanitizeSvg` + `wrapSvgForIframe`，标本页 iframe）。

**实测回读**（`node tools/check-served.mjs`，对真实记录 `20261007-003452-wwxim`）：
服务出去的 SVG 6161 字节，`<rect width="800" height="600" fill="url(#sky)"/>`（`rx` 已无），
6 个 `<ellipse>` 的 `rx`/`ry` 与落盘逐个一致（`233/17, 8/10, 7/3, 9/3, 4/2, 4/2`）；
落盘文件仍含 `rx`，两者不再逐字节相同。该脚本与 smoke 的分工：smoke 跑人造的
`mock-evil` 样本验证规则成立，这个脚本跑真实那幅画验证规则落在真东西上也对。

**回归锁：**

- `tools/mock-provider.mjs` 的 `SVG_EVIL` 埋伏素材加了 `rx="24" ry="24"` 的 `<rect>`
  和一个 `<ellipse rx="26" ry="18">`，让 `npm run smoke` 能同时验证「服务出去的 rect 被抹平」
  和「ellipse 不能被抹掉」。
- `tools/smoke-sanitize.mjs` 的检查项从 11 条加到 **14 条**。
- `tools/check-square.mts` 从「只打印」改成真断言（17 项，含裸值自闭合、跨行、大写、
  `<rectangle>` 前缀误伤），并接进 `npm run check:svg`，由 `npm run smoke` 首先执行。

**同时重建了 `dist/web`**（`npm run build`）：不重建的话 8787 与双击
`启动.bat` 看到的都还是旧产物。最终 JS 产物 `dist\web\assets\index-DXkEm-DI.js`
（旧的已由 vite 清除），CSS 产物名 `index-BgYVffZ5.css` 未变，因为本次没动样式表；
已在产物里核对到 `squareRectCorners` 的最终正则。
`npm run typecheck` 无错；修复后重跑
`impeccable.cmd detect --json shared/svg.ts tools/smoke-sanitize.mjs tools/check-square.mts` 返回 `[]`。

**验证过程中由冒烟测试产生的 18 条 mock 记录事后已全部删除**（`node tools/clean-mock-records.mjs --apply`，
该脚本带保留名单断言，跑之前先打印保留/删除清单），机架仍是那 1 条真实记录
（`20261007-003452-wwxim`，供应商 `a6`）；`tools/do-open-pelican.js` 是为这次捕获新加的
`--do` 脚本，定点点开 CH 01 那条带圆角背景的记录。

## 界面文案去行话（2026-10-07）

| 文件 | 捕获命令 | 视口 | 页面状态 |
| --- | --- | --- | --- |
| `plain-zh-desktop.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/plain-zh-desktop.png --width=1440 --height=780` | 1440×780 | 中文记录区首页，2 条记录 |
| `plain-zh-mobile.png` | 同上，`--width=390 --height=1500 --mobile` | 390×1500 | 同上（620px 断点） |
| `plain-zh-sheet.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/plain-zh-sheet.png --width=1440 --height=980 --do=tools/do-open-sheet.js` | 1440×980 | 中文详情页（`第 02 条` 那条穿山甲） |
| `plain-en-desktop.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/plain-en-desktop.png --width=1440 --height=800 --do=tools/do-en-view.js` | 1440×800 | 英文界面首页（`--do` 脚本点 `EN` 后回读溢出） |
| `plain-en-mobile.png` | 同上，`--width=390 --height=1400 --mobile` | 390×1400 | 同上 |
| `plain-en-sheet.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/plain-en-sheet.png --width=1440 --height=980 --do=tools/do-en-sheet.js` | 1440×980 | 英文详情页 |
| `plain-zh-built.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:8787/ .impeccable/review/plain-zh-built.png --width=1440 --height=780` | 1440×780 | **构建产物**（8787，`启动.bat` 走的那条路）重建之后复拍 |

**数据来源：** 与上面几节同一批——本地假供应商 `tools/mock-provider.mjs`（127.0.0.1:9911），
供应商 `a6`，2 条记录（穿山甲 `第 02 条`、鹈鹕 `第 01 条`）。**全部是合成数据。**

**改了什么：** 面向用户的界面文案整体去行话，**只动字，不动版式**。核心是重写
`web/src/i18n.ts`（术语表 + 全部中文词条），并把 4 处漏网的硬编码接进 i18n：
`web/src/components/BusBar.tsx:36`（跟踪窗的 `CH nn`）、`web/src/components/Rack.tsx:63`
（格子铭牌 `CH nn`）、`web/src/components/Rack.tsx:257`（日期带 `R {date}`）、
`web/src/components/SpecimenSheet.tsx:78`/`:156`（详情页页眉与「编号」行）、
`web/src/components/SpecimenSheet.tsx:179`（`YES`/`NO` 改成走 `meta.overridesYes|No`）。
新增 key `addr.rack` / `addr.channel` / `addr.full` / `meta.overridesYes` / `meta.overridesNo`，
删掉不再用的 `ch.address` 与 `sheet.meta`。`README.md` 一并整体重写术语。

**用户定的两条口径**（本轮开工前问过并选定）：
1. **彻底改成大白话**——界面里不再出现比喻词：机架→日期、通道→记录、标本页→详情、
   档案→供应商、挂了标记→异常、挡位/格宽（密中疏）→格子大小（小中大）、复位→重置。
2. **编号中文写成 `2026-10-06 · 第 07 条`**（英文界面保留 `R 2026-10-06 / CH 07`）。
   数字不变、仍然永久、删记录不重排，只换前缀。

**没动的：** 量化读数（`T=` / `MAX=` / `TOPP=` / `THINK` / `IN OUT TOT`）、协议名、品牌铭牌
`ANIMAL BIKE BENCH` 与副题「动物骑单车测试台 · 本机自用」。设计稿 `DESIGN.md`、
`web/src/styles.css`、`PRODUCT.md` 里的内部代号与类名（`.rack-band`、`.ch-no`、丝印、总线条）
**保持原样**——它们是内部词汇表，不出现在界面上。

**量测旁证（`node tools/edge-cdp.mjs probe`，1440×900，全部改动落地之后跑）：**
`counts.cells: 2`、`rowCount: 1`、`cellHeights: [349.1]`、`plateRatios: [1.3]`、
`silkHeights: [120.3]`、**`overflowX: 0`、`contrastOffenders: []`、`clipped: []`**，
`smallTargets` 仍是那两个 14×14 的 `<input>`（包在 `<label class="check">` 里，命中区是 label，
与上一节同样的已知误报）。英文与中文两次读数一致。

**回读的文案（英文侧，`tools/do-en-view.js`）：** `DATES 1 RECORDS 2 IDLE`、
`PROVIDER ALL a6 PROMPT ALL PROMPTS ORDER NEWEST OLDEST CELL SIZE SMALL MEDIUM LARGE
ALL ISSUES ONLY SHOWING 2 / 2`、分组头 `R 2026-10-06` + `2 records`；
`tools/do-en-sheet.js` 回读详情页 `addr = "R 2026-10-06 / CH 02"`、`OVERRIDES = NO`、
facts 15 行、`hOverflow: false`。中文侧对应为「日期 1 记录 2 空闲」「只看有异常的」
「2026-10-06 · 第 02 条」「本次单独设置 = 否」。

**踩坑（重要，本轮踩了两次）：Vite 的模块缓存按模块粒度失效，改了源文件不一定生效。**
第一次是 `web/src/components/Rack.tsx:257` 的 `R {date}`，第二次是
`web/src/components/SpecimenSheet.tsx:78`/`:156`/`:179`——源码已改成 `addr.full` 与
`meta.overridesYes|No`，截图里却仍是旧文案。判定方法：直接用
`Invoke-WebRequest http://127.0.0.1:5174/src/components/SpecimenSheet.tsx` 取 Vite 实际服务出去的
转译产物，看到 `addr.full` 只出现 1 次（应为 2 次）、facts 的 `<dd>` 仍是
`jsxDEV("dd", { children: ["R ", rackOf(record), " / CH ", channelText(...)] })`、
`overridesYes` 完全不存在 → 确证是缓存而不是代码问题。解法：
`(Get-Item <file>).LastWriteTime = Get-Date` 触碰时间戳，重新请求，等产物里**出现新 key、
不再出现旧字面量**，再截图。**以后改 `.tsx` 一律照这个顺序验证，不要只看源文件。**

**另一处坑：切语言会写进 `config.json`。** 英文巡检点 `EN` 会把 `uiLang` 持久化，
导致随后以「中文」为名的截图实际渲染英文（`plain-zh-sheet.png` 第一次就是英文页）。
已用 `tools/do-zh-view.js` 点回 `中` 并核对 `config.json` 里 `uiLang` 回到 `"zh"`，
最终两张中文图都是中文。**以后跑完英文巡检必须还原语言。**

`tools/do-en-sheet.js`、`tools/do-en-view.js`、`tools/do-zh-view.js` 是为本轮新加的 `--do` 脚本。

**同时重建了 `dist/web`**（`npm run build`，2026-10-07 03:5x）：`启动.bat` 托管的是构建产物
而不是开发服务器，不重建的话双击 bat 看到的还是旧文案。重建前实测旧的
`index-DXkEm-DI.js` 里仍有 3 处「机架」、完全没有新词条；重建后 `index-CZhPll_P.js`
里 `机架|通道|标本页|挂了标记` **零命中**，`只看有异常的` / `第 {n} 条` / `格子大小` / `正在运行`
全部命中，CSS 产物也从 `index-BgYVffZ5.css` 变成 `index-COvziKBr.css`
（本次只改了文案不该动样式，但 Vite 会给产物重新命名；旧文件已由 vite 自动清除）。
8787 的 `index.html` 已指向新产物，`plain-zh-built.png` 就是在 8787 上复拍的。

**收尾的 detector（必跑项）**：`impeccable.cmd detect --json` 覆盖
`web/src/i18n.ts`、`web/src/components/BusBar.tsx`、`web/src/components/Rack.tsx`、
`web/src/components/SpecimenSheet.tsx`、`README.md`，只报出 1 条
`broken-image`（`README.md:151`，snippet `<img>`）——那是「渲染安全」一节里描述清洗规则时
**用反引号引起来的字面词**，不是真的图片标签，属已知误报。
`npx tsc -p tsconfig.json --noEmit` 退出码 0。

---

## 两段式删除供应商（`.btn.halt.armed`）

删除供应商改成按两次：第一次按**什么都不删**，只是把键扣下去 —— 文字换成「确认删除」、
键座沉进 `#241512`、`inset 0 2px 4px` 加深成真凹槽、1px 边从 `#5a2f22` 提亮到 `#8a4630`；
第二次按才真的删。改的是 `web/src/components/ControlPanel.tsx`（`armed` 状态 + `remove()`
两段化）、`web/src/styles.css:1157-1184`（`.btn.halt` 与 `.btn.halt.armed`）、
`web/src/i18n.ts:96` 之后（新词条 `ctrl.deleteConfirm`）。

| 文件 | 捕获命令 | 视口 | 页面状态 |
| --- | --- | --- | --- |
| `prov-confirm.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/prov-confirm.png --width=1440 --height=1800 --do=tools/do-prov-confirm.js` | 1440×1800 | 端到端跑完整条两段式流程后的常态 |
| `prov-armed-desktop.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/prov-armed-desktop.png --width=1440 --height=1000 --do=tools/do-prov-armed.js` | 1440×1000 | 键已扣下、停在「确认删除」 |
| `prov-armed-mobile.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/prov-armed-mobile.png --width=620 --height=1100 --mobile --do=tools/do-prov-armed.js` | 620×1100 | 同上（620px 断点） |
| `prov-confirm-reduced.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/prov-confirm-reduced.png --width=1440 --height=1000 --reduce --do=tools/do-prov-confirm-reduced.js` | 1440×1000 | `prefers-reduced-motion: reduce` 下扣闩 |
| `prov-armed-en.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/prov-armed-en.png --width=1440 --height=1000 --do=tools/do-prov-armed-en.js` | 1440×1000 | 英文界面下停在 `CONFIRM DELETE` |

**量测旁证（`tools/do-prov-confirm.js`，端到端，全程只碰自己新建的临时供应商 `ZZPROBE`）：**
`rosterBefore:["a6"]` → `created:true` → `selected:"ZZPROBE"`；
常态 `{label:"删除", armedClass:false, ariaPressed:"false", background:"rgba(0, 0, 0, 0)",
borderColor:"rgb(90, 47, 34)", boxShadow:"none", overflowPx:0}`；
扣下后 `{label:"确认删除", armedClass:true, ariaPressed:"true", background:"rgb(36, 21, 18)",
borderColor:"rgb(138, 70, 48)", boxShadow:"rgba(0, 0, 0, 0.8) 0px 2px 4px 0px inset,
rgba(255, 255, 255, 0.04) 0px -1px 0px 0px inset", overflowPx:0}`。
**`survivedFirstClick:true`** —— 第一段确实没删数据；第二段后 `rosterAfterDelete:["a6"]`、
`deleted:true`、`countRestored:true`。闩的回退也验了：换工位 → `armedAfterSwitch.armedClass:false`、
回到原档案 `disarmedOnReturn.armedClass:false`；`armedBeforeEdit:true` → `armedAfterEdit:false`
（点「编辑供应商」也弹回）。

**文字装不装得下（`:root` 两列等宽，最长的是英文）：** 桌面 1440 `{scrollW:151, clientW:151,
overflowPx:0, editW:153, deleteW:153}`；手机 620 `{scrollW:288, clientW:288, overflowPx:0,
editW:289.5, deleteW:289.5}`；英文 `CONFIRM DELETE` `{scrollW:151, clientW:151, overflowPx:0,
editW:153, deleteW:153, docOverflow:false, overflowing:[]}`。**三种情况下两列都仍然等宽、零溢出。**

**reduce 下的断言（`tools/do-prov-confirm-reduced.js`，走 `--reduce` 而不是改源码里的 media query）：**
`mediaReduced:true`、`transitionDuration:"1e-06s"`、`statePresent:true`、`labelChanged:true`、
**`instant:true`**（点击后 62ms 采样，凹槽与刻线已是终态）—— 闩的反馈是「键扣下去了」这件事本身，
不是一次动画，所以 reduce 下它照常出现，只是不再有 0.18s 的那一程。

**探针审计（`probe` + `--do=tools/do-prov-armed.js`）：** `contrastOffenders: []`、`clipped: []`、
`overflowX: 0`；`smallTargets` 仍是那 2 条 14×14 `<input>`（已知误报，命中区是外层 label）。

**新增的派生色 `#8a4630`：** 检测器报 `design-system-color` advisory，**allowlist 读的是
DESIGN.md 的 YAML front matter，不是正文里那张 Derived Values 表**（`#8a7f68` 之所以干净，
只因它是 front matter 里的 `reasoning-voice`）。已在 front matter 里声明为
`halt-edge-lit: "#8a4630"`（与 `halt-edge: "#5a2f22"` 成对，正如 `engrave` / `engrave-lit`），
并在正文表格与 Components 的 `.halt` 条目里补记。声明后 `detect` 返回 `[]`。
`design.json` 的 Halt Button 条目也同步加了 `.armed` 规则与描述。

**收尾：** `npm run typecheck` 退出码 0；`npm run build` 重建 `dist/web`
（`index-Do3C-Vek.css` / `index-wdVhxGER.js`，2026-10-07）。按 PROVENANCE 的纪律，
改动后用 `Invoke-WebRequest` 取 Vite 实际服务出去的产物核对：`src/styles.css` 里
`.btn.halt.armed` 与 `8a4630` 命中、`src/components/ControlPanel.tsx` 里 `setArmed` 与
`ctrl.deleteConfirm` 命中、`src/i18n.ts` 里 `deleteConfirm` 命中 —— **不是只看源文件**。
英文巡检跑完已把 `config.json` 的 `uiLang` 还原成 `"zh"`（`do-prov-armed-en.js` 故意留在英文供截图，
所以那次是用 node 手动改回的）。

## 两段式删除测试记录（复用 `.btn.halt.armed`）

标本页的「删除」改成和供应商同一个形式：第一次按**什么都不删**，只是把键扣下去；
第二次按才真的删，并且要等面板退场动画播完再卸载。删掉的是 `window.confirm` ——
它既打断了操作，又把「后果说明」藏进了一个系统弹窗里。

改的是 `web/src/components/SpecimenSheet.tsx`（`armed` 状态、`onDelete` 签名由
`(id: string) => boolean` 改成 `(id: string) => void`、Esc 改为「闩扣着时先弹闩、不关面板」）、
`web/src/App.tsx:125-136`（`onDelete` 去掉 `window.confirm`）、
`web/src/i18n.ts:150-156`（新 `sheet.deleteArmed`；原 `sheet.deleteConfirm` 改名
`sheet.deleteWarn` 并去掉疑问句口吻，改陈述句）。

**样式完全复用上一轮的 `.btn.halt` / `.btn.halt.armed`**（`web/src/styles.css:1157-1184`），
没有新增任何 CSS 规则 —— 同一台仪器里同一件事只有一种长相。

**后果说明的去处：** 原来那句「文件会一起没」住在 `window.confirm` 里，换成两段式之后
不能丢掉。它现在只在闩扣下之后出现（`{armed && <p className="note" role="status">}`），
挂在按钮下方、`color: var(--fault)`、`maxWidth: 62ch`。**不播入场动画** —— 这台仪器里
状态变化是即刻的，多一段淡入反而像在催人。`role="status"` 让屏幕阅读器在它出现时读到。

| 文件 | 捕获命令 | 视口 | 页面状态 |
| --- | --- | --- | --- |
| `record-armed-desktop.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174 .impeccable/review/record-armed-desktop.png --width=1440 --height=900 --do=tools/do-record-armed.js` | 1440×900 | 标本页打开、键已扣下、停在「确认删除」 |
| `record-armed-mobile.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174 .impeccable/review/record-armed-mobile.png --width=620 --height=1100 --mobile --do=tools/do-record-armed.js` | 620×1100 | 同上（620px 断点） |
| `record-armed-en.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174 .impeccable/review/record-armed-en.png --width=1440 --height=900 --do=tools/do-record-armed-en.js` | 1440×900 | 英文界面下停在 `CONFIRM DELETE` |

**量测旁证（`tools/do-record-confirm.js`，端到端，全程只碰自己跑出来的临时记录）：**
`countBefore:27` → 建临时档案 `ZZPROBE`（指向 `http://127.0.0.1:9911`）→ 跑一次拿到
`recordId:"20261007-202256-x80og"` → 点格子开面板。
常态 `{label:"删除", armedClass:false, ariaPressed:"false", background:"rgba(0, 0, 0, 0)",
borderColor:"rgb(90, 47, 34)", color:"rgb(228, 100, 63)", boxShadow:"none", overflowPx:0}`；
扣下后 `{label:"确认删除", armedClass:true, ariaPressed:"true", background:"rgb(36, 21, 18)",
borderColor:"rgb(138, 70, 48)", boxShadow:"rgba(0, 0, 0, 0.8) 0px 2px 4px 0px inset,
rgba(255, 255, 255, 0.04) 0px -1px 0px 0px inset", overflowPx:0}` —— **与供应商那颗键逐值相同**。
`warnShown:true` / `warnText:"这条记录的 SVG 和原始返回内容等文件会一起删除，无法恢复。"`。
**`survivedFirstClick:true`**（`countAfterFirstClick:28`，第一段确实没删）且 `sheetStillOpen:true`。
Esc：`armedAfterEsc:false` / `sheetAfterEsc:true`（只弹闩，不关面板）。
第二段：`leavingDuringExit:true` → `sheetGone:true` → `deleted:true`、`countRestored:true`（回到 27）。

**文字装不装得下：** 桌面与手机 `{scrollW:91, clientW:91, overflowPx:0}`；
英文 `CONFIRM DELETE` `overflowPx:0`。

**reduce 下的断言（`tools/do-record-armed-reduced.js`，走 `--reduce` 而不是改源码里的 media query）：**
`armedAfterMs:9`、`instant:true`、`shadowBefore:"none"` →
`shadowAfter:"rgba(0, 0, 0, 0.8) 0px 2px 4px 0px inset, rgba(255, 255, 255, 0.04) 0px -1px 0px 0px inset"`。
扣闩的反馈是「键扣下去了」这件事本身，不是一次动画 —— 所以 reduce 下它照常出现，
只是不再有那 0.18s 的一程。**纯色 + inset 没有位移可抹，本就无需新的 reduce 声明。**

**探针审计：** 桌面 1440 与手机 620 均 `contrastOffenders: []`、`clipped: []`、`overflowX: 0`；
`smallTargets` 仍是那 2 条 14×14 `<input>`（已知误报，命中区是外层 label）。

**收尾：** `npm run typecheck` 退出码 0；`npm run build` 重建 `dist/web`
（`index-Do3C-Vek.css` 25.81 kB）；`impeccable.cmd detect --json` 对四个改动文件返回 `[]`。
英文巡检跑完已把 `config.json` 的 `uiLang` 从 `"en"` 还原成 `"zh"`
（**`config.json` 在仓库根，不在 `data/` 下** —— `data/` 里只有 `records/`）。

## 事故：`web/src/styles.css` 被截断成 1 字节（2026-10-07 20:02）

**现象：** `web/src/styles.css` 变成 **1 字节**（内容只有字符 `x`），
`dist/web/assets/index-BA23ZH6C.css` 变成 4 字节（`x{}`）—— 后者是截断**之后**才跑的
`npm run build` 留下的。读该文件报 `offset 1100 is out of range ... (1 lines)`。
**根因始终未查明**；本轮对该文件的写操作数为零（edit 目标从未指向它），
会话记录里 `styles.css` 的写调用时间戳也证实：最后一次真实写入是
`2026-10-07T11:48:18Z`（seq 985），远早于事故。不是 git 仓库，无版本历史。

**抢救路径（唯一成功的一条）：** `tools/edge-cdp.mjs:48` 用
`mkdtempSync(join(tmpdir(),'edge-cdp-'))` 给无头 Edge 建临时 profile，**跑完只 `child.kill()`
却从不删 profile 目录**，于是历次探针抓到的 Vite 转译产物留在
`C:\Users\18170\AppData\Local\Temp\edge-cdp-*\Default\Cache\Cache_Data\` 里。
逐 profile grep `halt\.armed` 定位到 `f_000007`：
`edge-cdp-HFk2WW\...\f_000007` = **54440 字节、LastWriteTime 20:01:31**
（早于 20:02:10 的截断，是最完整的一份）；另有 7 个 profile 各存 54216 字节的版本。

**还原方法（`tools/recover-css-from-cache.mjs`）：** 缓存内容不是裸 CSS，而是 Vite 的
HMR 包装模块 —— `const __vite__css = "/* ... */";`，整份 CSS 是**一个 JS 字符串字面量**。
定位 `const __vite__css = ` 之后从引号扫到真正的收尾引号（跳过 `\` 转义）再 `JSON.parse`
反转义即可。还原得 **52126 字节 / 1841 行 / 0 个替换字符 / 214 行中文注释**，
花括号平衡（EOF depth 0）、8 个 `@keyframes`、5 个 `@media`、4 个 `@font-face`。

**为什么可以确认还原是完整的（三重独立验证）：**
1. **逐字节比对** —— `tools/_css-byte-proof.mjs`：把恢复后的文件交给 Vite 转译，
   与事故前那份缓存**逐字节相同**（`54440 == 54440`，`byte-identical: true`）。
   转译是确定性的，少一个字节都不可能有这个结果。**这是决定性证据。**
2. **类名交叉核对** —— `tools/_verify-css-completeness.mjs`：TSX/TS 里 `className`
   用到的 88 个类，恢复的 CSS 里全部有规则。
3. **重建哈希复现** —— 恢复后 `npm run build` 产出的文件名与大小与事故前一致
   （`index-Do3C-Vek.css`，25806 字节）。

**同时清掉的其它可能：** 回收站为空、无卷影副本、OneDrive 无副本、
VSCode Local History 无快照、Vite dev server 没有历史副本（`?direct` 也返回 1 字节）、
`node_modules/.vite` 只含依赖预打包、同目录 `test1`~`test5` 都没有这个文件、
全盘搜 `index-Do3C-Vek.css` 与特征串 `lamp-strike` 均无 CSS 副本。

**教训：** `tools/edge-cdp.mjs` 不删临时 profile 这个「疏漏」恰好成了唯一的事故副本来源 ——
**别急着清理看起来像垃圾的临时目录**。另外 `.impeccable/live/pending-manual-edits.json`
里存着一份 `cssCustomProperties` 配色令牌表，可作最后的兜底参考
（但它记的是 `.bay-section` 局部的 `font-size: 13px`，与六档字号体系不一致，仅供参考）。

## 模型候选清单编辑面（2026-10-08）

| 文件 | 捕获命令 | 视口 |
| --- | --- | --- |
| `preset-desktop.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/preset-desktop.png --width=1440 --height=1200 --do=.impeccable/review/preset-shot.js` | 1440×1200 |
| `preset-en.png` | `node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/review/preset-en.png --width=1440 --height=1200 --do=.impeccable/review/preset-en.js` | 1440×1200 |

`preset-probe.js` 一趟走完六步（回车加一条 / 重名不写盘 / 空行不写盘 / 改行去首尾空白 /
叉删掉 / 还原），回读：`appended: true`、`focusIsTail: true`、`dupState.same: true`、
`blankState.same: true`、`trimState.clean: true`、`dropState.backTo: true`、`restoredSame: true`。
几何：`.preset-list` 315×310、行高 28、名字宽 283、`seam: 1`（名字右沿到叉左沿正好 1px 刻缝）、
11 个 `.preset-drop`（10 个 `<button>` + 1 个 `<span>`，均 29px）。

`preset-e2e.js` 验的是这张清单存在的唯一理由：从界面加一条 `__CUSTOM_MODEL__` 之后，
「要测哪个模型」那张候选表 `gridBefore: 10 → gridAfter: 11`、`gridHasCustom: true`，
在候选表里搜 `CUSTOM` 命中 `["__CUSTOM_MODEL__"]`。**改清单确实改的是那张表。**
（该临时模型名事后已随还原一并清掉，`finalSame: true`。）

其它三档：`preset-coarse.js`（390×844 `--mobile --touch`）→ `tooShort: 0`、
名字与叉全部 44×44、`restoreH: 44`；`preset-reduce.js`（`--reduce`）→
`name/drop/restore` 全部 `dur: 1e-06s`、`transform: none`、`anim: none`，
删行仍然瞬间生效；`preset-empty.js` 从界面把 10 条一条条叉掉 →
`diskLenAfterUIEmpty: 0`、`rowsWhenEmpty: 1`、`emptyShown: true`、
`restoreDisabledWhenEmpty: false`；点「恢复出厂清单」→ `restoredLen: 10`、
`emptyGoneAfterRestore: true`、`restoreDisabledAfterRestore: true`。**空态能把人救回来。**

英文巡检：`lang: "en"`、`headLabel: "MODEL CANDIDATES"`、`restoreText: "RESTORE DEFAULTS"`
（宽 133px，装得下）、`tailPlaceholder: "ADD A ROW"`、`overflowX: 0`。
**巡检后 `config.json` 的 `uiLang` 已还原成 `"zh"`**（按钮点一下就会写盘，这步不能忘）。

生产包复验：`npm run build` 之后在 8787 上 `preset-prod.js` → `inProd: true`、`rows: 11`、
`nameFont: '"Azeret Mono"'`、`nameBorder: "0px"`、`overflowX: 0`。
`impeccable.cmd detect` 只剩两条既有 advisory / warning（`DESIGN.md:190` 指示灯 7px 圆角、
`README.md:154` 那段讲 `<img>` 的说明文字被当成坏图，均为误报且非本轮改动处）。

### 事故：探针里「失焦提交」全都测不到（2026-10-08）

**现象：** `preset-probe.js` 五步写路径全部没写盘，但处理函数本身是对的 ——
手动喂一个假合成事件调 `props.onBlur(...)` 立刻产生 PUT 并写盘成功。

**根因：** **无头 Edge 里 `document.hasFocus()` 是 `false`。** `el.focus()` 只设
`activeElement`，`el.blur()` **不会**派发真正的 `focusout`，于是 `<input>` 上挂的
原生 `blur` / `focusout` 捕获监听一个都不响。凡「输入完 → 失焦提交」的行为在探针里
全都测不到，看起来像功能坏了，其实只是浏览器没在听。
（`bubbles` 默认是 true，所以合成 `keydown` 有效、而 `blur`/`focusout` 无效，正是这个原因。）

**修法：** `tools/edge-cdp.mjs` 新增 `--focus` 开关，走
`Emulation.setFocusEmulationEnabled({ enabled: true })`。**任何要验「输入 → 失焦」的探针
都必须加 `--focus`**，否则会误判成缺陷。加上之后 `preset-probe.js` 六步全绿。


