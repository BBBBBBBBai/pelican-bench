---
name: 动物骑单车测试台
description: 跨供应商同名模型横向对比工具 —— 哑光阳极氧化仪器面板、工业丝印、琥珀指示灯
colors:
  room: "#0c0c0b"
  panel: "#191917"
  panel-high: "#21201d"
  well: "#101010"
  engrave: "#2d2c28"
  engrave-lit: "#3d3a34"
  silk: "#e6e3da"
  silk-secondary: "#a8a49a"
  silk-mute: "#8f8c82"
  lamp-amber: "#f0a020"
  lamp-veil: "rgba(240, 160, 32, 0.14)"
  pass-green: "#8faa62"
  caution-amber: "#c8862f"
  fault-orange: "#e4643f"
  lamp-void: "#000000"
  relief-shadow: "rgba(0, 0, 0, 0.6)"
  relief-shadow-deep: "rgba(0, 0, 0, 0.65)"
  relief-shadow-deeper: "rgba(0, 0, 0, 0.75)"
  arm-edge: "#5a4520"
  halt-edge: "#5a2f22"
  halt-edge-lit: "#8a4630"
  halt-well: "#241512"
  reasoning-voice: "#8a7f68"
typography:
  address:
    fontFamily: "'Azeret Mono', ui-monospace, 'Cascadia Mono', Consolas, 'Microsoft YaHei', 'PingFang SC', monospace"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
    fontFeature: "'tnum' 1"
  reading:
    fontFamily: "'Azeret Mono', ui-monospace, 'Cascadia Mono', Consolas, 'Microsoft YaHei', 'PingFang SC', monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.01em"
    fontFeature: "'tnum' 1"
  silk-label:
    fontFamily: "'Archivo', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans SC', sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 74"
  section-head:
    fontFamily: "'Archivo', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans SC', sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.17em"
    fontVariation: "'wdth' 68"
  silk-caps:
    fontFamily: "'Archivo', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans SC', sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.09em"
    fontVariation: "'wdth' 76"
  body:
    fontFamily: "'Archivo', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans SC', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontVariation: "'wdth' 92"
  nameplate:
    fontFamily: "'Archivo', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans SC', sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.13em"
    fontVariation: "'wdth' 68"
  window-readout:
    fontFamily: "'Azeret Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.01em"
    fontFeature: "'tnum' 1"
rounded:
  square: "0"
  lamp: "50%"
spacing:
  hair: "1px"
  tight: "7px"
  gap: "9px"
  block: "12px"
  section: "18px"
components:
  button:
    backgroundColor: "{colors.panel-high}"
    textColor: "{colors.silk-secondary}"
    typography: "{typography.silk-label}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
  button-arm:
    backgroundColor: "{colors.panel-high}"
    textColor: "{colors.lamp-amber}"
    typography: "{typography.silk-label}"
    rounded: "{rounded.square}"
    padding: "12px 14px"
    width: "100%"
  button-halt:
    backgroundColor: "{colors.panel-high}"
    textColor: "{colors.fault-orange}"
    typography: "{typography.silk-label}"
    rounded: "{rounded.square}"
    padding: "12px 14px"
    width: "100%"
  switch:
    backgroundColor: "{colors.well}"
    textColor: "{colors.silk-mute}"
    typography: "{typography.silk-label}"
    rounded: "{rounded.square}"
    height: "28px"
  switch-on:
    backgroundColor: "{colors.room}"
    textColor: "{colors.lamp-amber}"
    rounded: "{rounded.square}"
  channel-tile:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.silk}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "0"
  channel-tag:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.caution-amber}"
    typography: "{typography.silk-caps}"
    rounded: "{rounded.square}"
    padding: "2px 6px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.silk}"
    typography: "{typography.reading}"
    rounded: "{rounded.square}"
    padding: "7px 9px"
  profile-slot:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.silk}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "8px 10px"
  model-pick:
    backgroundColor: "{colors.well}"
    textColor: "{colors.silk-secondary}"
    typography: "{typography.reading}"
    rounded: "{rounded.square}"
    border: "1px solid {colors.engrave}"
    rowHeight: "28px"
    receiptHeight: "20px"
    maxRows: 5
    maxHeight: "calc(5 * 28px + 20px + 2px)"
  preset-list:
    backgroundColor: "{colors.well}"
    textColor: "{colors.silk}"
    typography: "{typography.reading}"
    rounded: "{rounded.square}"
    border: "1px solid {colors.engrave}"
    padding: "5px 8px"
  specimen-modal:
    backgroundColor: "{colors.room}"
    textColor: "{colors.silk}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    border: "1px solid {colors.engrave-lit}"
    elevation: "0 18px 48px rgba(0, 0, 0, 0.66)"
    width: "min(1240px, 100%)"
    height: "min(820px, 100%)"
    motion-in: "sheet-seat 0.24s cubic-bezier(0.16, 1, 0.3, 1)"
---

# Design System: 动物骑单车测试台

## Overview

**Creative North Star: "The Anodized Bench"（哑光阳极氧化测试台）**

这套界面不是网页，是一台**仪器**。它假定自己坐在一张真的工作台上：哑光阳极氧化的深色面板、刻在面板上的工业丝印、凹进去的读数窗、以及只在通电那一路亮起的琥珀指示灯。房间里没有别的光源 —— **光只从灯里出来，不从边上漏**。所以这里没有渐变、没有玻璃、没有发光描边、没有投影，深度全部由「凹进去」和「刻上去」表达，而不是由浮起来表达。

密度是刻意的。这是一个要在一屏里扫过几十件作品、并且要能一眼截出单格发给别人的工具，所以信息密度优先于单条展示面积。字小（10.5–14px）但对比度全部过 4.5:1 —— 这些最小的字印的正是「哪一天、第几号通道、哪一家、什么参数」，就是这个工具的全部结论。

作品永远高于界面。每一次运行是一个**通道**，画面就是通道上那块被点亮的显示屏，界面在它周围退让：没有卡片容器、没有装饰边框、没有阴影垫在画面下面。屏幕上的画面尺寸固定为 4:3 且四边对齐，所以相邻两格的作品可以直接比大小 —— 这是这个工具存在的理由。

**Key Characteristics:**
- 哑光阳极氧化深色面板（`#191917`）坐在更暗的房间（`#0c0c0b`）里，两者之间只靠 1px 刻线分开。
- 琥珀（`#f0a020`）是默认世界里**唯一**饱和的颜色，只用于指示、选中和「正在通电」。
- 全是直角（`border-radius: 0`），唯一的圆是 7px 的指示灯。
- 两套字：Archivo 可变字体做工业丝印（窄体大写，`wdth 74`），Azeret Mono 做一切量化读数（tabular-nums）。
- 全局只有三个编排动作：灯丝亮起（`lamp-strike`，0.42s）、抽屉开合（见 `Fold`，打开 0.26s / 关闭 0.18s）、标本弹窗落座（见 `Plate`，进入 0.24s / 退出 0.18s）。别处不做入场动画。

## Colors

一套「暗房里的仪器」配色：三档几乎不区分的炭灰承担全部结构，三级丝印承担全部文字，四个信号色承担全部结论。

### Derived Values（不在上面的色板里，但是**有意的**，不是漂移）

设计检测器（`impeccable detect`）会把下面这些字面值报成 advisory。它们都被保留，理由如下 ——
**这是一份声明，不是待办清单**：

