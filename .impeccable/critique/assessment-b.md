# Assessment B — deterministic detector + evidence gathering

**Target:** model-candidate picker in `web\src\components\ControlPanel.tsx` (`.model-pick` / `.mp-grid`, lines 678–763)
plus its styles in `web\src\styles.css` (`.mp-*` at 653–839; `.preset-list` at 1681–1754; pointer override at 2298–2354).
**Reported symptom:** 「右侧模型预选框在添加的模型数量较少时有空白」
**Run date:** 2026-10-08 · project root `E:\学习资料\dsh\鹈鹕测试工具`

> **Headline correction to the brief's premise.** The brief assumed the install sits at the factory 10-item
> candidate list (`shared/types.ts:196`). It does not. The live `config.json` holds **3** presets
> (`gpt-6.1-sol`, `gpt-6-astra`, `deepseek-v4.1-flash`), so **the user's complaint reproduces in their current,
> unmodified state** — it is not a hypothetical. Measured at that state: a **134px** flat slab of `--well`
> inside a 220px well, i.e. **61.5% of the picker is empty**.

---

## 1. CLI findings

**Command (exactly once, from the project root):**

```
& "C:\Users\18170\.dsh\skills\impeccable\scripts\impeccable.cmd" detect --json web\src\components\ControlPanel.tsx
```

| field | value |
|---|---|
| stdout | `[]` |
| exit code | **0** |
| finding count | **0** |
| rule names | **none emitted** |
| file:line locations | **none emitted** |

The detector entrypoint exists and executed normally — it did not crash and was not missing. It simply
reported nothing. A second run at the directory scope `web\src\components` also returned `[]` with exit code 0.

**Verbatim finding text touching `.mp-*` / `.model-pick` / `.preset-list` / the picker markup:**
there is none, because the tool emitted no findings at all. I did not substitute my own lint.

---

## 2. Measured geometry

Two independent sources below: **LIVE** (measured in headless Edge via CDP) and **SOURCE-DERIVED** (arithmetic
from the declarations). They agree exactly, which is the point.

### 2a. LIVE — desktop / fine pointer, viewport 1440×1800, `http://127.0.0.1:5174/`

`#mp-grid` computed: `block-size: 220px` · `height: 220px` · `align-content: start` · `grid-auto-rows: auto`
· `background-color: rgb(16, 16, 16)` · `border-top/bottom: 1px` · `padding: 0px`
`.mp-cell` computed: `padding: 5px 8px` · `line-height: 18px` · `font-size: 12px` · `border: 0px none`

| candidates | `#mp-grid` rect height | `clientHeight` | `scrollHeight` | `.mp-cell` height | last cell `bottom` | grid `bottom` | empty band (raw) | **pure `--well` band** | **`.arm` top** |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 220 | 218 | 218 | 28 | 581.31 | 772.31 | 191 | **190** | 886.81 |
| 2 | 220 | 218 | 218 | 28 | 609.31 | 772.31 | 163 | **162** | 886.81 |
| 3 | 220 | 218 | 218 | 28 | 637.31 | 772.31 | 135 | **134** | 886.81 |
| 7 | 220 | 218 | 218 | 28 | 749.31 | 772.31 | 23 | **22** | 886.81 |
| 10 | 220 | 218 | **280** | 28 | 833.31 | 772.31 | −61 (overflow) | **0** | 886.81 |

- **"pure `--well` band"** = raw band − 1px, because the grid's own `1px` bottom border (`--engrave`) is
  included in the raw figure. The raw number is `grid.bottom − lastCell.bottom`.
- **1 / 2 / 7** were produced by trimming and cloning `.mp-cell` nodes in the live DOM. **3 and 10** are
  *real* app states, reached by PUTting the app's own `/api/config` and reloading.
  Cross-validation: the DOM-simulated 3 and the real 3 both measure `emptyBandPx = 135` — identical.
- The 10-preset state used the **true factory list** from `shared/types.ts:196-207` (`gpt-6.1-sol`, `gpt-6.1`,
  `gpt-5.2-turbo`, `claude-sonnet-4-5-20250929`, `claude-opus-4-1-20250805`,
  `deepseek-v3.2-reasoner-preview`, `gemini-2.5-pro`, `qwen3-max`, `glm-4.6`, `kimi-k2-0905-preview`).
- `.arm` is the 开始生成 button (`ControlPanel.tsx:809`, `className="btn arm xl wide"`).
  **Its top is 886.81 at every list length — it does not move.** The fixed height genuinely holds the button still.
