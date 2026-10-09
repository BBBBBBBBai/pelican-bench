# 手机端供应商回执：取消底部浮条，改成与桌面同一份就地样式

## 任务

用户原话（m04242）：

> 把手机端的供应商提示也改成桌面端一样的样式

前情：回执（保存 / 删除 / 校验失败的结果）在桌面端长在「供应商」标题行里（`.prov-receipt` 槽位 + 失败时另起一行 `.note.prov-receipt-note`），而在 ≤900px 被改成 `position: fixed` 钉在屏幕底部 —— 那是上一轮（m00438）**分端处理**的结果。这一轮要把这个分叉收掉：手机也用同一份长相。

**这不是「把一条规则复制过去」，而是要先证明上一轮分端的理由已经不成立。** 下面第一节就是这件事。

---

## 一、上一轮分端的理由为什么会失效

`web/src/styles.css:2100-2103` 留着上一轮的注释，理由是一句话：**「标题行离『保存』键有 415px —— 回执留在标题行里必然在屏幕外」**。

那句话**当时是对的**：那时 `.panel`（控制台）排在整面机架**之后**，「供应商」标题行在页面 y≈4506。但紧接着的 adapt 任务（m00817 / m01619）把控制台整块提到了机架之前 —— 标题行现在在 y≈120。

新增探针 `tools/prov-receipt-visibility.js`（打开新建表单、点保存两刻分别量 `.bay-head` 与 submit 按钮的位置）在四档上复核：

| 档 | `.bay-head` | submit 键 | 都在屏内？ | gap | 保存触发滚动 |
|---|---|---|---|---|---|
| 390×844 | y120–164 | y621.5–665.5 | **是** | 457.5 | 否 |
| 320×640 | y120–164 | y621.4–665.4 | 否（641 > 640） | 457.5 | 否 |
| 844×390 | y68–112 | y585.5 | 否（391 > 390） | 473.5 | 否 |
| 1440×900 | y68–101 | y483.5 | 是 | 382.5 | 否 |

**gap 还是 457px，但两端都在一屏之内** —— 距离本身不是问题，「同一屏内」才是。所以旧理由的前提（标题行在屏幕外）在竖屏档已经不成立。

但它也不是全都不成立。第二个探针 `tools/prov-receipt-scrolled.js` 用 `scrollIntoView({block:'center'})` 把保存键滚到视口中央（最坏情况：用户自己滚下去了）：

| 档 | 滚动容器 | 滚过 | 之后 `.bay-head` |
|---|---|---|---|
| 844×390 | `DIV.panel-scroll`（client 336 / content 1544） | 385 | **y −317** |
| 320×640 | `HTML`（client 640 / content 12286） | 323 | **y −203** |
| 390×844 | `HTML`（整页滚） | 221 | **y −101** |

第三个探针 `tools/prov-receipt-roster.js` 把「名册有多长」也拉了进来 —— 判据是「滚到保存键**下沿刚进视野**（一 px 都不多滚）那一刻，标题行是否整个还在屏内」，每轮只克隆 `.slot[data-probe-clone]` 量高、绝不碰 React 真节点，量完复位：

| 档 | 名册 ≤ 多少家时标题行仍在屏内 | 超过之后 |
|---|---|---|
| 390×844 | **6**（n=8 `need 199` → head y −79） | n=12 `need 414.8` → y −295 |
| 320×640 | **2**（n=3 `need 133.3` → head y −13） | n≥3 全丢 |
| 768×1024 | **8**（n=12 `need 183.8` → y −115） | n=12 丢 |
| 844×390（横屏两列） | **0 —— n=1 就已丢**（`need 239.4` → head y −171） | n=12 `need 1008` → y −940 |

**结论**：手机上能不能「就地长在标题行里」，不取决于屏幕多宽，取决于**名册有多长、是不是横屏档**。横屏档无论名册多短都兑现不了。所以要让手机也用桌面那套就地回执，唯一的办法是让**标题行在滚动时粘住** —— 而不是继续把回执搬到一个「注定看不见标题行」的地方去。

---

## 二、改动