| 值 | 用在哪 | 为什么不能换成色板里的色 |
| --- | --- | --- |
| `#000` | 熄灭指示灯的内圈 `inset 0 0 0 1px` | 灯是一个**洞**。洞的边必须比凹槽（`#101010`）更黑，否则熄灭的灯会看起来像一块凸起的塑料。 |
| `rgba(0, 0, 0, 0.6 / 0.65 / 0.75)` | 所有 `inset` 阴影（凹槽、按钮按下、读数窗） | 这是**浮雕**不是颜色：它只负责「凹进去多少」，与色相无关。换成带色相的值会让面板显脏。 |
| `#5a4520` / `#5a2f22` | `开始生成` / `停止` 的 1px 边 | 琥珀与故障橙各自压暗到 30% 左右得到的**按钮边**。用原色描边会让按钮在这个亮度场里发光，违反 The Light-Only-From-Lamps Rule。 |
| `#241512` | `停止` 按钮的按下底色 | 故障橙压到 12% 的凹槽底。它是「按下去」的状态，不是一种新颜色。 |
| `#8a4630`（`halt-edge-lit`） | 两段式删除的 `确认删除` 边（`.btn.halt.armed`） | 故障橙压暗到 55% 的**提亮档**，与 `halt-edge`（`#5a2f22`，30%）同族 —— 就像 `engrave` 与 `engrave-lit` 的关系。闩扣下去时 1px 边从 `#5a2f22` 走到这里，是「刻线提亮」这条既有写法的橙色分支。仍然不能用原色描边 —— 那会让它在亮度场里发光。 |
| `#8a7f68` | 思考过程流 `.stream.reasoning` | 思考是**旁白**，要比正文（`--silk`）暗、比 `--silk-mute` 暖。它是丝印三级之外唯一允许的第四档，且只用在流式旁白上，不承载任何要读的结论。 |

### Primary
- **Lamp Amber** (`#f0a020`): 琥珀指示灯。用于：正在运行的通道、被选中的档案工位与筛选挡位、标本页左上角的通道地址、以及 `开始生成` 的按钮字。**它是这个界面上唯一允许饱和的颜色。**
- **Lamp Veil** (`rgba(240, 160, 32, 0.14)`): 琥珀的薄雾。只用作被点亮元素的大面积背景填充，不用于描边或文字。

### Secondary
- **Pass Green** (`#8faa62`): 一路走完、没挂任何标签。用在通道格左上角那颗 7px 小灯上。
- **Caution Amber** (`#c8862f`): 截断 / 非 SVG / 模型名不符。**它是刻字铭牌的颜色，不是灯的颜色** —— 挂标记时铭牌用这个色，而通道灯转成琥珀或故障色。
- **Fault Orange** (`#e4643f`): 请求失败、超时、渲染失败。用在标签文字、`删除` 按钮、以及标本页里 `响应模型` / `结束原因` 读数不匹配时的 `.hot` 状态。

### Neutral
- **Room** (`#0c0c0b`): 机架背后的房间。页面底色、标本页底色。
- **Panel** (`#191917`): 哑光阳极氧化面板。通道格、右栏区块、折叠块。
- **Panel High** (`#21201d`): 被手摸过、有点反光的面板。按钮底色、hover 的通道格、正在运行的那一格。
- **Well** (`#101010`): 凹槽。读数窗、输入框、开关底座、挡位按钮。
- **Engrave** (`#2d2c28`) / **Engrave Lit** (`#3d3a34`): 刻线。分隔线一律 1px，用 `gap: 1px` + 容器底色也能刻出缝。
- **Silk** (`#e6e3da`): 丝印主色，对面板 12.6:1。用于动物名、读数、正文。
- **Silk Secondary** (`#a8a49a`): 次级丝印，对面板 7.0:1。用于供应商名、按钮字。
- **Silk Mute** (`#8f8c82`): 刻线级丝印，对面板 5.2:1。用于字段标签、模型名、耗时。

### Named Rules
**The One Light Rule.** 一个屏幕里只允许一处饱和色出现：琥珀。信号色（绿 / 黄 / 橙）只以 7px 的小灯、或 10px 的刻字出现，永远不铺成面积。界面上任何一处大面积鲜艳色彩都是错的。

**The Three Silks Rule.** 丝印只有三档灰度，三级都必须过 4.5:1。不允许出现第四档更暗的灰 —— 「再暗一点会更好看」在这里是禁止的，因为最暗的那档印的仍然是要读的结论。

**The Never-Grey Rule.** 深色面上的次级文字从暖调前景取色（`#a8a49a` / `#8f8c82`），**不用中性灰**。中性灰会让哑光阳极氧化的暖调面板显得脏。

## Typography

**Display Font:** 无。这台仪器没有展示级字号 —— 最大的字是总线条读数窗里 16px 的数字与状态。
**Silk Font:** Archivo（可变字体，`weight 100–900`、`font-stretch 62%–125%`），退到系统 CJK 栈 `PingFang SC / Microsoft YaHei / Source Han Sans SC / Noto Sans SC`。
**Reading Font:** Azeret Mono（可变字体，`weight 100–900`），退到 `ui-monospace / Cascadia Mono / Consolas`，**再接 CJK 栈**（`Microsoft YaHei / PingFang SC`）—— 等宽面没有汉字，`第 26 条` 这类中英混排的读数否则会掉到一个宽 14.7% 的系统面上。

**Character:** 一对同代的无衬线 —— 丝印用 Archivo 的**宽度轴**压到 68–92 做窄体大写，读数用 Azeret Mono 的 tabular 数字对齐成列。这个组合读起来像仪器面板：字是刻上去的，数字是量出来的。中文不走自托管（体积不划算），仪器的口音由拉丁字母与数字承担。

### Scale

字号只有六档（`web/src/styles.css` 的 `--t-*`），**相邻两档至少差 1px** —— 0.5px 的级差在屏幕上看不出来，等于没有层级：

| token | 值 | 用途 |
| --- | --- | --- |
| `--t-micro` | 10.5px | 通道标记铭牌、通电格里的紧凑按钮 |
| `--t-label` | 11px | 丝印：字段名、按钮、挡位、抽屉标题、机读小字 |
| `--t-sub` | 12px | 次级：量化读数、供应商名、时间 |
| `--t-body` | 14px | 正文：动物名、选项、说明句、段落标题、空态 |
| `--t-name` | 15px | 铭牌 |
| `--t-address` | 16px | 凹槽读数窗 |

字距只有四档（`--track-label` / `--track-tag` / `--track-head` / `--track-mark`），前三档**在 `html:lang(zh)` 下整组收紧**（0.14/0.09/0.17em → 0.04/0.02/0.06em）。原因是实测的：**一个汉字正好 1em**，`letter-spacing` 在每个字形之后都加一份，所以 0.17em 的字距会把「供应商」三个字拆成三块互不相连的笔画，还把右栏宽度白吃掉 0.34em。拉丁大写需要拉开才像刻字，汉字不需要 —— 这条差异属于语言，不属于组件，所以写在 `:lang()` 里，而不是散在每个选择器里。

第四档 `--track-mark` 是这条规则的**例外**，它**不**在 `html:lang(zh)` 里被收紧：那是左上角铭牌上 `ANIMAL BIKE BENCH` 的字距，而这串字是这台仪器的编号，不是句子，它不跟着界面语言变。这个例外原先只写在注释里没有代码，铭牌借用了 `--track-label`，于是中文界面下实测只剩 **0.6px**（该是 1.95px）—— 一个「缺名字」的漂移，补的是名字不是数值。

