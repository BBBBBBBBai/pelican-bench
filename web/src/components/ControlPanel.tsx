import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { AppConfig, EffortLevel, GenParams, Protocol, RunOverrides, RunRequest } from '@shared/types';
import { DEFAULT_MODEL_PRESETS, EFFORT_LEVELS } from '@shared/types';
import { api, type PublicConfig, type PublicProvider } from '../api';
import type { T } from '../i18n';
import { Icon } from './Icon';
import { paramsLine, Switch } from './bits';

/** 外来字符串的长度上限，与 server/index.ts 的 MAX_PROFILE_NAME / MAX_BASE_URL /
 *  MAX_PRESET_LEN 三处一一对齐。
 *  客户端这一道是「打字的时候就打不进去」，服务端那一道是「绕过界面直接调接口也过不去」。
 *  两边都要有：输入框上的 maxLength 只是方便，不是防线。 */
const MAX_PROFILE_NAME = 80;
const MAX_BASE_URL = 500;
const MAX_PRESET_LEN = 120;

// 供应商表单里「温度 / 最大输出」默认是**空**的：空 = 跟随全局默认。
// 以前这里预填 DEFAULT_PARAMS 的具体数字，于是每建一家站就多一层压着全局的覆盖，
// 改全局默认等于没改 —— 界面上一句话都不会说。
const EMPTY_FORM = {
  name: '',
  protocol: 'openai' as Protocol,
  baseUrl: '',
  apiKey: '',
  temperature: '',
  maxTokens: '',
};

type FormState = typeof EMPTY_FORM;

/** 档案里没写的字段要留成空串，不能补成数字 —— 补了就把「跟随全局」写死成了具体值。 */
function paramField(v: number | undefined): string {
  return typeof v === 'number' ? String(v) : '';
}

function toForm(p: PublicProvider): FormState {
  return {
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKey: '',
    temperature: paramField(p.params.temperature),
    maxTokens: paramField(p.params.maxTokens),
  };
}

/** 名字留空时用接口地址的主机名兜底 —— 以前这里退到模型名，模型名已经不在档案里了。 */
function nameFromBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

/**
 * 名册副行原来印的是模型名。模型名搬走之后，这家站「到底是谁」就只剩地址了 ——
 * 而供应商名是你自己随手起的，可能叫「备用 2」，不构成身份。所以副行改印主机名。
 */
function hostOf(baseUrl: string): string {
  return nameFromBaseUrl(baseUrl) || baseUrl;
}

/** 与 server/index.ts 的 sanitizePresets 同一套规矩：去首尾空白、丢掉空行、保序去重。
 *  两边必须一致 —— 否则本地看着干净，存回去又原样回来。 */