- `hintTop` (`#o-model-hint`) is likewise constant at 784.31.
- `emptyStatePresent: false` at 1, 3 and 10 candidates — `.mp-empty` is not rendered when candidates exist.

### 2b. LIVE — coarse pointer / touch, viewport 390×900 (`--mobile --touch`)

`#mp-grid` computed `block-size: 134px` · `clientHeight: 132` · `.mp-cell` height **44px**

| candidates | `clientHeight` | `scrollHeight` | empty band (raw) | **pure `--well` band** | **`.arm` top** |
|---:|---:|---:|---:|---:|---:|
| 1 | 132 | 132 | 89 | **88** | 875.31 |
| 2 | 132 | 132 | 45 | **44** | 875.31 |
| 3 | 132 | 132 | 1 | **0** | 875.31 |
| 7 | 132 | 308 | −175 (overflow) | 0 | 875.31 |
| 10 | 132 | 440 | −307 (overflow) | 0 | 875.31 |

Note the touch cell is **44px, not 28px** — `min-height: var(--switch-h)` (`styles.css:2318-2320`) overrides the
natural 28px. And at 3 candidates the touch well is **exactly full** (0px band): the override
`calc(var(--switch-h) * 3 + 2px)` = `calc(44px * 3 + 2px)` = 134px is dimensioned to precisely three rows.
So the empty band is a **fine-pointer** phenomenon at the user's 3 presets, and a **coarse-pointer** phenomenon
at 1 and 2 presets (88px / 44px).

### 2c. SOURCE-DERIVED arithmetic (from declarations, not from rendering)

**One row's height** — `.model-pick .mp-cell` (`styles.css:750-766`):

```
padding: 5px 8px;        /* styles.css:755 */
line-height: 18px;       /* styles.css:762 */
border: 0;               /* styles.css:756 */
─────────────────────────────────
5px + 18px + 5px + 0 = 28px per row
```
Confirmed by measurement: `cellH = 28` on every fine-pointer run.

**The well's content box** — `.model-pick .mp-grid` (`styles.css:736-749`):

```
block-size: 220px;                    /* styles.css:744  — a FIXED height */
border: 1px solid var(--engrave);     /* styles.css:747 */
```
plus the global reset `* { box-sizing: border-box; }` (`styles.css:121-123`):

```
clientHeight = 220 − 1 − 1 = 218px
```

**Rows that fit:** `floor(218 / 28) = 7` full rows (7 × 28 = 196px), leaving **22px** spare.
An 8th row would end at 224px > 218px, so the well begins to scroll. Confirmed: at 10 candidates
`scrollHeight = 280 = 10 × 28`, and `clientHeight` stays 218.

**Empty `--well` band = `218 − 28N`** for N ≤ 7:

| N | arithmetic | result | matches live? |
|---:|---|---:|---|
| 1 | 218 − 28 | 190 | ✓ 190 |
| 2 | 218 − 56 | 162 | ✓ 162 |
| 3 | 218 − 84 | **134** | ✓ 134 |
| 7 | 218 − 196 | 22 | ✓ 22 |
| 10 | 218 − 280 | −62 → overflow | ✓ scrollHeight 280 |

**Fraction of the well that is empty** (pure band ÷ 218):

| N | empty | fraction |
|---:|---:|---:|
| 1 | 190px | **87.2%** |
| 2 | 162px | **74.3%** |
| 3 | 134px | **61.5%** ← the user's current state |
| 7 | 22px | 10.1% |

Two in-repo comments independently corroborate this arithmetic:
- `ControlPanel.tsx:615` — 「槽位只有 220px，10 行装不下」 (10 × 28 = 280 > 218) ✓
- `styles.css:741-742` — 「实测过滤到剩一行时按钮会走 190px」 — the measured pure band at 1 candidate is
  **exactly 190px** ✓

### 2d. Does anything fill or decorate the leftover space? **No — nothing does.**

| candidate mechanism | verdict | evidence |
|---|---|---|
| background / pattern | plain `--well` only | `.mp-grid { background: var(--well) }` `styles.css:746`; `--well: #101010` `styles.css:58`; measured computed `rgb(16, 16, 16)` |
| `align-content` | packs rows to the top, does **not** stretch them | `.mp-grid { align-content: start }` `styles.css:739`; computed `"start"` |
| `grid-auto-rows` | not declared | computed `"auto"` |
| row separators | inset shadow, cannot bleed into the band | `.mp-cell + .mp-cell { box-shadow: inset 0 1px 0 var(--engrave) }` `styles.css:770-772` |
| footer / filler element | none exists | no `.mp-grid` child other than `.mp-cell` |
| `min-height` on rows (fine pointer) | not set | the only `min-height` is inside `@media (pointer: coarse)` `styles.css:2318-2320` |
| `::before` / `::after` on the grid | none | all 19 `mp-*` selector matches in `styles.css` inspected; no `.mp-grid` pseudo-element |
| `.mp-empty` | only when zero candidates | `styles.css:818-827` (`position:absolute; inset:0`); rendered only at `ControlPanel.tsx:752-756` under `hits.length === 0`; measured `emptyStatePresent: false` at 1/3/10 |