不是 git 仓库，以下是手写 diff。**三个文件，没有新增 i18n key，没有碰 `App.tsx` 的 toast 通道。**

### 1. `web/src/components/ControlPanel.tsx`（798 行 / 33630 字节 → 804 行 / 34143 字节 / 纯 LF / 结尾有换行）

名册节（`:254-281`）里，把 `<Head>` + `<p className="note prov-receipt-note">` 一起**外包进一层 `<div className="prov-head">`**：

```diff
       <section className="bay-section">
+        {/* 标题行连回执一起包起来：窄屏上这一块是**粘**的（见 styles.css 的
+            `.prov-head`）。回执就长在标题行里 —— 跟宽屏同一份样式，窄屏不再
+            改成钉在屏幕底部的浮条。失败的长句子必须跟着一起粘：它若留在原位，
+            人正看着下面的表单，而那句话在屏幕上方，等于没说。 */}
+        <div className="prov-head">
           <Head label={t('ctrl.profiles')} right={<> ... <span className="prov-receipt" role="status"> ... </>} />
           <p className="note prov-receipt-note" role="status"> ... </p>
+        </div>
```

`Head` 组件本身（`:51-59`）**一行未改**。中途试过给 `Head` 加一个 `sticky` prop，改了两处又全部回退 —— 包一层 wrapper 更干净，也不让「组件知不知道自己在哪一档」这种知识漏进 `Head`。

### 2. `web/src/styles.css`（2395 行 / 74704 字节 → 2399 行 / 75072 字节 / 纯 LF / 结尾有换行）

**(a) `:1170-1177` `.bay-section` 新增 `--section-pad: 16px`** —— 粘块要横着盖满整幅宽，就得知道父级的左右内边距是多少。放在父级上**只有一个源**：内边距改了变量跟着改，两边不会各写一个数然后走散。

**(b) `:2117-2137`（`@media (max-width: 900px)` 块内）新增 `.prov-head`**：

```css
.prov-head {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--panel);            /* 必须是实底：滚过来的名册、表单要挡得住 */
  border-bottom: 1px solid var(--engrave);
  margin: 0 calc(-1 * var(--section-pad));
  padding: 0 var(--section-pad) 10px;
}
.prov-head .bay-head { margin-bottom: 0; }
```

三个判断值得记下来：

- **`top: 0` 而不是跟横杆对齐** —— `.rail` 在 `.bay` 里，而供应商这一节整块排在 `.bay` **之前**，两者的粘性区间根本不相交（探针 `tools/prov-receipt-layers.js` 实测 `overlapRail` 恒为 0）。
- **下沿那条 `--engrave` 刻线** 是 `.rail` / `.busbar` 立的先例：内容是**从它下面**滑过去的，没有这条线，被切掉一半的按钮读起来像是坏了。这条线不随粘住与否出现或消失，所以上下布局不会因此跳 1px。
- **`.bay-head` 自己那 11px 下边距必须搬进 padding** —— 它原来落在粘块的**外边**，会成一条透明缝（滚过去的内容从缝里露出来）。10px padding + 1px 刻线 = 原来的 11px。

**(c) `:2033-2035`（900px 块内）新增 `.panel-scroll { overflow: visible }`** —— 单列时它是「假滚动容器」（自己不滚、内容全展开），却仍然构成一个滚动容器，会把 `.prov-head` 的 `sticky` **关在盒子里**。这与 `.rack-scroll` 是同一个毛病，注释里已写上。

**(d) 原手机回退规则整段删除** —— `.prov-receipt:empty{display:none}`、`.prov-receipt, .note.prov-receipt-note { position: fixed; left: 50%; bottom: calc(22px + var(--safe-b)); transform: translateX(-50%); z-index: 90; min-width: 0; max-width: min(70vw, 62ch); margin: 0; background / border / box-shadow / padding ... }`、`.note.prov-receipt-note{border-color:#5a2f22}` **全部移除**。`.toast { bottom: calc(22px + var(--safe-b)) }` **保留**（全局 toast 通道与服务这一节无关，仍在用）。