### Hierarchy
- **Address** (Azeret Mono 700, 14px, tabular): 只用于通道地址。这是全世界级别最高的字，因为它是引用某一次运行的唯一坐标。
- **Reading** (Azeret Mono 400/700, 11–12px, tabular): 一切量化事实 —— 耗时、参数、用量、字符数、模型名。右对齐成一列。
- **Silk Caps** (Archivo 700, `wdth 76`, 10.5px, `letter-spacing 0.09em`, 全大写): 通道标记铭牌。**只在挂了标记时出现。**
- **Silk Label** (Archivo 700, `wdth 74`, 11px, `letter-spacing 0.14em`, 全大写): 字段标签、按钮字、顶栏读数标签。
- **Section Head** (Archivo 700, `wdth 68`, 14px, `letter-spacing 0.17em`, 全大写): 右栏的三个段落标题（供应商 / 本次运行 / 全局设置）。**它必须比字段标签大一号** —— 段落标题和字段名用同一个 `.silk` 的话，右栏就只剩一种文字，扫不出结构。
- **Nameplate** (Archivo 800, `wdth 68`, 15px, `letter-spacing 0.13em` = `--track-mark`, 全大写): 只用于左上角的 `ANIMAL BIKE BENCH`。它是全世界最窄、最重、字号最大的一行丝印 —— 铭牌压在机架正面，本来就该比别的刻字大一号。它**坐在一块底材上**：`--well` 凹槽 + 1px `--engrave` 刻线 + `inset 0 1px 2px rgba(0,0,0,0.65)`，和它右边那两个读数窗、语种开关同一族器物。改前它是透明底、无投影、只有一条右边线，在总线条上读起来像一张贴纸。内边距只给 `3px 12px`：总线条 54px、这块牌子实测 47.4px，想垫厚就得先跟总线条要地方。副行（`app.tagline`）从 12px 正文升格为 10.5px 丝印大写（`--t-micro` + `--track-tag`），和主行之间用一条 1px 刻线分开 —— 条上其他文字不是标签就是数字，只有它原来是一句散文，挂在铭牌后面像脚注。
- **Window Readout** (Azeret Mono 700, 16px, tabular): 只用于总线条读数窗里的数字与状态。它是全屏最大的等宽字，因为这些读数是操作者唯一需要**一眼**看到的东西。
- **Body** (Archivo 400, `wdth 92`, 14px, `line-height 1.5`): 题面、错误正文、说明文字。正文行宽上限 75ch。
- **Note** (Archivo 400, `wdth 92`, 14px, `--silk-mute`, 行宽上限 46ch): 面板里的口语化说明句、空态提示。**它不是路径**，所以不用等宽。

**汉字没有字重。** 实测 Microsoft YaHei 在 400 与 700 下的墨量完全相同（2093 对 2093），`font-weight: 600` 落在汉字上是个空操作。所以中文的层级**只能靠字号、颜色和字距**，绝不能靠字重 —— 给一行中文加粗来表达「这是我的主标题」在这个世界里是无效的。Archivo 的拉丁字重是正常的，别把这条推广到拉丁字母上。

### Named Rules
**The Width Axis Rule.** 丝印一律用 Archivo 的宽度轴压窄（标签 74 / 铭牌 68 / 按钮 82 / 正文 92）。**这不是装饰**：窄体让 11px 的大写标签在 348px 宽的右栏里放得下，同时仍然读得像刻字。永远不要用 letter-spacing 去假装这个效果。

**The Mono-Is-Not-Costume Rule.** Azeret Mono 只承载**量化事实**（时间、参数、用量、编号、模型名、地址）。它是读数，不是「技术感」的戏服 —— 正文、按钮、标签一律不许用等宽字体。

## Layout

两层网格。外层 `.bench` 用 `grid-template-areas` 摆三块：`'bus bus' / 'bay panel'`，两列是 `minmax(0, 1fr) 348px` —— 左边机架区，右边 348px 固定的控制台。用区域名而不是靠 DOM 顺序，因为手机单列时控制台要**挪到机架前面**（见下）。这一列承接名册的副行（`api.a6api.com · OI · T=1 · MAX=32000 · EFFORT=HIGH`）和被测模型名输入框（`≤ 620px` 时输入框 min-content 约 200px）—— 两者都允许折行，宽度不再是「刚好一行」的硬约束。

顶栏 `.busbar` 高 54px，是一条仪表总线条：机架数、通道数、运行状态读数窗，中间一个 `.spacer` 把语种开关推到最右。**这 54px 是宽屏的常数**，不是所有尺寸的：窄到放不下时它折行成两条（`≤ 900px` 实测 107px），`.spacer` 此时 `display: none`（`flex: 1` 在折行容器里只剩「撑开一行」的作用）。

筛选横杆 `.rail` 在宽屏是 `flex-wrap: wrap` 的，高度随内容。它上面有：供应商挡位、题目下拉、排序 / 格宽 / 仅看异常三组开关、复位、以及最右的 `显示 24 / 24` 读数。1440px 下它自然折成两行。

**窄屏（`≤ 900px`）它收成一行摘要。** `.rail-line`（44px，写「现在生效的是哪几个条件」+ 计数 + 一颗「筛选」键）常驻；全部控件关在 `.rail-full` 里，点开才放出，用的是与 `.fold` / `.prov-slot` 同一套 `interpolate-size: allow-keywords` + `block-size` 过渡。收起来的横杆是 `position: sticky; top: 0`，只吃 44px —— 改之前它 238px 常驻（28% 的视口），并且和日期带抢同一个 `top: 0`，把带子整个压在身下。`.rack-band` 因此钉在 `calc(var(--rail-line-h) + 1px)` 上。

机架区按天分组：每天一条 `.rack-band`（`R 2026-10-06` + 1px 刻线 + `24 路` 读数），下面是 `.rack-grid`。**网格是 `auto-fill` + `gap: 0`**，线靠每个格子左上两条 border 拼出来 —— 所以整面机架看起来是一整块被刻开的板，而不是一堆卡片。格宽三档由 `--ch-min` 控制：密 148px / 中 220px / 疏 320px。

**行高必须整齐。** 画面固定 `aspect-ratio: 4 / 3`，标记铭牌有固定槽位（`min-height: 19px`，一个标记都没有也占着）。这两条常数让所有行等高，**不允许用给格子加 `aspect-ratio` 的办法去凑** —— 那会压缩画面，而画面是这个工具的主体。

响应式断点：1040px（右栏收窄到 300px）、900px（**单列：控制台落到机架上方**，横杆收成一行摘要，**供应商段的标题行连同回执一起粘住**）、620px（手机：总线条改为可折行、挡位换行显示全名、格宽三档全部重给 132/168/210px、标本弹窗头部折行、`.bay-section` 的内边距变量 `--section-pad` 从 16px 收到 12px）。另有一档按**指针**而不是宽度判断：`@media (pointer: coarse)` 把 `.sw > button` / `.detents > button` / `.btn` / 输入框 / `.mp-cell` / `.fold > summary` / `.check` 全部抬到 `--switch-h`（44px），`.check input` 放大到 20px，模型候选表那一档只换两个常数 —— `--mp-row-h` 从 28px 换成 `--switch-h`、`--mp-rows` 从 5 收到 3 —— 封顶是从这两个数算出来的（162px / 140px → 154px / 132px），算式不在这里重抄一遍（手指那 44px 行高下，五行等于 220px，会把「开始生成」顶出首屏），并关掉 `.ch:hover` 的提亮 —— 手指没有 hover。带触屏的笔记本两个指针都真，所以这里按主指针判断，不按宽度。手机横屏另有一档 `(max-width: 900px) and (min-width: 560px) and (max-height: 520px)`：回到两列 `'bus bus' / 'bay panel'`，机架与控制台各自滚自己的（`.rack-scroll` 在这一档要**恢复** `overflow-y: auto` —— 单列那一档把它拆成了假容器，两列时它必须自己滚，否则机架会撑到 4926px 从 `.bay` 里溢出去，390px 高的窗口里一往下滚控制台就跟着走），此时 `.rack-band` 钉回 `top: 0`。`prefers-reduced-motion` 下关掉 `lamp-strike`；抽屉、供应商槽与弹窗保留淡入淡出、抹掉位移，横杆的展开也直接跳变。供应商槽的两块同格同位，所以那一档不交叉淡化，改成让位的那块直接跳变、接上的那块 0.14s 淡入 —— 任何一帧都只有一块可见。