function cleanPresets(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const name = item.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

function Head({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="bay-head">
      <span className="silk silk-hi">{label}</span>
      <span className="rule" />
      {right}
    </div>
  );
}

/**
 * 模型候选清单里的一格。输入框自己拿一份草稿，只在失焦时提交：
 *   ① 提交要写 config.json 并整份重取，边打边存等于边打边被服务端回写盖掉；
 *   ② 回车就是失焦，「打完一条接着打下一条」才顺手（与超时/重试那两个字段同一套写法）。
 * 草稿跟着 value 走 —— 服务端会去首尾空白、丢空行、去重，所以提交之后回来的那份
 * 可能和手里打的字不一样，那时候以服务端那份为准。
 * 「删掉这一行」那颗叉是画出来的（Icon），这个世界里没有 Unicode 图标。
 */
function PresetRow({
  value,
  label,
  dropLabel,
  placeholder,
  autoFocus,
  onCommit,
  onDrop,
}: {
  value: string;
  label: string;
  dropLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCommit: (name: string, viaEnter: boolean) => void;
  onDrop?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  // 回车触发的失焦与鼠标点走触发的失焦是两回事：前者要接着打下一格，
  // 后者是「我去别的地方了」。这个标记只活到那一次提交为止。
  const viaEnter = useRef(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return (
    <div className="preset-row">
      <input
        className="preset-name"
        type="text"
        value={draft}
        aria-label={label}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={MAX_PRESET_LEN}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          const wasEnter = viaEnter.current;
          viaEnter.current = false;
          // 读的是**这个框里现在的字**，不是手里那份 draft：两者在真实打字时一样，
          // 但 draft 要等 React 把每一下按键都过完才追上。超时/重试那两个字段
          // 也是读 e.target.value（ControlPanel.tsx:831），这里是同一句话。
          onCommit(e.target.value, wasEnter);
        }}
        onKeyDown={(e) => {
          // 输入法合成中的那一下回车是在「选字」，不是「提交这一格」。
          // 少了这一句，打「鹈鹕」时按回车确认候选，就会立刻失焦提交，
          // 交上去的是半截拼音 —— 中文被吃掉，而且看起来像自己打错了。
          if (e.nativeEvent.isComposing) return;
          if (e.key !== 'Enter') return;
          viaEnter.current = true;
          e.currentTarget.blur();
        }}
      />
      {onDrop ? (
        <button type="button" className="preset-drop" aria-label={dropLabel} onClick={onDrop}>
          <Icon name="x" size={12} />
        </button>
      ) : (
        // 还没写的那一格（表尾那个空槽）没有叉：它的空位留着，是让整张表的
        // 竖缝对齐，不是给一个「删掉一行」的假按钮。
        <span className="preset-drop" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * 右侧控制面板。它是机台的操作面：上面是档案名册，中间是这一次运行的开关，
 * 下面是搬到台面下的全局设置。
 */
export function ControlPanel({
  config,
  t,
  running,
  selectedId,
  onSelect,
  onConfigChanged,
  onRun,
  onStop,
  onToast,
}: {
  config: PublicConfig;
  t: T;
  running: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onConfigChanged: () => void | Promise<void>;
  onRun: (req: RunRequest) => void;
  onStop: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}) {
  const providers = config.providers;
  const selected = useMemo(() => providers.find((p) => p.id === selectedId) ?? null, [providers, selectedId]);

  const [editing, setEditing] = useState<string | null>(null); // providerId | 'new'
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  // 「删除」是两段式的：第一次按只是把按钮扣下去（文字变「确认删除」），
  // 第二次按才真的删。删除掉一个供应商是不可逆的（它的密钥、地址、模型名一起没），
  // 而这个按钮和「编辑供应商」并排、间距 9px —— 值得多要一次确认。
  const [armed, setArmed] = useState(false);

  // 保存 / 删除之后的回执。它跟「本次运行」那条 `.mp-status` 是同一个套路：
  // 标题行本来就存在，回执常驻在树里（没话可说的时候是一段空白），
  // 于是刻线长度恒定 —— 出现和消失都不会让这一行抽动一下。
  // 不走 App 的 onToast：那个渲染在根节点（App.tsx:215），够不着这一行。
  const [receipt, setReceipt] = useState<{ msg: string; ok: boolean } | null>(null);
  const receiptTimer = useRef<number | null>(null);

  // 要测的模型名。它不属于任何一家供应商 —— 是这一次运行的输入。
  // 换供应商时**故意不清空**：这个工具问的正是「同一个模型名在不同站上表现如何」，
  // 每换一家就得重选一次模型名，等于把唯一要控制住的变量变成了手抖。
  const [model, setModel] = useState('');
  // 输入框里的字和「已经定下来的模型名」本来是同一个 state，于是：
  //   ① 用来筛的那半截词（`dsr`）同时就是要发出去的模型名；
  //   ② 点中一行之后，候选表会因为「值 = 过滤词」当场塌成一行 —— 便签被自己撕掉了，
  //      而换模型名正是这个工具唯一要控制住的那件事。
  // 现在 model 只在「提交」时改（点一行、回车、失焦、清除），modelQuery 只在打字时存在，
  // null 表示「没在筛」—— 此时整张便签都摆着，已提交的那一行亮着。
  const [modelQuery, setModelQuery] = useState<string | null>(null);
  // 键盘游标停在候选表的第几行（-1 = 没有游标）。它只被 aria-activedescendant 指认，
  // 不动 DOM 焦点 —— 焦点留在输入框里，读屏才听得到「正在输入什么」。
  const [modelActive, setModelActive] = useState(-1);
  // 屏幕上那个字，就是发出去的那个字（trim 只在提交时做，见 buildRequest 与 onBlur）。
  const modelShown = modelQuery ?? model;
  const modelValue = modelShown.trim();
  // 门禁挡的其实是两件事，得分开说：没有工位、和没有模型名，要做的动作不一样。
  // 原来两件事共用一句「先选定模型名才能开始生成」—— 一个供应商都没建的时候，
  // 它会让人去填一个可能已经填好的模型名，而真正缺的那一步一个字都没提。
  const gateReason: 'profile' | 'model' | null = !selectedId
    ? 'profile'
    : modelValue === ''
      ? 'model'
      : null;
  const gateBlocked = gateReason !== null;
  const gateText =
    gateReason === null ? '' : gateReason === 'profile' ? t('run.needProfile') : t('run.needModel');
  // 参数覆盖是另一回事：它贴着具体一家供应商的默认值，换工位就该弹回来。
  const [ovTemp, setOvTemp] = useState('');
  const [ovMax, setOvMax] = useState('');
  // 思考强度**不是**覆盖，是这一趟的设置 —— 它永远有一个值（默认取全局默认，出厂 high），
  // 所以它不走「留空 = 不覆盖」那套。按用户的选择，它住在「参数单独设置」那个折叠里，
  // 代价是折叠的名字跟它名实不符；换来的是不展开也知道当前档位（标题上就印着）。
  const [effort, setEffort] = useState<EffortLevel>(config.defaultParams.effort);
  // 这一层本来会给的档位：供应商写了就用供应商的，没写就落到全局默认。
  // 选择器跟着它走 —— 不跟的话，改完全局默认这里还印着旧档位，成了一句会过期的话。
  const inheritedEffort = selected?.params.effort ?? config.defaultParams.effort;
  useEffect(() => {
    setEffort(inheritedEffort);
  }, [inheritedEffort]);

  // 模型候选清单表尾那一格是「加一行」的落点。回车提交之后要把光标送回这一格，
  // 但 autoFocus 只在挂载那一下算数 —— 换一次 key 让它重挂。
  // addFocus 一开始是 false：首屏不该有任何东西抢走焦点、把面板滚下去；
  // 只有真的用回车加过一条之后，才轮到光标自己走过去。
  const [addKey, setAddKey] = useState(0);
  const [addFocus, setAddFocus] = useState(false);

  // 换一个档案就清掉参数覆盖，免得上一家的值串到这一家。
  // 顺手把删除闩也弹回来：换工位是「我改主意了」最明确的信号，
  // 不许上一个人的确认状态跟到下一个人身上。
  useEffect(() => {
    setOvTemp('');
    setOvMax('');
    setArmed(false);
  }, [selectedId]);

  // 回执 5s 后自己走（原来那条 toast 是 2.6s）。它现在不在视野正中央，
  // 而在你刚按过的那个键旁边 —— 多留一会儿，够你把眼睛从「保存」挪过去。
  function showReceipt(msg: string, ok = true) {
    setReceipt({ msg, ok });
    if (receiptTimer.current !== null) window.clearTimeout(receiptTimer.current);
    receiptTimer.current = window.setTimeout(() => setReceipt(null), 5000);
  }

  // 上一个动作的话不许跟到下一个动作上：挂着一句属于别家供应商的「已保存」是误导。
  function clearReceipt() {
    if (receiptTimer.current !== null) window.clearTimeout(receiptTimer.current);
    receiptTimer.current = null;
    setReceipt(null);
  }

  // 卸载时把表收掉：一个 5s 的定时器不该活得比它的组件久。
  useEffect(
    () => () => {
      if (receiptTimer.current !== null) window.clearTimeout(receiptTimer.current);
    },
    [],
  );

  function startNew() {
    clearReceipt();
    setArmed(false);
    setEditing('new');
    setForm(EMPTY_FORM);
  }

  function startEdit() {
    if (!selected) return;
    clearReceipt();
    setArmed(false);
    setEditing(selected.id);
    setForm(toForm(selected));
  }

  async function submit() {
    if (!form.baseUrl.trim()) {
      showReceipt(t('ctrl.needFields'), false);
      return;
    }
    // 只把**真填了**的字段发上去。留空的那一项不写进档案，运行时它会落到
    // 全局默认那一层（server/runner.ts 的 mergeParams 逐字段往下掉）。
    // 以前这里用 `|| DEFAULT_PARAMS.maxTokens` 兜底，把「留空」偷偷变成了「8192」——
    // 于是全局默认永远被每一家压着。
    const params: Partial<GenParams> = {};
    const temp = Number(form.temperature);
    if (form.temperature.trim() !== '' && Number.isFinite(temp)) params.temperature = temp;
    const max = Number(form.maxTokens);
    if (form.maxTokens.trim() !== '' && Number.isFinite(max)) params.maxTokens = Math.max(1, Math.floor(max));
    const payload = {
      name: form.name.trim() || nameFromBaseUrl(form.baseUrl.trim()),
      protocol: form.protocol,
      baseUrl: form.baseUrl.trim(),
      params,
      ...(form.apiKey ? { apiKey: form.apiKey } : {}),
    };
    setBusy(true);
    try {
      if (editing === 'new') {
        const created = await api.addProvider(payload);
        onSelect(created.id);
      } else if (editing) {
        await api.updateProvider(editing, payload);
      }
      setEditing(null);
      await onConfigChanged();
      showReceipt(t('run.saved'));
    } catch (err) {
      showReceipt(err instanceof Error ? err.message : String(err), false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    // 第一段：只把按钮扣下去，不动数据。这一下不该有任何副作用，
    // 所以它连 busy 都不进 —— 一个纯状态的切换。
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setBusy(true);
    try {
      await api.deleteProvider(selected.id);
      onSelect(null);
      await onConfigChanged();
      showReceipt(t('run.deleted'));
    } catch (err) {
      showReceipt(err instanceof Error ? err.message : String(err), false);
    } finally {
      setBusy(false);
    }
  }

  function buildRequest(): RunRequest {
    const req: RunRequest = { model: modelValue };
    if (selectedId) req.providerId = selectedId;
    const overrides: RunOverrides = {};
    const params: Partial<GenParams> = {};
    if (ovTemp.trim() !== '') params.temperature = Number(ovTemp);
    if (ovMax.trim() !== '') params.maxTokens = Math.max(1, Number(ovMax));
    // 强度只在**真的改了**的时候才算一次覆盖。
    // 它永远有个值，若一律塞进 overrides，那么 `usedOverrides` 会变成恒真 ——
    // 那个标记本来是用来区分「档案原样跑」和「改了参数跑」的，恒真就等于废掉它。
    if (effort !== inheritedEffort) params.effort = effort;
    if (Object.keys(params).length > 0) overrides.params = params;
    if (overrides.params) req.overrides = overrides;
    return req;
  }

  function saveGlobal(patch: Partial<AppConfig>) {
    void api
      .saveConfig(patch)
      .then(() => onConfigChanged())
      .catch((err: unknown) => onToast(err instanceof Error ? err.message : String(err), true));
  }
  /* 名册下面这一条槽。平时露的是「编辑 / 删除」两颗按钮；按下「新建」
     或「编辑供应商」之后，按钮沉进槽底、表单从同一条槽的上沿压下来。
     两块同格同位，按钮先让位、纸随即落下，所以下面的「本次运行」
     不会被先顶上去一截再推下来。
     两块都得常驻在树里 —— 只有常驻才谈得上「关」：条件卸载只演得了
     「开」，演不了高度收回去那一程。
     `uid` 只是给表单控件的 id 加一个前缀：live 变体模式下这一段会被渲染四份
     （原始 + 三个变体），没有前缀就会出现四个同 id 的输入框，label 的 htmlFor
     会指到第一份 —— 也就是被 display:none 的那一份上，点了没反应。
     正式路径只渲染一份，前缀就是空串，id 与原来逐字相同。 */
  const renderProvSlot = (uid: string) => (
    <div className={`prov-slot${editing ? ' open' : ''}`}>
      <div className="prov-slot-out">
        {selected && (
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn quiet" onClick={startEdit} disabled={busy}>
              {t('ctrl.editProfile')}
            </button>
            {/* 两段式。第一段不删任何东西，只是把键扣下去：文字变
                「确认删除」、键座凹进去、刻线提亮。第二段才真的删。
                用 aria-pressed 而不是 aria-label —— 文字已经换过了，
                屏幕阅读器读到的是「确认删除，已按下」，正好是这件事。 */}
            <button
              type="button"
              className={`btn quiet halt${armed ? ' armed' : ''}`}
              aria-pressed={armed}
              onClick={() => void remove()}
              disabled={busy}
            >
              <span className="halt-face">
                <Icon name="trash" />
                {armed ? t('ctrl.deleteConfirm') : t('ctrl.delete')}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="prov-slot-in">
        <form
          className="prov-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="field">
            <label htmlFor={`${uid}f-name`}>{t('ctrl.name')}</label>
            <input
              id={`${uid}f-name`}
              type="text"
              value={form.name}
              maxLength={MAX_PROFILE_NAME}
              placeholder={hostOf(form.baseUrl)}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor={`${uid}f-proto`}>{t('ctrl.protocol')}</label>
            <select
              id={`${uid}f-proto`}
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value as Protocol })}
            >
              <option value="openai">[OI] /v1/chat/completions</option>
              <option value="anthropic">Anthropic /v1/messages</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor={`${uid}f-url`}>{t('ctrl.baseUrl')}</label>
            <input
              id={`${uid}f-url`}
              type="text"
              value={form.baseUrl}
              maxLength={MAX_BASE_URL}
              placeholder="https://api.example.com"
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>

          {/* 「留空则继续用已保存的密钥」只对编辑现有供应商成立：新建时还没有
              任何已保存的密钥，这句话在这时候是假的，会让人以为可以不填。 */}
          <div className="field">
            <label htmlFor={`${uid}f-key`}>{t('ctrl.apiKey')}</label>
            <input
              id={`${uid}f-key`}
              type="password"
              value={form.apiKey}
              placeholder={editing === 'new' ? '' : t('ctrl.apiKeyKeep')}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor={`${uid}f-temp`}>{t('ctrl.temperature')}</label>
              <input
                id={`${uid}f-temp`}
                type="text"
                inputMode="decimal"
                value={form.temperature}
                placeholder={String(config.defaultParams.temperature)}
                title={t('ctrl.followGlobal', { value: String(config.defaultParams.temperature) })}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`${uid}f-max`}>{t('ctrl.maxTokens')}</label>
              <input
                id={`${uid}f-max`}
                type="text"
                inputMode="numeric"
                value={form.maxTokens}
                placeholder={String(config.defaultParams.maxTokens)}
                title={t('ctrl.followGlobal', { value: String(config.defaultParams.maxTokens) })}
                onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
              />
            </div>
          </div>

          {/* 这里原来有一个「启用思考模式」勾选框，只在 Anthropic 下渲染。
              它已经拆掉了：它对 [OI] 兼容协议从来没生效过（那个协议根本没有
              这个字段），而 Anthropic 那边现在由「思考强度」统一管 ——
              留着它就会出现两套互相矛盾的思考开关。 */}

          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn" disabled={busy}>
              {t('ctrl.save')}
            </button>
            <button
              type="button"
              className="btn quiet"
              onClick={() => {
                clearReceipt();
                setEditing(null);
              }}
              disabled={busy}
            >
              {t('ctrl.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const provHeadNode = (
    <div className="prov-head">
      <Head
        label={t('ctrl.profiles')}
        right={
          <>
            {/* 回执槽位。常驻在树里、宽度留死，所以刻线长度不随它变 ——
                空的时候它只是这段空白，而桌面端这份空白是刻意的。
                role=status 让它出现时被朗读（跟 `.mp-status` 同一个理由）。 */}
            <span className="prov-receipt" role="status">
              {receipt?.ok ? receipt.msg : ''}
            </span>
            <button type="button" className="btn quiet" onClick={startNew} disabled={editing === 'new'}>
              {t('ctrl.add')}
            </button>
          </>
        }
      />

      {/* 长句子另起一行，理由写在 styles.css 的 .note.prov-receipt-note 上。 */}
      <p className="note prov-receipt-note" role="status">
        {receipt && !receipt.ok ? receipt.msg : ''}
      </p>
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-scroll">
        {/* ── 档案名册 ─────────────────────────────────────────────── */}
        <section className="bay-section">
          {provHeadNode}

          {providers.length === 0 ? (
            <div className="note" style={{ marginTop: 0 }}>
              {t('ctrl.none')}
            </div>
          ) : (
            <div className="roster">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="slot"
                  aria-pressed={p.id === selectedId}
                  onClick={() => {
                    clearReceipt();
                    onSelect(p.id);
                  }}
                >
                  <span className={`lamp ${p.hasKey ? 'ok' : 'fault'}`} aria-hidden="true" />
                  <span className="slot-body">
                    <span className="slot-host">{hostOf(p.baseUrl)}</span>
                    <span className="slot-name">
                      {p.name} · {p.protocol === 'openai' ? 'OI' : 'ANTH'}
                    </span>
                    <span className="slot-sub">
                      {paramsLine({ ...config.defaultParams, ...p.params })}
                    </span>
                  </span>
                  {!p.hasKey && (
                    <span className="silk" style={{ color: 'var(--fault)' }}>
                      {t('ctrl.noKey')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {renderProvSlot('')}
        </section>

        {/* ── 本次运行 ─────────────────────────────────────────────── */}
        <section className="bay-section">
          <Head label={t('ctrl.runTitle')} />

          {selected ? (
            <dl className="facts run-facts">
              <dt>{t('meta.provider')}</dt>
              <dd>{selected.name}</dd>
              {/* 名册里印主机名（短、能扫）；这里印完整地址 —— 它才是真发出去的那个东西。 */}
              <dt>{t('meta.baseUrl')}</dt>
              <dd>{selected.baseUrl}</dd>
              <dt>{t('meta.params')}</dt>
              <dd>{paramsLine(selected.params)}</dd>
            </dl>
          ) : (
            <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
              {t('live.noProfile')}
            </div>
          )}

          {/* 模型名从「档案的属性」搬到了这里 —— 它现在是这一次运行的输入，
              和供应商并列，而不是藏在折叠块里的一个可选覆盖。
              它**不在**下面那个 fold 里：fold 装的是「这一家默认值之外我临时改了什么」，
              而模型名没有默认值可言 —— 每一次都必须现选，所以它没有资格被折起来。 */}
          <div className="field" style={{ marginTop: 4 }}>
            <div className="field-head">
              <label htmlFor="o-model">{t('ctrl.modelPick')}</label>
              {/* 门禁的原因挂在这里，不再只挂在按钮的 title 上。
                  title 要鼠标悬停才出来，而禁用按钮连焦点都进不去 ——
                  「为什么不能开始」这句话，纯键盘用户原来永远拿不到。
                  放在字段名这一行是刻意的：这一行本来就存在，所以它常驻也不改变高度，
                  不会变成另一个「按钮被推着走」的来源。role=status 让它出现时被朗读。 */}
              <span className="mp-status" role="status">
                {gateText}
              </span>
            </div>
            {(() => {
              // 候选表来自 config.json（全局设置里可改）。它仍然是给手用的快捷键，
              // 不是测量结果 —— 改它不动任何一条记录，清空它也不挡任何一次运行。
              const MODELS = config.modelPresets;
              const hit = (s: string, q: string) => {
                if (!q) return true;
                let i = 0;
                for (const ch of s.toLowerCase()) {
                  if (ch === q[i]) i += 1;
                  if (i === q.length) return true;
                }
                return false;
              };
              // 只有「正在打字」才筛。没在打字时候选表是完整的 ——
              // 选中一个模型不等于把便签撕掉。
              const q = modelQuery === null ? '' : modelQuery.trim().toLowerCase().replace(/\s+/g, '');
              const hits = MODELS.filter((m) => hit(m, q));
              const activeIdx = modelActive >= 0 && modelActive < hits.length ? modelActive : -1;
              const activeName = activeIdx >= 0 ? hits[activeIdx] : null;

              const commit = (name: string) => {
                setModel(name);
                setModelQuery(null);
                setModelActive(-1);
              };
              const release = () => {
                setModelQuery(null);
                setModelActive(-1);
              };
              // 槽位只有 220px，10 行装不下 —— 游标必须把停住的那一行带进视野，
              // 否则按到第 8 行以后，屏幕上看不出游标在哪儿。
              const moveActive = (i: number) => {
                setModelActive(i);
                requestAnimationFrame(() => {
                  const grid = document.getElementById('mp-grid');
                  const el = document.getElementById(`mp-opt-${i}`);
                  if (!grid || !el) return;
                  const rel = el.offsetTop - grid.offsetTop - grid.clientTop;
                  if (rel < grid.scrollTop) grid.scrollTop = rel;
                  else if (rel + el.offsetHeight > grid.scrollTop + grid.clientHeight) {
                    grid.scrollTop = rel + el.offsetHeight - grid.clientHeight;
                  }
                });
              };

              const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
                // 合成中的按键（回车选字、上下键在候选字之间翻页）不是对这张表的操作。
                // 少了这一句，拼音和日文输入法里每一次选字都会被当成一次方向键或一次提交。
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (hits.length === 0) return;
                  const step = e.key === 'ArrowDown' ? 1 : -1;
                  moveActive(
                    activeIdx < 0
                      ? step === 1
                        ? 0
                        : hits.length - 1
                      : (activeIdx + step + hits.length) % hits.length,
                  );
                  return;
                }
                if (e.key === 'Home' || e.key === 'End') {
                  // 游标在表里时，Home/End 归首行/末行；没有候选就不拦，让光标照常走。
                  if (hits.length === 0) return;
                  e.preventDefault();
                  moveActive(e.key === 'Home' ? 0 : hits.length - 1);
                  return;
                }
                if (e.key === 'Enter') {
                  // 回车提交游标停着的那一行；没有游标就不拦（让表单/默认行为照常）。
                  if (activeName !== null) {
                    e.preventDefault();
                    commit(activeName);
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  // 还原成已提交的那个名字，并退出筛选。
                  if (modelQuery !== null || activeIdx >= 0) {
                    e.preventDefault();
                    release();
                  }
                  return;
                }
                // 空输入框上按退格 = 取消选择，这是「清除」控件的键盘等价物。
                if (e.key === 'Backspace' && modelShown === '') {
                  release();
                  if (model !== '') {
                    e.preventDefault();
                    setModel('');
                  }
                }
              };

              return (
                <div className="model-pick">
                  <div className="mp-row">
                    <input
                      id="o-model"
                      type="text"
                      className="mp-input"
                      maxLength={MAX_PRESET_LEN}
                      placeholder={t('ctrl.model')}
                      value={modelShown}
                      role="combobox"
                      aria-expanded="true"
                      aria-controls="mp-grid"
                      aria-autocomplete="list"
                      aria-activedescendant={activeIdx >= 0 ? `mp-opt-${activeIdx}` : undefined}
                      aria-describedby="o-model-hint"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => {
                        setModelQuery(e.target.value);
                        setModelActive(-1);
                      }}
                      onKeyDown={onKeyDown}
                      // 失焦 = 把手上这段字定下来。顺手去掉首尾空格：
                      // 原来 `gpt-6.1 ` 和 `gpt-6.1` 发出去的是同一个名字，
                      // 但只有后者会被认成「已选中」—— 所见与所发不一致。
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== model) setModel(v);
                        release();
                      }}
                    />
                    <button
                      type="button"
                      className="mp-clear"
                      aria-label={t('ctrl.modelClear')}
                      disabled={modelValue === ''}
                      onClick={() => {
                        setModel('');
                        release();
                      }}
                    >
                      <span className="mp-x" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mp-well">
                    {/* listbox 里只有 option。空态原来是一颗没有 role 的裸 div 直接塞在
                        listbox 里（AX 树上是 generic），现在它挪到 listbox 外面，
                        并且自己是 role=status —— 出现时会被朗读。 */}
                    {/* 这张表按内容收：候选少的时候槽位就矮，不再在下面留一片无字的
                        --well。上限是常数（五行 / 162px），再多也只是表内滚动。
                        代价是「开始生成」跟着表高走 —— 实测 1 行 → 5 行之间走
                        112px。这是拿瞄准点换空带：空带常驻，位移只在改清单和
                        打字的那一下。空出来的地方由底部那条 20px 回执条封住 ——
                        「2 个候选」比一片空白说明得多。 */}
                    <div className="mp-slot">
                      <div
                        id="mp-grid"
                        className="mp-grid"
                        data-empty={hits.length === 0 ? 'true' : undefined}
                        role="listbox"
                        aria-label={t('ctrl.modelPick')}
                        tabIndex={-1}
                      >
                        {hits.map((m, i) => (
                          <button
                            key={m}
                            id={`mp-opt-${i}`}
                            type="button"
                            role="option"
                            // 十个候选不再是十个 tab stop：Tab 一次就该离开这张表。
                            // 游标由输入框的 aria-activedescendant 指认，焦点始终留在输入框。
                            tabIndex={-1}
                            aria-selected={m === modelValue}
                            data-active={i === activeIdx ? 'true' : undefined}
                            className="mp-cell"
                            onClick={() => commit(m)}
                          >
                            <span className="mp-dot" />
                            <span className="mp-name">{m}</span>
                          </button>
                        ))}
                      </div>
                      {/* 回执条：印出筛出来的条数。没有这个数，剩下的一片 --well
                          只能读成「没存上」。
                          它是这一格里**唯一**的 live region —— 条数是打字时唯一会变的
                          反馈，而活区必须是眼睛正在看的那个东西，不能躲在屏外
                          （原来那个 `.mp-count` 就是 left:-10000px）。 */}
                      <div className="mp-foot">
                        <span role="status">{t('ctrl.modelCandidates', { n: hits.length })}</span>
                      </div>
                    </div>
                    {hits.length === 0 && (
                      <div className="mp-empty">{t('ctrl.modelEmpty')}</div>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="note" id="o-model-hint" style={{ marginTop: 8 }}>
              {t('ctrl.modelHint')}
            </div>
          </div>

          <details className="fold">
            {/* 标题上印当前档位：这个折叠是关着的绝大多数时候，而强度是这一趟
                真正决定「模型想多久」的那一项。不印的话，想知道自己会发出什么档位
                就得每次展开一次 —— 而它是默认值，不是每次都会去动的。 */}
            <summary>
              {t('ctrl.override')} · {effort.toUpperCase()}
            </summary>
            <div className="fold-body">
              <div className="note" style={{ marginTop: 0, marginBottom: 10 }}>
                {t('ctrl.overrideHint')}
              </div>
              <div className="field">
                {/* 拨档开关不是 <input>，没有可被 htmlFor 指到的 id —— 所以这里照
                    题目语言那一处写成裸 label，名字由 Switch 自己的 aria-label 承担。 */}
                <label>{t('ctrl.effort')}</label>
                <div className="effort-row">
                  <Switch<EffortLevel>
                    value={effort}
                    label={t('ctrl.effort')}
                    options={EFFORT_LEVELS.map((lv) => ({ value: lv, label: lv }))}
                    onChange={setEffort}
                  />
                </div>
              </div>
              <div className="note" style={{ marginTop: 8 }}>
                {t('ctrl.effortHint')}
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="o-temp">{t('ctrl.tempOverride')}</label>
                  <input
                    id="o-temp"
                    type="text"
                    inputMode="decimal"
                    value={ovTemp}
                    onChange={(e) => setOvTemp(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="o-max">{t('ctrl.maxOverride')}</label>
                  <input
                    id="o-max"
                    type="text"
                    inputMode="numeric"
                    value={ovMax}
                    onChange={(e) => setOvMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          {running ? (
            <button type="button" className="btn halt xl wide" style={{ marginTop: 12 }} onClick={onStop}>
              <Icon name="stop" />
              {t('run.stop')}
            </button>
          ) : (
            <button
              type="button"
              className="btn arm xl wide"
              style={{ marginTop: 12 }}
              disabled={gateBlocked}
              title={gateBlocked ? gateText : undefined}
              onClick={() => onRun(buildRequest())}
            >
              {t('run.start')}
            </button>
          )}
        </section>

        {/* ── 全局设置 ─────────────────────────────────────────────── */}
        <section className="bay-section" style={{ borderBottom: 0 }}>
          <Head label={t('ctrl.settings')} />

          <div className="field">
            <label>{t('ctrl.promptLang')}</label>
            <Switch<'zh' | 'en'>
              value={config.promptLang}
              onChange={(v) => saveGlobal({ promptLang: v })}
              options={[
                { value: 'zh', label: t('ctrl.langZh') },
                { value: 'en', label: t('ctrl.langEn') },
              ]}
            />
          </div>

          <div className="row" style={{ marginTop: 4 }}>
            <div className="field">
              <label htmlFor="s-timeout">{t('ctrl.timeout')}</label>
              <input
                id="s-timeout"
                type="text"
                inputMode="numeric"
                defaultValue={String(config.timeoutSec)}
                onBlur={(e) => {
                  const n = Math.max(1, Number(e.target.value) || config.timeoutSec);
                  e.target.value = String(n);
                  if (n !== config.timeoutSec) saveGlobal({ timeoutSec: n });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="s-retries">{t('ctrl.retries')}</label>
              <input
                id="s-retries"
                type="text"
                inputMode="numeric"
                defaultValue={String(config.retries)}
                onBlur={(e) => {
                  const n = Math.max(0, Number(e.target.value) || 0);
                  e.target.value = String(n);
                  if (n !== config.retries) saveGlobal({ retries: n });
                }}
              />
            </div>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={config.saveReasoning}
              onChange={(e) => saveGlobal({ saveReasoning: e.target.checked })}
            />
            {t('ctrl.saveReasoning')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={config.saveRawResponse}
              onChange={(e) => saveGlobal({ saveRawResponse: e.target.checked })}
            />
            {t('ctrl.saveRaw')}
          </label>

          {/* ── 模型候选清单 ────────────────────────────────────────────
              这是「要测哪个模型」那张表的内容。它按存在 config.json 里的位置
              归到全局设置，理由也说得通：它跨供应商、跨记录，不是某一次运行的参数。
              逐行提交而不是攒着一起存 —— 数组进 PUT /api/config 是**整体替换**，
              而服务端那份清洗（去首尾空白、丢空行、保序去重）只有当场回读才看得见；
              本地先攒一份干净的直接存回去，看着一致，其实两边各有一套规矩。 */}
          <div className="preset-head">
            <span className="silk">{t('ctrl.modelPresets')}</span>
            <button
              type="button"
              className="btn quiet dense"
              disabled={JSON.stringify(config.modelPresets) === JSON.stringify(DEFAULT_MODEL_PRESETS)}
              onClick={() => saveGlobal({ modelPresets: [...DEFAULT_MODEL_PRESETS] })}
            >
              {t('ctrl.presetRestore')}
            </button>
          </div>
          {config.modelPresets.length === 0 && (
            <div className="note" style={{ marginTop: 6, marginBottom: 0 }}>
              {t('ctrl.presetEmpty')}
            </div>
          )}
          <div className="preset-list">
            {config.modelPresets.map((m, i) => (
              <PresetRow
                key={i}
                value={m}
                label={t('ctrl.presetName', { n: i + 1 })}
                dropLabel={t('ctrl.presetRemove')}
                onCommit={(name) => {
                  const next = [...config.modelPresets];
                  next[i] = name;
                  const cleaned = cleanPresets(next);
                  // 打完没变（原样、只多了空格、或者打成了别处已有的重名）就什么都别写：
                  // 一次 PUT 换一份一模一样的配置，只会白写盘、白重取。
                  if (JSON.stringify(cleaned) === JSON.stringify(config.modelPresets)) return;
                  saveGlobal({ modelPresets: cleaned });
                }}
                onDrop={() => {
                  saveGlobal({ modelPresets: config.modelPresets.filter((_, j) => j !== i) });
                }}
              />
            ))}
            {/* 表尾那一格是「加一行」的落点：它本身不在 config 里，写进去才算数。
                提交成功之后换一次 key 让它重挂 —— 这一格的 value 恒为空串，
                不重挂的话刚打完的那个名字就留在框里，看着像还没存进去。
                重挂也顺便让 autoFocus 再算一次数：用回车加的那一条，
                光标要自己走到新的一格上接着打。 */}
            <PresetRow
              key={`add-${addKey}`}
              value=""
              label={t('ctrl.presetAdd')}
              placeholder={t('ctrl.presetAdd')}
              autoFocus={addFocus}
              onCommit={(name, viaEnter) => {
                const cleaned = cleanPresets([...config.modelPresets, name]);
                if (cleaned.length === config.modelPresets.length) return;
                saveGlobal({ modelPresets: cleaned });
                setAddKey((k) => k + 1);
                if (viaEnter) setAddFocus(true);
              }}
            />
          </div>

          <div className="silk" style={{ marginTop: 18 }}>
            {t('ctrl.paths')}
          </div>
          <div className="pathline">
            {t('ctrl.dataDir')} {config.paths.data}
            <br />
            {t('ctrl.promptsFile')} {config.paths.prompts}
          </div>
        </section>
      </div>
    </div>
  );
}