**(e) `:2237-2246`（横屏块内）** `.panel-scroll { overflow-y: auto }` 恢复（两列时控制台有自己的滚动区），并把 `.prov-head` 加进 `.rack-band` 那条选择器：`.rack-band, .prov-head { top: 0 }`。

**(f) `:2253-2258`（620px 块内）** `.bay-section` 里加 `--section-pad: 12px`（父级内边距收到了 12px，粘块跟着）。

### 3. `DESIGN.md`（414 行 / 42070 字节）

原本**完全没记回执这件事**。在「Profile Slot（档案工位）」`DESIGN.md:354` 那节末尾补两条（`:359` / `:360`），并在 `:286` 的断点段里给 900px 补「供应商段的标题行连同回执一起粘住」、620px 补 `--section-pad` 16px→12px。

两条新规则记录的内容：52px 槽位的来历（EN `DELETED` 实测 51.25px 向上取整，中文 37.63px）、**宽度写死不随文字变**（否则 `.bay-head .rule` 刻线每来回执一次就抖一下）、成功走 `--ok`（对 `--panel` 6.79:1）、无入场动画、失败长句另起一行；以及**改法的理由演化**本身 —— 把「原先为什么钉底部、那个 415px 是在什么前提下测的、前提怎么没的」写进去，免得下一个人再照着过期的数走一遍。

---

## 三、验证

### 端到端：`tools/do-prov-receipt.js`（既有探针，指真 API 建/删一次性供应商）

三档全绿，输出数字在 5174（dev）与 8787（生产构建）**逐项相同**：

| 检查 | 390×844 | 844×390 | 1440×900 |
|---|---|---|---|
| `place.position` | `static` | `static` | `static` |
| `place.inHead` | `true` | `true` | `true` |
| `ruleMoved`（刻线是否因回执出现而移动） | `false` | `false` | `false` |
| `toastInDom` | `false` | `false` | `false` |
| 保存 / 删除 | `已保存` / `已删除` `rgb(143,170,98)` | 同 | 同 |
| 槽位宽度 | `w:52` | `x719.11 w52` | `x1315.11 w52` |
| 失败面 | `接口地址必须填写` `rgb(228,100,63)`、`noteBelowHead true` | 同 | 同 |
| 5.1s 后 | `visible false` | 同 | 同 |
| 取消 | note 收掉、slot `open false, inH 0` | 同 | 同 |

### 粘性在名册变长时是否仍然兑现（`tools/prov-receipt-roster.js`）

改前 / 改后对照（判据同上）—— 这是本轮的核心证据：

| 档 | 改前 head | 改后 head |
|---|---|---|
| 390×844 n=8 | y −79（丢） | **top 0 / bottom 44（全在屏内）** |
| 390×844 n=12 | y −295（丢） | **钉 0** |
| 320×640 n=3 | **y −13（丢）** | **钉 0** |
| 768×1024 n=12 | y −115（丢） | **钉 0** |
| 844×390 n=1..12 | **n=1 就 y −171**（n=12 y −940） | **n=1..12 全部 top 54 / bottom 98** |

### 粘块几何（`tools/prov-receipt-sticky-check.js`）

390×844：`head x0 w390`（左右贴齐整幅宽）、`bg rgb(25,25,23)`（实底）、`selfAtCenter "self"`、「新建」键 `x329.1 w48.9 h44` 仍在屏内；失败时 head 高度 55→100、`noteInsideHead true`、`noteOnScreen true`（长句子确实跟着一起粘）；取消后回 55。
844×390：`head x545 w299`、`headLeftFlush false` —— **两列档左不贴齐是对的**，它只该吃自己那一列。

### 层叠冲突（`tools/prov-receipt-layers.js`）

- 竖屏 head 钉 `top 0` 时 `.rail` 还远在 y1381.8，粘性区间不相交；`scrollY 900` 后 head 自然松开到 y −289.6（它那一节结束了）—— 正确行为。
- 横屏 head 钉 y54（正好在 54px `.busbar` 之下），`beforeHeadCenter` 命中 `.busbar`；与 `.rail`（y54–99）是**同一竖坐标但在不同列**。
- 探针本身修正了一处：原 `overlapRail` 只比上下边，两列时会报出吓人但无意义的 `45`。改成真正的 2-D 面积交 `max(0, min(right) − max(left)) × max(0, min(bottom) − max(top))`，并把取样横坐标从屏幕中线改成**标题行自己的中点**（横屏中线那一列站的是机架）。改后两档 `overlapRail` 全为 **0**。