The CSS is explicit that this is intentional — `styles.css:767-769`:
「行与行之间的 1px 刻缝。用 inset 阴影而不是 gap：gap 要靠容器的 --engrave 底色透出来，
而表格定高之后，最后一行下面那一大片空白也会跟着变成 --engrave。阴影画在格子自己身上，
空出来的地方就还是 --well。」
i.e. the author deliberately kept the leftover a clean `--well` slab rather than letting the separator colour
flood it. **The blank area is a designed-in consequence of the fixed height, not an accident or a missing
decoration.**

### 2e. `max-height` vs fixed — **divergence CONFIRMED**

| side | quote | location |
|---|---|---|
| DESIGN.md prose | 「**样式:** 一张固定在 `max-height: 220px` 的单列凹槽表（`.mp-grid`）…」 | `DESIGN.md:374` |
| DESIGN.md token spec | `model-pick:` … `maxHeight: "220px"` | `DESIGN.md:149-155` |
| CSS (shipped) | `block-size: 220px;` | `web\src\styles.css:744` |
| CSS comment | 「高度是**固定**的，不是「最多 220px」。这张表一变高就会把下面包括「开始生成」在内的所有东西推着走 —— 实测过滤到剩一行时按钮会走 190px，用户的瞄准点就跑了。仪器上的槽位不因为读数变了就换位置。」 | `web\src\styles.css:740-743` |

**Verdict:** the shipped CSS is a **fixed** height; `DESIGN.md` states `max-height` in both its prose and its
own token block. The two are not merely different words — the observable behaviour differs. Under a true
`max-height: 220px` the grid would collapse to 28px at one candidate and `.arm` would jump up ~190px.
Measured `.arm` top is **886.81 at every list length**, so the CSS's fixed behaviour is what actually ships,
and the `DESIGN.md` text (both occurrences) is stale.

**In-repo counterexample — `.preset-list`** (`styles.css:1681-1687`) uses the identical visual vocabulary
(`--well` ground, `1px --engrave` border, inset shadow) but declares **no height at all**; `DESIGN.md:376`
calls it 「**定宽不定高**的，行数随清单走」. It therefore never shows the band — visible in the screenshot,
where 模型候选清单 renders exactly 3 rows + the 添加一行 slot and no blank.

---

## 3. Browser evidence

### 3a. The driver

`tools\edge-cdp.mjs` (380 lines) ships in this repo — documented at `README.md:206-222`, exposed as the npm
script `shot` at `package.json:16`. It is **zero-dependency**: it spawns
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (verified present, Edge **154.0.4258.62**)
with `--headless=new` and a fresh `mkdtempSync` profile per invocation, then speaks CDP over Node's built-in
`WebSocket`. **Nothing was installed and nothing was downloaded.** No Playwright/Puppeteer is present in
`node_modules` (checked).

### 3b. Exact invocations (all from `E:\学习资料\dsh\鹈鹕测试工具`)

```
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/picker-3presets.png      --width=1440 --height=1800 --do=.impeccable/critique/probe_geom.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/_tmp.png                 --width=1440 --height=1800 --do=.impeccable/critique/set10real.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/picker-10presets.png     --width=1440 --height=1800 --do=.impeccable/critique/probe_real.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/_tmp.png                 --width=1440 --height=1800 --do=.impeccable/critique/set1.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/picker-1preset.png       --width=1440 --height=1800 --do=.impeccable/critique/probe_real.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/_tmp.png                 --width=1440 --height=1800 --do=.impeccable/critique/set3restore.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/picker-3presets-real.png --width=1440 --height=1800 --do=.impeccable/critique/probe_real.js
node tools/edge-cdp.mjs shot http://127.0.0.1:5174/ .impeccable/critique/shots/_touch.png               --width=390  --height=900  --mobile --touch --do=.impeccable/critique/probe_geom.js
```