## Elevation & Depth

**这套系统没有浮起来的东西。** 深度只有两种表达，都是「接收光」而不是「投出影子」：

1. **凹进去**（`.well` / 输入框 / 开关底座 / 被选中的工位）：`box-shadow: inset` 一条顶部的暗边，加一点内阴影。光从上方来，凹槽的上沿背光。
2. **刻上去**（面板之间的分隔）：1px 的 `--engrave` 线。不用 border 撑出体积感。

**唯一例外是标本弹窗**（见 `Plate`）：它确实浮在房间上方，所以它必须用同一套影子词汇说话——有偏移、有柔化、绝无颜色。这不是「允许发光」，是把 `.toast` 那条既有的 `0 6px 20px rgba(0,0,0,.6)` 放大一号。**仍然禁止彩色光晕。**

### Shadow Vocabulary
- **Cavity** (`inset 0 2px 4px rgba(0, 0, 0, 0.8)`): 凹槽。输入框、开关底座、被按下的挡位、被选中的档案工位。
- **Plate Edge** (`0 1px 1px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.055)`): 按键的实体感 —— 一条底部投影加一条顶部受光。**必须带偏移**，零偏移的彩色光晕是装饰，禁止。
- **Seated Panel** (`0 18px 48px rgba(0, 0, 0, 0.66)`): 标本弹窗落座时的影子。有偏移、有柔化、无色，是 `Plate Edge` 的放大版而不是新词。**绝不用彩色。**
- **Lamp Glow** (`0 0 5px rgba(143, 170, 98, 0.55)`): 只加在指示灯上，用来表达「这一路正在通电」。四种点亮的灯各有自己的色（通行绿 / 注意琥珀橙 / 故障红 / 通电琥珀），运行中的那一路是 `0 0 8px` 并且会亮起来。熄灭的灯没有光晕。

### Named Rules
**The Light-Only-From-Lamps Rule.** 除了指示灯自己，屏幕上任何东西都不发光。禁止彩色光晕、禁止 `text-shadow`、禁止渐变文字、禁止 backdrop-filter。要表达强调就用**刻线提亮**（`--engrave` → `--engrave-hi`）或**凹槽加深**，不用发光。

**The No-Nesting Rule.** 一个通道格内部不允许再出现有边框的容器。画面直接坐在面板上，丝印直接刻在面板上。嵌套卡片永远是错的。

## Shapes

直角是这个世界的形式语言。全站只有两个 `border-radius` 值：`0`（一切）和 `50%`（7px 的指示灯）。

边框只有一种：`1px solid var(--engrave)`（刻线）或 `1px solid var(--engrave-hi)`（按键轮廓）。**没有大于 1px 的彩色边框**，也没有 `border-left` 当强调条的用法 —— 要分隔就整条刻线，要强调就整块凹槽。

被选中的状态有两种写法，都借自真实的仪器：**凹进去**（挡位与工位：底色转 `#0b0b0a`、文字转琥珀、加 `inset` 阴影），或**套一圈琥珀轮廓**（正在运行的通道、被跟踪的那一格：`outline: 1px solid var(--lamp); outline-offset: -1px`）。

渲染失败的空画面用一顶 `repeating-linear-gradient` 的 45° 斜纹帽（alpha 0.11，周期 7/14px）填满。**这是全世界唯一允许的斜纹**，因为它表达的是「这里本该有东西」的故障语义，不是纹理。空画面是这个工具能拿到的最坏结果，所以它不能是屏幕上最安静的那一格。

## Components

### Buttons
- **Shape:** 直角，1px `--engrave-hi` 刻线轮廓。
- **Primary（普通动作）:** `--panel-high` 底、`--silk-secondary` 字、`padding: 8px 12px`、Archivo `wdth 82` 700 11.5px 全大写 `letter-spacing 0.12em`、带 Plate Edge 阴影。
- **Hover / Focus:** hover 底色转 `#262521`、字转 `--silk`；active 加 `inset` 凹槽并 `translateY(1px)`（像真的按下去）；`:focus-visible` 统一 `outline: 2px solid var(--lamp); outline-offset: 2px`。
- **`.arm`（开始生成）:** 琥珀字 + `#5a4520` 边框，hover 底色 `#241d10`。XL 尺寸（14px 字、`padding: 12px 14px`、`letter-spacing 0.17em`、`width: 100%`）。
- **`.halt`（停止 / 删除）:** 故障橙字 + `#5a2f22` 边框，hover 底色 `#241512`。与 `.arm` 同尺寸 —— 它们是同一个位置上的两个状态。
- **`.halt.armed`（两段式删除的第二段前）:** 删除要按两次：第一次按**什么都不删**，只是把键扣下去。文字换成 `确认删除`、键座沉进 `#241512`、`inset 0 2px 4px` 加深成 `inset 0 3px 7px`、1px 边从 `#5a2f22` 提亮到 `#8a4630`。**不发光、不铺面积、不放大、不加粗** —— 与 `.sw` / `.detents` / `.slot` 的选中态是同一句话：凹进去，读起来像一个真的被按进去的挡位，而不是一个被高亮了的按钮。用 `aria-pressed` 表达这个相位，不是 `aria-label`：文字已经换过了，屏幕阅读器读到「确认删除，已按下」正好就是这件事。换档案、点「编辑供应商」、按 Esc 都会把闩弹回 —— 改主意必须有一个出口。`transition` 走 0.18s（例行状态变化的下沿），**刻意不给键本身 `transform`**：那 1px 是 `:active` 的瞬时按压，别的按钮都是瞬时的，这一颗不该例外。**扣闩那一下是两层的**：键面上的刻字（`.halt-face`，一个包住图标与文字的 `inline-flex`）先沉 `translateY(2px)`，0.18s；底、边、字、凹槽这四样后跟上，0.42s（这台仪器最长的一档编排时长，与 `lamp-strike` 同一个数）。先感到字动了、才感到整块凹下去，读起来像闩扣压着键面往下走，而不是整块底同时淡进来。位移只加在内层 span 上，所以那条「不加 `transform`」的规矩仍然成立 —— 沉的是刻字，键框不动。**退出比进入快**：`.armed` 一撤，时长就回到 `.btn.halt:not(:disabled)` 的 0.18s。**供应商与测试记录共用这一条规则** —— 同一台仪器里同一件事只有一种长相，不为第二处删除另写一套。原先挂在 `window.confirm` 上的那句后果说明（「文件会一起没」）移到了按钮下方，只在闩扣下后出现的 `p.note[role="status"]`（`color: var(--fault)`、`maxWidth: 62ch`），**刻意不播入场动画**：状态变化在这台仪器里是即刻的，多一段淡入反而像在催人。
- **`.quiet`:** 透明底、无阴影、`--engrave` 轮廓。用于低频动作（编辑档案、复位筛选）。
- **`.quiet[aria-pressed='true']`（开着 / 已在替你干活的两态键）:** 通电格输出流头上那颗「自动滚动」是个开关，不是一次动作：它开着时，流每来一段就替你贴到底；关掉就停在原处。原先它只有 `aria-pressed`（挂在 `LiveBay.tsx` 上），样式表里却没有任何 `.btn[aria-pressed='true']` 规则 —— 于是开与关逐像素相同，「我正在替你贴着底滚」这件事在屏幕上根本不存在，只能靠滚一下试试来反推。现在照 `.sw` / `.detents` 的选中态抄，不改一个值：底沉进 `#0b0b0a`、字转琥珀、`inset 0 2px 4px` 加 `inset 0 -1px 0` 的真凹槽。**不发光、不铺面积、不放大、不加粗** —— 与 `.sw` / `.detents` / `.slot` / `.halt.armed` 是同一句话。1px 边保持 `.quiet` 原来的 `--engrave`：选中不改尺寸，也不换轮廓（套琥珀轮廓那条留给 `data-tracked` 与 `.ch.live`，而且 `:focus-visible` 已经占着 `outline`，抢同一个属性会把焦点环吃掉）。**刻意不给这条规则写 `transition`**：底与字沿用 `.btn` 自带的 0.14s，凹槽瞬时落位 —— 与 `.sw > button` 一样（它也只过渡 `color`，凹槽是瞬间的）；状态变化在这台仪器里是即刻的，不为它单开一段入场。hover 那一档必须一起写死（`.btn.quiet[aria-pressed='true']:hover:not(:disabled)`）：它与 `.btn.quiet:hover:not(:disabled)` 同分，不写就变成由源码顺序决定胜负，太脆。`:not(:disabled)` 照 `.arm` / `.halt` 的规矩 —— 一盏亮在断路上的灯不成立。**这条规则还多带一个 `:not(.halt)`，是被真事故逼出来的**：`.btn.quiet[aria-pressed='true']:not(:disabled)` 是 (0,4,0)，而 `.btn.halt.armed` 只有 (0,3,0)，于是「删除」扣下闩之后字变成琥珀 `--lamp`、底变成 `#0b0b0a` —— `.halt.armed` 里写的那两个值一次都没生效过，只有边框侥幸对了。这正是 `.btn.halt` 那段注释在骂的事，只是方向反过来：**不是故障橙借给了 disabled，是琥珀借走了故障橙。** 闩扣不是开关 —— 它没有「开着」这一态，它只有「已经扣下」，所以它不归这条规则管。
- **`.icon`:** `padding: 6px 8px`，配一个自绘的 14px 图标。
- **Disabled:** 字转 `--silk-mute`（对 `--panel` 5.2:1 —— 丝印三档全部 ≥4.5:1 是规矩，disabled 不是逃出这条规矩的许可证），底退到 `--panel`、刻线退到 `--engrave`、无阴影、`cursor: not-allowed`。**状态由「平不平」承担，不再由「看不清」承担。** 禁用态同时吃掉 `.arm` / `.halt` 的颜色（`.btn.arm:not(:disabled)` / `.btn.halt:not(:disabled)`）—— 一盏亮在断路上的灯不成立，一颗按不动却红着的键也不成立。