### 宽屏未受影响（`tools/prov-head-boundary.js`，六档）

| 宽度 | 1440 | 1040 | 901 | 900 | 620 | 390 |
|---|---|---|---|---|---|---|
| `.prov-head` position | `static` | `static` | `static` | `sticky` | `sticky` | `sticky` |
| `top` | — | — | — | `0px` | `0px` | `0px` |
| `z-index` | — | — | — | 4 | 4 | 4 |
| `background` | transparent | transparent | transparent | `rgb(25,25,23)` | 同 | 同 |
| `border-bottom` | `0px` | `0px` | `0px` | `1px rgb(45,44,40)` | 同 | 同 |
| 左右贴齐 | gap 16/16 | 16/16 | 16/16 | **0/0** | 0/0 | 0/0 |
| `--section-pad` | 16px | 16px | 16px | 16px | 12px | 12px |
| `.panel-scroll` overflowY | auto | auto | auto | **visible** | **visible** | **visible** |

### 无布局漂移（A/B 对照）

拿 8787 的**未改前构建**当对照（`tools/prov-section-height.js`，只量两版都有的元素）：`.bay-section h 190.9`、`.roster y175`、`.slot y176`、三节 `[{y108,h190.9},{y298.9,h528.5},{y827.4,h372.9}]`、`pageH 5426` —— **逐位一致**。唯一差异是 `.bay-head` 的 `marginBottom 11px → 0px`，正好被 `.prov-head` 的 padding 一对一吃掉。

> **教训**：跨版本对照的探针绝不能 query 新加的元素。第一版对照用 `tools/prov-head-boundary.js` 直接 `querySelector('.prov-head')`，在旧构建上抛错 → `[exit code: 1]`，白跑一次。探针必须只依赖两版共有的选择器。

### 前后截图（同一探针、同一滚动位）

`tools/shot-prov-receipt-web.js`（只依赖共有的 `.bay-head button` / `#f-name` / `#f-url` / `.prov-form button[type=submit]`，建一次性 `zz-before-shot`、`scrollTop 260`）：

- `.impeccable/review/receipt-phone-before.png`（8787）：`receiptPos "fixed"`、`receiptRect {x161.8, y785.5}`、**`headRect y −159`** —— 标题行早就滚走了，回执却浮在屏幕底部。**这就是缺陷本体**：一个和上下文脱了钩的提示。
- `.impeccable/review/receipt-phone-after.png`（5174）：`receiptPos "static"`、`receiptRect {x269.1, y13.8}`、`headRect {x12, y0, w366, h44}` —— 标题行钉在顶，回执在它里面。
- 另有 `.impeccable/review/receipt-phone-sticky.png`（390×844、`scrollY 260`、`receipt "已保存"`、`headTop 0`）：画面确认「供应商　已保存　新建」钉在顶部，名册从下面滚过去，左右贴齐，与桌面同长相。

### 审计

`tools/audit-responsive.mjs`（12 档）、`tools/audit-interact.mjs`（桌面 1440×900 与手机 390×844 --mobile，存 `.impeccable/review/audit-interact{,-phone}.json`）：

| | 桌面 1440×900 | 手机 390×844 |
|---|---|---|
| tab 停靠点 | 30 | 30 |
| `:focus-visible` | **30 / 30** | **30 / 30** |
| `withoutAnyIndicator` | **[]** | **[]** |
| 标本弹窗外泄焦点 | 0 | 0 |
| 缩放 150 / 200 / 300% 横向溢出 | 0 / 0 / 0 | 0 / 0 / 0 |
| `prefers-reduced-motion` 下残留动画 | `[]` | `[]` |

手机 tab 顺序里能看到 `.rail` 的收放键（`btn quiet rail-toggle:筛选`）与通道格，焦点环与桌面一致。