Probe sources written to `.impeccable\critique\`: `probe_real.js` (read-only measurement),
`probe_geom.js` (DOM trim/clone sweep), `set10real.js`, `set1.js`, `set3restore.js`.

### 3c. Servers and data safety

- **No server was started or stopped.** `127.0.0.1:5174` was already listening (PID 36700) before this
  assessment began; it is the user's own dev server and was left running untouched.
- `impeccable live-server` was **not** run.
- To obtain authentic short and long lists I PUT the app's **own** endpoint
  (`app.put('/api/config', …)` at `server\index.ts:58`; `modelPresets` handled at `:79-81` via
  `sanitizePresets`) using `fetch` from the page, then reloaded in a fresh driver invocation.
- **Restoration verified:** `config.json` is **byte-identical** to the pre-run backup after the sequence
  (whitespace-insensitive comparison), and the final probe confirms the app again renders exactly the
  original three names. `config.local.json` (the API-key file) was never written and is identical to its backup.

### 3d. Screenshots (absolute paths)

| path | bytes | state |
|---|---:|---|
| `E:\学习资料\dsh\鹈鹕测试工具\.impeccable\critique\shots\picker-3presets-real.png` | 368737 | **the user's actual current state** (3 presets) |
| `E:\学习资料\dsh\鹈鹕测试工具\.impeccable\critique\shots\picker-1preset.png` | 360857 | 1 preset (worst case) |
| `E:\学习资料\dsh\鹈鹕测试工具\.impeccable\critique\shots\picker-10presets.png` | 394966 | true factory list (`shared/types.ts:196-207`) |
| `E:\学习资料\dsh\鹈鹕测试工具\.impeccable\critique\shots\picker-3presets.png` | 368737 | 3 presets, DOM-sim run |

I opened `picker-3presets-real.png` and inspected it: in the right-hand 要测哪个模型 panel, three rows
(`gpt-6.1-sol`, `gpt-6-astra`, `deepseek-v4.1-flash`) sit at the top of the well and a large flat dark band
runs from beneath the third row down to just above 先选一个模型名，再按「开始生成」. The band is plainly
visible and matches the measured 134px. In the same frame, 模型候选清单 (`.preset-list`) shows exactly
3 rows + 添加一行 with **no** blank — the content-sized counterexample.

### 3e. What was skipped, and why

| mandated step | status | reason |
|---|---|---|
| fresh tab | **done** | each driver invocation spawns a brand-new headless Edge with an empty `mkdtempSync` profile |
| navigation | **done** | `Page.navigate` to `http://127.0.0.1:5174/`, then a 2600ms settle for React + `/api` |
| overlay injection (`live-server` `detect.js`) | **skipped** | it requires standing up a new server, which was explicitly forbidden; the CLI scan alone was accepted |
| console read | **not performed** | `tools\edge-cdp.mjs` enables `Runtime` but exposes no console-message channel: `main()` only reads the `--do` return value and the optional AUDIT expression, and subscribes to no `Runtime.consoleAPICalled` event. Nothing was captured, so nothing is reported. |
| mutation preflight | **not applicable** | the only mutations were DOM node trims inside a throwaway headless page, plus one config round-trip that was verified byte-identical afterwards |

---

## 4. False positives

**None to report.** The detector returned `[]` with exit code 0 at both the file scope
(`web\src\components\ControlPanel.tsx`) and the directory scope (`web\src\components`). With zero findings
there is nothing to adjudicate as a false positive, and I did not substitute my own lint in its place.

---

## 5. Unavailable — stated plainly

Nothing below was measured; none of it is inferred or invented.

- **Accessibility-tree snapshot** — not taken. `tools\edge-cdp.mjs` exposes no Accessibility domain path.
- **Live console output** — not captured (see 3e).
- **Live contrast ratios** — not measured. The driver's default AUDIT expression computes them, but I drove
  custom `--do` probes instead of the AUDIT path, so I have no live contrast numbers for `.mp-cell`,
  `.mp-empty` or `.mp-name`.
- **`prefers-reduced-motion`** — not exercised for the picker (`--reduce` was not used).
- **Other engines** — only Edge 154.0.4258.62 was driven; Firefox and Safari were not tested.
- **Other viewports** — only 1440×1800 (fine pointer) and 390×900 (coarse pointer). The 900px and 620px
  width breakpoints, and the `(max-width: 900px) and (min-width: 560px) and (max-height: 520px)` landscape
  band described at `DESIGN.md:293`, were **not** measured.
- **Focus/keyboard behaviour** — the driver supports `--focus` (it would enable
  `Emulation.setFocusEmulationEnabled` for focusout/blur fidelity), but I did not use it; no keyboard-cursor
  or scroll-into-view behaviour was verified.
- **`.mp-grid` scroll state at 8–9 candidates** — 7 and 10 were measured; 8 and 9 were not.