### Switch（拨档开关）
- **Style:** 这是这个世界里最重要的控件。`--well` 底座 + 1px 刻线，里面是一排 `aria-pressed` 按钮，按钮之间用 1px `--engrave` 分隔。
- **State:** 未选中是 `--silk-mute` 透明底；选中是 `#0b0b0a` 底 + 琥珀字 + `inset 0 2px 4px` 凹槽。**读起来像一个真的被按进去的挡位**，不是一个 highlight 的 tab。
- **用于:** 排序（新的在前 / 旧的在前）、格宽（密 / 中 / 疏）、状态（全部 / 异常 / 正常）、语种（中 / EN）、思考强度（六档）。
- **六档的宽度问题（`.effort-row`）:** 拨档开关默认每颗按钮左右各 10px，六档塞进 313px 的折叠体会**溢出去**（实测 EN 下 339.9px，超 27px；中文 261.1px 放得下，EN 因为字距更宽是 291.9px，只剩 9.1px 余量）。所以 `.effort-row .sw > button` 单独把 `padding-inline` 收到 6px，**只在这一处收** —— 收窄的是内边距，不是字号，挡位名字仍然完整可见（截成 `xhi…` 等于把这个控件废掉）。六档名字 `minimal / low / medium / high / xhigh / max` 是发到线上的枚举值，**不进 i18n**，照原样印（同 `OI` / `ANTH`）。
- **供应商挡位（`.detents`）:** 同一套逻辑的横向变体，但按钮之间用 `gap: 1px` + 容器 `--engrave` 底色刻缝，**并且 `flex-wrap: wrap`** —— 折行之后每一段依然是被刻开的，机器感不会因为换行就散掉。名字必须显示全，截成「南…」等于把这个控件废掉。
- **状态筛选（`.rail-group.status-group`）:** 它是横杆上唯一一个**三档**的开关：全部 / 异常 / 正常。改之前它是一颗裸在 `.rail-groups` 里的 `.sw`，**这一排唯一没有可见标签的组**（供应商、题目、排序、格宽四组都有 `<span className="silk">`），于是语义全压在选项文字上，逼出「只看有异常的」那 88.6px —— 整个控件 134.5px。现在它补上标签「状态」并挂进 `.rail-group`，选项就只剩两个汉字：长句子退到 `title` 上（悬停与读屏仍拿得到「只看有异常的」/「只看无异常的」全文）。**代价是实测出来的**：标签 22.9px + 组内 `gap: 8px` 让整组到 163.6px，而折行的第一行只剩 162.2px —— 差 1.4px 就折到第二行、横杆从 77px 长到 86px。所以 `.rail-group.status-group .sw > button` 把 `padding-inline` 从 10 收到 8（每颗省 4px、三颗省 12px，整组 151.6px）—— 这是继 `.effort-row` 之后**第二处**收窄选项内边距的地方，两处都只为一个组，收的都是内边距不是字号。EN 下整组 203.7px（`STATUS` + `ALL / ISSUES / CLEAN`），横杆 79px，不溢出。

### Channel Tile（通道格 —— 签名组件）
- **Corner Style:** 直角。
- **Background:** `--panel`；hover 转 `--panel-high` 且画面区微微提亮。
- **Border:** 每格左上各一条 1px `--engrave`（由容器给），拼成整面机架。
- **内部结构（自上而下）:** `.ch-head`（**左上角** 7px 状态灯 + `.spacer` + 耗时读数 + **右上角** 通道编号，高约 30px）→ `.ch-plate`（`aspect-ratio: 4 / 3`，画作 `object-fit: contain`，**背景透明，作品自己的底色原样透出来**）→ `.ch-silk`（动物名 14px + 供应商名 12px + 模型名 11px 等宽 + **`.ch-when` 日期与时刻 11px 等宽** + 标记铭牌槽位）。

  格子里那四行是一条**由重到轻的链**：`14px --silk` → `12px --silk-dim` → `11px 等宽 --silk-mute` → `11px 等宽 --silk-mute`（实测对比度 13.7 → 7.1 → 5.2）。层级靠字号、颜色和「Archivo 转等宽」这三件事一起扛 —— 因为汉字没有字重可用，光靠加粗在这四行里排不出主次。
- **为什么格子里要有日期：** 机架带上的 `R 2026-10-06` 是粘性的、跟着滚动，单独截一格发出去时不会被一起截走。所以「什么时候」必须长在格子里 —— 一格被单独截走时要能自己说清：什么动物、谁画的、哪个模型、哪一路、什么时候。
- **标记铭牌（`.tag`）:** Archivo `wdth 76` 700 10.5px 全大写 `letter-spacing 0.09em`。只有两种色调：**要注意 = `--caution-amber`，真出事 = `--fault-orange`**。没有「安静」的第三档 —— 既然挂了标记，它就该被看见。**槽位永远留着**（`min-height: 19px`），哪怕一个标记都没有，否则有标记的那一行会比别的行高。10.5px 配 0.09em 是量出来的：`MODEL MISMATCH` 这样最长的英文标记要在手机最窄的 132px 格子里放得下（实测 104px，装得下）。
- **被跟踪（`data-tracked`）:** 刚跑完的那一格套一圈 1px 琥珀 `outline`，底色转 `--panel-high`。