**两处既有审计成交（与本改动无关，不改）**：每档 `overflowCount 1` / `clippedCount 1` 全都是 `.mp-count` —— `web/src/styles.css:829-837` 那个 `left: -10000px` 的屏外 live region，注释里明说故意放屏外（放 1×1 会被审计当成裁切）。该规则未被本改动触碰，**且在 1440px（我的媒体查询完全不生效处）报得一模一样**，属既有审计误报。`tinyCount 2` 是两颗 14×14 的 `.check input`（阈值 24px，非 44px 触控阈值）。

### 生产构建

`npm run typecheck` → `exit=0`，`error TS` 计数 **0**。
`npm run build` → `exit=0`，`dist/web/assets/index-Bhl9IIMV.css`（32.02 kB / gzip 6.69）、`index-QIAIYp7T.js`（194.36 kB / gzip 62.25），41 modules / 3.42s。8787 现在服的就是这份新构建，`tools/prov-head-boundary.js` / `do-prov-receipt.js` / `prov-receipt-sticky-check.js` 在它上面跑出的数字与 5174 逐项相同。

### 现场完整复原

所有探针都真建真删一次性供应商，跑完必 `tools/cleanup-probe-provider.js`。`config.json` 的 sha256 **每次跑完都回到 `7AF2ED38687A8A98E4201D95014A63AFEAEC5169ADDCA6EF73102E3838ADAFF2`**（与备份 `$env:TEMP\receipt-config-backup2.json` 逐字节一致，已核两次），供应商名册只有 `p_78j76c5s`（名 `a6`）。

---

## 四、未验到 / 已知边界

- **真机没验**：全部证据来自无头 Chromium 仿真。`position: sticky` 在 Safari 上对 `overflow` 祖先的处理与 Chromium 有差异，而本方案的成立**依赖** `.panel-scroll` 在这一档改成 `overflow: visible` —— 这一条真机上没验过。软件键盘顶起视口时的表现同样没验。
- **52px 槽位仍按英文最长词定**（EN `DELETED` 51.25px）。换更长的词（比如将来加一个 `SAVE FAILED` 之类的短回执词）刻线就会开始移动 —— 这正是 `--ok` 那条注释想守住的属性，但它是靠「选词」而不是靠机制守住的。
- **桌面从不粘**：桌面右栏本来就是自己的滚动区、`.bay-head` 一直在视野里，所以 `.prov-head` 在 ≥901px 是纯 `display` 意义上的 wrapper（`position: static`、背景透明、无边框）。这是刻意的 —— 不因为「顺便」就让桌面多一个粘性层。
- `.prov-head` 在手机档必须实底 `var(--panel)`：若将来这一节底色改成半透明，滚过去的内容会透出来。

## 留档探针（本轮新增 6 个）

| 探针 | 量什么 |
|---|---|
| `tools/prov-receipt-visibility.js` | 打开表单 / 保存两刻，标题行与 submit 键的 y、是否在屏内、gap、保存是否触发滚动 —— **用来核对 415px 那条旧理由** |
| `tools/prov-receipt-scrolled.js` | 把保存键 `scrollIntoView({block:'center'})`（最坏情况），标题行是否被滚出视野 |
| `tools/prov-receipt-roster.js` | 名册长度 1/2/3/4/6/8/12 × 四档视口，量「滚到保存键那一刻标题行是否整个在屏内」 |
| `tools/prov-receipt-sticky-check.js` | 粘块是否整幅宽实底、滚到保存键那刻回执是否在标题行内且在屏内、长句是否跟着粘、名字折行时「新建」是否被挤出屏 |
| `tools/prov-receipt-layers.js` | 三块粘性（`busbar` / `rail` / `prov-head`）谁盖谁、head 上方命中什么、与 rail 的真实面积交 |
| `tools/prov-head-boundary.js` | 六档宽度下 head 的 position/top/z/border/bg/flush/`--section-pad`/滚动容器 overflow |

另有 `tools/prov-section-height.js`（跨版本 A/B 用，只量共有元素）、`tools/shot-prov-receipt-web.js` + `tools/cleanup-probe-provider.js`（截图用的一次性建/删）。