### Inputs / Fields
- **Style:** `--well` 底、1px `--engrave` 刻线、直角、`padding: 7px 9px`、Archivo 正文 14px（`textarea` 这类机读输入走等宽 12px）。
- **Label:** 在输入框**上方**，Archivo `wdth 74` 700 11px 全大写 `letter-spacing 0.14em`，色 `--silk-mute`。
- **Focus:** `outline: 2px solid var(--lamp)`，不是 border 变色。
- **Checkbox:** 不画圆角、不用浏览器默认外观 —— 14px 方形凹槽，勾选时琥珀填底。**永远包在 `<label class="check">` 里**，命中区是整行文字加方块。

### Profile Slot（档案工位）
- **Style:** 名册里一行一个工位，`--panel` 底、`padding: 9px 10px`、下沿 1px 刻线（最后一行没有）。`align-items: flex-start` 而不是 `center` —— 铭牌是三行，居中会让领衔那行每换一家就上下跳。
- **铭牌是三个寄存器，不是两行:** ① **主机名**领衔（`.slot-host`，Archivo 15px w600 `wdth 92`、`line-height 1.3`、`letter-spacing -0.005em`、`--silk`）；② **工位名 · 协议**（`.slot-name`，10.5px w700 全大写、`letter-spacing 0.04em`、`wdth 82`、`--silk-mute`，正好是主机名的 0.7 倍 —— 汉字没有字重，档位只能靠尺寸与字距拉）；③ **参数**（`.slot-sub`，Archivo 11px w400、tabular、`--silk-mute`）。形如 `api.a6api.com` / `a6 · OI` / `T=1 · MAX=32000 · EFFORT=HIGH`。
- **为什么是主机名领衔:** 实测三家供应商的副行**去重后只有一种** —— 52 个字符里 39 个每家都一样，`banban-0.18` 与 `banban-0.23` 整行逐字节相同。把同一句话印三遍是「没有信息」，不是「可读性差」。真正区分这三行的是**往哪儿发**，而工位名是你自己随手起的（可能叫「备用 2」），不构成身份。改之前层级是反的：`.slot-name` 14px 领衔、`.slot-sub` 行盒 31.9px，是名字行盒 21px 的 **1.52 倍** —— 脚注比名字还大。
- **参数行为什么不用等宽:** 这一行混着主机名与协议这样的**词**，而 Azeret Mono 的角色是「量化事实」（The Mono-Is-Not-Costume Rule）。数字对齐靠 `font-variant-numeric: tabular-nums`，不靠字族。**副行不再印模型名** —— 模型名已经不属于供应商了（见下面的 Model Under Test）。**副行印的是这家站实际会发出去的参数**（全局默认合过它自己写的那几项），不是「它覆盖了什么」—— 留空的项在这里也得看得见值。**参数串是量化事实，省略号不许吃掉 `EFFORT=HIGH` 的尾巴 —— 所以这一行允许折行，而不是缩字号。** 实测过：` · ANTH · T=1 · MAX=64000` 在 348px 栏里超 37px，缩到 10.5px 仍然超 20px；右栏在 1040px 断点收窄到 300px 后更是超 85px；`EFFORT=HIGH` 又比 `MAX=8192` 长了 9 个字符。原先「收窄时退到 10.5px」是一条救不了场的假药方，已删除。同理 `.slot-name` 也不再用省略号 —— 工位名必须看得全。
- **State:** hover 微微提亮；被选中是 `#0a0a09` 底 + **琥珀主机名** + `inset` 凹槽。**选中只换颜色，不改变任何尺寸**（不许用加粗或放大来表达选中）。琥珀落在主机名而不是工位名上，与上一条同因：这一行里被选中的是「往哪儿发」这件事。
- **KEY 铭牌只在缺 key 时出现** —— 八行都印「已存 KEY」等于八行都没印。铭牌只用在例外上。
- **回执（`.prov-receipt` / `.prov-receipt-note`）就地长在标题行里。** 保存 / 删除 / 校验失败的结果不是浮在屏幕上的提示框，而是刻进「供应商」标题行的一段丝印：`right` 里先是一条固定 **52px** 的槽位（按最长的英文词 `DELETED` 实测 51.25px 定，中文「已删除 / 已保存」37.63px），再是「新建」键。**槽位宽度写死不随文字变** —— 否则每来回执一次，那条分隔刻线（`.bay-head .rule`）都会跟着抖一下。成功走 `--ok`（对 `--panel` 6.79:1），没有入场动画。失败是长句子，另起一行 `p.note`（`--fault`、`max-width: 62ch`），紧贴在标题行下面。**两种回执都不许离开标题行。**
- **窄屏（`≤ 900px`）这一块整体粘住。** 包一层 `.prov-head`（`position: sticky; top: 0`、`--panel` 实底、下沿一条 `--engrave` 刻线、左右用负外边距铺满整幅宽）。这样回执在滚到下面的表单时仍然跟眼睛在一起。改之前这里是把回执改成 `position: fixed` 钉屏幕底部 —— 那条路是因为「标题行离保存键 415px、必然在屏幕外」而选的，但那个 415px 是**控制台还在机架之后**时测的；控制台提到前面之后，实测名册一长（390×844 超过 6 家）标题行照样滚出视野，所以钉底部只是把一个「看不见」换成另一个「不同处」。`.panel-scroll` 在这一档必须 `overflow: visible` —— 否则它是个假滚动容器，会把粘性关在盒子里（与 `.rack-scroll` 同一毛病）。横屏那一档恢复两列、`.panel-scroll` 回到 `overflow-y: auto`，`.prov-head` 与 `.rack-band` 一起钉 `top: 0`。
- **开合（`.prov-slot`）:** 与 `Fold` 同一套机制（`interpolate-size: allow-keywords` + `block-size` 过渡），不是第四个编排动作，是同一个动作落在另一处。两块（`.prov-slot-out` 的「编辑 / 删除」与 `.prov-slot-in` 的表单）**装在同一个 grid 格子里**，不是上下摊开——摊开的话上面那块缩高会把下面这块整体往上拽，盒子往下长、内容往上走，两个方向同时在演。方向一律**朝下**：按钮 `translateY(0→5px)` 沉进槽底，表单 `translateY(-6px→0)` 从槽口上沿落下来（和 `Fold` 的内容同向）。同格同位，所以两块必须**接力**而不是同时淡：无论正常路径还是 `prefers-reduced-motion`，任何一帧都只有一块在变化中——正常路径按方向各排一次先后（展开：按钮 0.12s 让位、表单 0.08s 后落，收在 0.26s 与槽口长到位同时；收起：表单先撤、按钮 0.06s 后回），减动效路径则让位那块直接跳变、接上那块 0.14s 淡入。

### Model Under Test（被测模型 —— 本次运行的一个必填输入）
- **为什么不在供应商里:** 这个工具问的唯一问题是「同一个模型名，在不同供应商名下表现如何」。模型名如果存进档案，就等于让每一家自带一个被测量，横向对比立刻失效。所以档案只记**往哪儿发、拿什么密钥发、默认参数是什么**；模型名是每一次运行现场定的。
- **位置:** **必须放在折叠块外面。** 折叠块装的是「这一家默认值之外我临时改了什么」——模型名没有默认值可言，每次必须现选，所以它没有资格被折起来。它排在「本次运行」的运行数据下面、参数抽屉上面，是这一段的第二个必填项。
- **样式:** 一张**随候选数长高、最多五行**的单列凹槽表。外层的 `.mp-slot` 才是那块凹槽（`--well` 底、1px `--engrave` 刻线、inset 投影），它按内容定高、封顶 `calc(var(--mp-rows) * var(--mp-row-h) + var(--mp-foot-h) + 2px)` = 162px；里面只有 `.mp-grid` 一层滚动，封顶 `calc(var(--mp-rows) * var(--mp-row-h))` = 140px。**三个常数各有一个名字（`--mp-row-h` / `--mp-foot-h` / `--mp-rows`），都挂在 `.model-pick` 上；封顶是从它们算出来的，不是抄来的。** **行高 28px，五行整好 140px —— 第六行才滚，不是表在滚。** 每行是一个 `--well` 底的真 `<button role="option">`，行内 9px 方形指示灯（`.mp-dot`）+ 等宽模型名（`.mp-name`，Azeret Mono 12px）。选中行 `#0b0b0a` 底、琥珀名与琥珀灯。上方 14px 正文输入框既显示已选值，也是搜索框 —— 子序列模糊匹配（`dsr` 命中 `deepseek-v3.2-reasoner-preview`）。无命中时 `.mp-grid[data-empty='true']` 撑到 64px（够英文那两句折行），整格印 `没有候选匹配 —— 仍会用你输入的名字`。
- **底部读数条（`.mp-foot`）:** 凹槽底下那 20px 是**回执**，印 `{n} 个候选`。它存在的原因是这张表**不再是固定 220px**：行数不足五行时，凹槽和「开始生成」之间原本会留一条**没有任何标记的 `--well` 空带** —— 三行时那条约 134px，占凹槽的 61.5%，冷启动看起来像「没保存上」。读数条把这条空带占住并解释它：空不是坏了，是清单就这几条。**只印筛出来的条数，不印清单总数** —— 不过滤时两个数永远相等（「2 个候选」和「共 2 条」说的是同一件事），并排出现读起来像互相矛盾，所以那个总数被删掉了。代价是过滤时读不出「清单本来多长」；这一条由清空输入框即恢复全部候选来兜底。**另一个代价是诚实的：** 表高随候选数变，所以过滤时下面的「开始生成」会跟着走（1 行 → 5 行之间 112px）。原先那条「固定 220px 钉住瞄准点」的理由让位给这条 —— 用户明确要的是自适应高度，而空带是每天都在看的，按钮位移只在打字的那一秒。**它同时是这一格里唯一的 live region**（`role="status"`）：条数是打字时唯一会变的反馈，而活区必须是眼睛正在看的那个东西。原来那个屏外播报格（`.mp-count`，`position: absolute; left: -10000px`）已经删掉，空态 `.mp-empty` 也不再播报 —— 两个活区同时改口，读屏会连着念两遍同一件事。
- **候选是便签，不是记录:** 候选表的内容来自 `config.json` 的 `modelPresets`，出厂值是 `shared/types.ts` 里的 `DEFAULT_MODEL_PRESETS`；它在**全局设置 → 模型候选清单**里可以逐行改。但「可编辑」不等于「有数据源」—— 这张清单**不是**从服务端拉的事实记录，它不写进任何 record、不算异常标记、也不进 `data/`。它是给手用的快捷键，不是测量结果。
- **候选清单的编辑面（`.preset-list`）:** 一张与 `.mp-grid` 同词汇的单列凹槽表（`--well` 底、1px `--engrave` 刻线、inset 投影），但它是**定宽不定高**的，行数随清单走，所以行间刻缝用 `inset 0 1px 0` 而不是 `gap`。每行 = 一个等宽名字格 + 一个 29px 的删行格（与 `.mp-clear` 同尺寸）；表尾留一个同构的空槽当「往里添一行」的落点，它占位对齐竖缝但没有落点。标题行右侧一颗 `.btn.quiet.dense` 写回 `DEFAULT_MODEL_PRESETS`，与出厂值一致时 `disabled`。
- **清单下面不再有说明段:** 这里原本有一段 `.note`（`「要测哪个模型」列出来的就是这张清单。改它不动任何一条记录，清空它也不挡任何一次运行 —— 模型名始终可以手打。空行与重名在离开那一行时被清掉。`），实测高 84px，把「文件位置」整段往下推。它一次想说四件事，而这四件事里有两件是**这张表自己已经说出来的**（表里就是那些候选、表尾那一格就是「往里添一行」），另两件属于设计决定而不是操作说明。删掉之后：`.preset-list` 与下面那行 `.silk` 之间的间距由 14px 提到 18px（用户在被接受的那一版里把这段空气定成了 4px）。**代价记在这里：**「改这里不影响已有记录」「空行与重名会被清掉」这两条现在界面上不再出现，只能从上面那条「候选是便签」读到。要找回它，就从这条记录里取原文。
- **提交时机是离开那一行:** 回车与失焦同义（回车只是主动 `blur()`），提交走 `saveGlobal({ modelPresets })`。清洗规矩与 `server/config.ts` 的 `coercePresets` / `server/index.ts` 的 `sanitizePresets` 逐条同一套：trim、丢空串、保序去重 —— 三处必须一致，否则界面上干净了、存回去又变脏。`PUT /api/config` 对数组是**整体替换**（不是 `defaultParams` 那种浅合并）：删掉一行就得算数。
- **门禁有两件事，就说两句不同的话:** 挡「开始生成」的原因有两种 —— 没选供应商、没填模型名。原来两种情况共用一句 `先选定模型名才能开始生成`：一家供应商都还没建的人被叫去填模型名，照着做也点不动。现在 `gateReason` 分 `profile` / `model` 两支，各印各的（`先选一家供应商` / `先选定模型名才能开始生成`），同一句话同时出现在标题行右侧的 `.mp-status` 和按钮的 `title` 上，两处永远一致。**门禁只挡这两件事** —— 换供应商不清空模型名：换一家就重选一次，等于把唯一要控制住的变量变成手抖。参数抽屉的临时值仍然按供应商清空（那个确实属于「这一家之外」）。

### 启动失败（`.empty`）与断线
- **启动失败不是死墙:** `npm run dev` 里前端和后端是两个进程同时在起，Vite 先就绪是常态，所以第一次读配置失败很正常。原来这一页只印一行错、**没有第二颗按钮** —— 唯一的出路是自己想起来刷新。现在错句下面跟一颗 `.btn` 的「重试」，点了就重新走一遍 `reloadConfig` + `reloadRecords`，成功即整页接上。**错句本身是 `.read` 的 `--fault` 原文**（HTTP 状态、服务端那句 `error`），不美化 —— 这一页是给操作员排障用的，不是给人看的门面。
- **两种「没连上」要分开说，而且都不许把浏览器的话甩给操作员:** 离线 / 连接被拒时 `fetch` 只抛一句 `Failed to fetch`，那是给开发者看的；流建立之后连接被掐断（后端进程被杀最常见）则**一个事件都没有**，原来的代码会静静地结束，界面永远停在「运行中」。现在前者印 `连不上本地服务 —— 确认后端还在运行`，后者印 `连接中断，这一趟没有结果`。**这两句都走 i18n**，`api.ts` 只收调用方传进来的文案，自己一句中文都不持有。用户自己按「停止」不算断线，不印任何话。

### Fold（折叠块）
- **Style:** 1px `--engrave` 边框、`--panel` 底、直角。
- **Summary:** `padding: 9px 12px`、丝印大写标签、自绘的 6px 三角（两条 1px 边旋转 45°），**不用浏览器默认三角**。必须是真 `<details>`：`<summary>` 离开 `<details>` 就是一个不响应的死标签，点不动、也没有 `[open]`，三角连转都不会转。
- **开合（全世界第二个编排动作）:** 抽屉从凹槽里长出来，不是淡入淡出。用 `::details-content` 过渡 `block-size`（`html` 上开 `interpolate-size: allow-keywords` 让 `auto` 可插值）+ `content-visibility` 的 `allow-discrete`，关上的瞬间内容留在渲染树里，等高度过渡完再拆。打开 0.26s、关闭 0.18s（退出比进入快），`cubic-bezier(0.16, 1, 0.3, 1)`；内容同时从 `-4px` 滑到 0。**只有位移和高度，不发光、不投影** —— 这个世界里没有东西浮起来，只有东西从井里升起来。
- **用于:** SVG 源码、思考过程、完整原始响应、本次运行覆盖。
- **折叠标题带读数（`.fold > summary`）:** 「参数单独设置」这个抽屉里的档位**永远有一个值**（默认 `high`），不展开也该知道现在是哪一档，所以标题印成 `参数单独设置 · HIGH`。**这是对「覆盖」二字的将就** —— 抽屉的语义是「空 = 不覆盖」，而强度不是覆盖、是这一次运行的设置；明知名实不符也照做，代价是标题上多五个字符，换来不展开就看得见档位。档位名照原样印大写，不翻译。

### Plate（标本弹窗）
- **为什么是弹窗:** 通道格只够看「这一路有没有出东西」，要判断画本身必须放大。放大不该把机架整页顶掉——**第二读者看的是一张截图**，截图里必须同时有作品和它的来路。弹窗把两者放进同一帧：左边是画，右边是运行数据，背后那层暗下去的机架证明「这是个列表，我只是掀开了其中一格」。
- **结构:** `.sheet-scrim`（`rgba(6,6,6,0.62)`，`pointer-events:none`，`aria-hidden`）+ `.sheet-plate`（铺满视口、`place-items:center`、留出一圈可点的空白）+ `.sheet`（`role="dialog"` `aria-modal="true"`，`width: min(1240px, 100%)`、`height: min(820px, 100%)`）。整块走 `createPortal` 挂到 `body` 上——只有这样才能把背景那棵 `#root` 直接标成 `inert`。
- **落座（全世界第三个编排动作）:** 是「**摆上去**」，不是「飞进来」。`opacity 0→1` + `translateY(10px)→0`，0.24s `cubic-bezier(0.16, 1, 0.3, 1)`；退出 0.18s `cubic-bezier(0.4, 0, 1, 1)`、位移缩到 6px（**退出比进入快**）。遮罩同步 0→1，让房间暗下去。
- **边界:** 1px `--engrave-hi` 外框、直角、`Seated Panel` 影子。**只有位移、不透明度、高度在动** —— 不发光、不缩放、不做 `clip-path`、不糊 `filter`。上一版全屏页的 `clip-path: inset(7% 3%)` + `blur(4px)` 已删除：那是「视图切换」，不是「摆上一块样板」。
- **焦点:** 打开时焦点收进面板的关闭按钮，并把 `#root` 标 `inert`；关闭时先摘 `inert` 再把焦点还给原来那一格。面板内 Tab 循环。**`inert` 挡得住焦点和指针，挡不住滚动** —— 手机上整份文档就是滚动容器（实测 5273px），所以同时锁 `html { overflow: hidden }`，关闭时还原。
- **窄屏 (≤620px):** 头部折行（地址 + 灯 + 动物名一行，关闭按钮另起），`.sheet-head .silk-plain` 隐藏 —— 那段供应商名在同一屏的「运行数据」里已经写着了。不折的话头部 min-content 约 448px，会把面板撑到 434px。
- **`prefers-reduced-motion`:** 抹掉位移，**留住淡入淡出**（0.14s / 0.1s）。弹窗的反馈不是那 10px 的落位，是「房间暗下去、面板亮起来」这个状态变化本身。同一条替代也用在两段式删除的闩扣上：那 2px 的落座抹掉（`.halt-face { transform: none }`），刻字仍然换、凹槽仍然深、刻线仍然亮 —— 扣闩这件事本身照旧看得见，只是不再「走」下去。

### Lamp（指示灯 —— 签名组件）
- **Shape:** 7px 实心圆，是全世界唯一的圆。
- **States:** 熄灭 `#26251f` + `inset 0 0 0 1px #000`；通行 `--ok`；警告 `--warn`；故障 `--fault`；通电 `--lamp` + `0 0 8px` 光晕 + `lamp-strike` 动画。**五个状态每一个都必须有渲染** —— 一个在模型里存在、在样式表里不存在的状态，等于让「一切正常」和「完全没有电」长得一模一样。
- **同色规则:** 同一条事实在**画面、指示灯、铭牌**三处必须同一种颜色。浏览器渲染失败 = 红（画面是红斜纹、灯是红、铭牌是红）；没给 SVG / 截断 / 被中止 / 模型名不符 = 琥珀橙。一格之内不许自相矛盾，红也不许盖过画本身。
- **语义:** 灯只在以下四处出现 —— 通道格左上角、顶栏的 LIVE/IDLE 窗与右侧跟踪读数、档案工位、标本页头部。**没有装饰性的灯。**

## Do's and Don'ts

### Do:
- **Do** 让画面自己说话：`.ch-plate` 背景永远透明，作品自己的底色原样透出来。工具不替模型补台面。
- **Do** 用 `aspect-ratio: 4 / 3` + 固定 19px 的铭牌槽位这两个常数保证整面机架行高一致 —— 相邻两格的作品要能直接比大小。
- **Do** 把一切量化事实写成 Azeret Mono 的 tabular 读数，并且在标本页里右对齐成一列。
- **Do** 用凹槽（`inset` 阴影）和刻线（1px `--engrave`）表达层级。光从上方来，凹进去的上沿背光。
- **Do** 让琥珀只出现在「正在通电 / 已被选中」上，一个屏幕里至多一处成面积。
- **Do** 把丝印压窄（Archivo `wdth 74–82`）来换空间，不要用 letter-spacing 假装窄体。
- **Do** 让空状态占着原来的位置并大声说出来（`.broken` 的斜纹帽 + 橙色「没有 SVG」）—— 空画面是最坏结果，不能是最安静的一格。
- **Do** 每一个 `<details>`、每一颗灯、每一个开关都给全 hover / focus-visible / disabled 状态，并且给浏览器自带的那一层（`::selection`、`caret-color`、滚动条、`:focus-visible`）也上色。

### Don't:
- **Don't** 用圆角。全站只有 `0` 和指示灯那个 `50%`。
- **Don't** 发光：不要彩色光晕、不要 `text-shadow`、不要渐变文字、不要装饰性玻璃或 `backdrop-filter`。
- **Don't** 嵌套卡片。通道格内部、标本页内部都不允许再出现有边框的容器。
- **Don't** 用超过 1px 的彩色 `border-left` / `border-right` 当强调条。
- **Don't** 用硬偏移方块阴影（`box-shadow: 4px 4px 0`）。阴影必须带偏移与柔和模糊，零偏移彩色光晕是装饰。
- **Don't** 把 Azeret Mono 当「技术感」的戏服。它只承载量化事实。
- **Don't** 用 Unicode 字符或 emoji 当图标。图标是自绘的 16×16 SVG，统一 `strokeWidth 1.5`、`strokeLinecap="square"`、`fill="none"`。
- **Don't** 用中性灰做深色面上的次级文字 —— 从暖调前景取色。
- **Don't** 做入场动画。全世界只有三个编排动作：指示灯亮起（`lamp-strike`，0.42s）、抽屉开合（`Fold`，打开 0.26s / 关闭 0.18s）、标本弹窗落座（`Plate`，进入 0.24s / 退出 0.18s）。
- **Don't** 用 hero 大数字、eyebrow / kicker 小标题、或 01/02/03 的段落编号。这台仪器没有标题区，第一屏就是机架本身。
- **Don't** 给某个格子加 `aspect-ratio` 去凑行高 —— 那会压缩画面，而画面是这个工具的主体。
- **Don't** 用一个隐藏的横向滚动条装供应商挡位。要比较的就是「哪一家」，名字必须显示全，折行可以。
