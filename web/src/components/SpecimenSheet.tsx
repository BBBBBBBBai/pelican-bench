import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RecordDetail } from '../api';
import type { Lang, T } from '../i18n';
import { checkSvg } from '../lib/svgCheck';
import { SvgFrame } from './SvgFrame';
import { Icon } from './Icon';
import { CopyButton, channelOf, channelText, FlagTags, formatTime, lampOf, Lamp, paramsLine, rackOf, usageLine } from './bits';

function Fold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="fold">
      <summary>{label}</summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

// 焦点陷阱要收集的落点。`<details>` 里的内容在收起时不占布局，
// offsetParent 为 null，会被下面那句过滤掉——收起抽屉里的按钮
// 不该被 Tab 抓到。
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * 标本页：一张巨型样本 + 边缘一圈极小的等宽读数。
 * 整页就是为了被截一张图发出去——所以所有能解释这张图的事实都在这张图上。
 */
export function SpecimenSheet({
  detail,
  t,
  lang,
  onClose,
  onDelete,
  onRenderFailed,
}: {
  detail: RecordDetail;
  t: T;
  lang: Lang;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRenderFailed: (id: string, reason: string) => void;
}) {
  const { record, svg, raw, reasoning } = detail;
  const reported = useRef<string | null>(null);

  // 关闭要先播完退场动画再卸载，所以组件自己管一个 leaving 相位。
  // 存档动作（删除）只在用户确认之后才进入这个相位——否则确认到一半
  // 又反悔，面板就卡在「正在退场」的状态里回不来了。
  const [leaving, setLeaving] = useState(false);

  // 「删除」是两段式的，和供应商那一颗同一套：第一段什么都不删，
  // 只是把键扣下去（文字变「确认删除」、键座凹进去、刻线提亮），
  // 第二段才真的删。
  //
  // 这里替换掉了原来的 `window.confirm`：那个浏览器对话框既打断了
  // 用户，又长得完全不属于这台仪器，还逼着 App 用「返回 true 才开始
  // 退场」来跟面板对台词。确认本来就是一颗按钮该干的事。
  //
  // 这段状态随面板一起卸载 —— 关掉再打开同一条记录，闩一定是弹回的。
  const [armed, setArmed] = useState(false);
  const leavingRef = useRef(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const beginClose = useCallback((after?: () => void) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    pendingAction.current = after ?? null;
    setLeaving(true);
  }, []);

  const settle = useCallback(() => {
    const act = pendingAction.current;
    pendingAction.current = null;
    if (act) act();
    else onClose();
  }, [onClose]);

  // 退场动画的正常出口是 animationend；再加一个兜底计时器，
  // 免得动画因为任何原因没跑（被中断、元素被 display:none）时面板永远关不掉。
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(settle, 400);
    return () => window.clearTimeout(timer);
  }, [leaving, settle]);

  const verdict = svg ? checkSvg(svg) : { ok: false, reason: 'no svg' };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 闩扣着的时候，Esc 先弹闩而不是关面板：用户想收回的是那个确认，
      // 不是整张标本页。再按一次才轮到关闭。
      if (armed) {
        setArmed(false);
        return;
      }
      beginClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beginClose, armed]);

  useEffect(() => {
    if (!svg || verdict.ok) return;
    if (reported.current === record.id) return;
    reported.current = record.id;
    onRenderFailed(record.id, verdict.reason ?? t('run.renderFailedByBrowser'));
    // verdict 由 svg 派生，这里只关心 record 换了没有
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, svg]);

  function download() {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.providerName}-${record.promptLabel}-${record.id}.svg`.replace(/[\\/:*?"<>|\s]+/g, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const animal = record.promptLabel || record.promptId;

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // 打开时把焦点收进面板，关闭时还给原来那一格。没有这一段，
  // `aria-modal="true"` 就是一句谎话：Tab 会一路走到遮罩后面的格子上去，
  // 键盘用户以为自己在弹窗里，其实在操作被盖住的机架。
  //
  // 面板走 portal 挂在 body 上，所以背景那一整棵 `#root` 可以直接标成
  // `inert`——它同时在指针、焦点和辅助技术三边把机架关掉，比手写
  // 「给所有兄弟节点加 aria-hidden」可靠得多。清理时必须先摘掉 inert
  // 再 focus，否则焦点还给一个惰性子树会被浏览器拒绝。
  useEffect(() => {
    const root = document.getElementById('root');
    const restoreTo = document.activeElement as HTMLElement | null;
    // 手机上整份文档就是那个滚动容器（5273px 长），面板浮在上面时
    // 底下还会跟着手指滚。`inert` 挡得住焦点和指针，挡不住滚动。
    // 用 overflow: hidden 锁住，滚动位置不会跳——html 上的 hidden
    // 只是停掉滚动机制，当前 scrollY 原样保留。
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    closeRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      root?.removeAttribute('inert');
      if (restoreTo && document.contains(restoreTo)) restoreTo.focus();
    };
  }, []);

  // 焦点陷阱：Tab / Shift+Tab 在面板内部循环。
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    }
  };

  const sheet = (
    <>
      {/* 遮罩：房间暗下来。它不是一个可点的「背景」，所以不接受指针事件；
          点击关闭挂在面板外面这一圈留白上。 */}
      <div className={`sheet-scrim${leaving ? ' leaving' : ''}`} aria-hidden="true" />
      <div className={`sheet-plate${leaving ? ' leaving' : ''}`} onMouseDown={(e) => {
        // 只在按到面板外面的留白时收起，按在面板上拖动不会误关
        if (e.target === e.currentTarget) beginClose();
      }}>
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={`${animal} · ${record.providerName}`}
          ref={dialogRef}
          onKeyDown={onKeyDown}
          onAnimationEnd={(e) => {
            // 动画事件会冒泡：抽屉的 fold-out 也会飘到这里来，必须认准是面板自己
            if (leaving && e.target === e.currentTarget) settle();
          }}
        >
          <div className="sheet-head">
            <span className="sheet-addr">
              {t('addr.full', { date: rackOf(record), n: channelText(channelOf(record)) })}
            </span>
            <Lamp state={lampOf(record)} />
            <span className="silk silk-hi">{animal}</span>
            <span className="silk-plain">
              {record.providerName} · {record.requestedModel}
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="btn quiet icon"
              ref={closeRef}
              onClick={() => beginClose()}
              title={t('sheet.close')}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

      <div className="sheet-body">
        <div className="sheet-main">
          <div className="plate">
            {svg ? (
              <SvgFrame svg={svg} title={animal} fallback={t('sheet.renderFailed')} />
            ) : (
              <div className="broken">
                <span className="silk">{t('sheet.noSvg')}</span>
                <span className="note">{t('sheet.noSvgHint')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <CopyButton text={record.promptText} label={t('sheet.copyPrompt')} copiedLabel={t('sheet.copied')} />
            {svg && <CopyButton text={svg} label={t('sheet.copySvg')} copiedLabel={t('sheet.copied')} />}
            {svg && (
              <button type="button" className="btn quiet" onClick={download}>
                <Icon name="download" />
                {t('sheet.download')}
              </button>
            )}
            {/* 两段式。第一段不删任何东西，只是把键扣下去：文字变
                「确认删除」、键座凹进去、刻线提亮。第二段才真的删，
                并且要等面板退场动画播完才卸载。
                用 aria-pressed 而不是 aria-label —— 文字已经换过了，
                屏幕阅读器读到的是「确认删除，已按下」，正好是这件事。 */}
            <button
              type="button"
              className={`btn quiet halt${armed ? ' armed' : ''}`}
              aria-pressed={armed}
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                // 第二段：先把闩弹回，再让面板开始退场。删除本身挂在
                // pendingAction 上，等退场播完（或兜底计时器到点）才执行，
                // 所以「开始退场」和「真的删掉」之间不会有一段空窗期
                // 让用户以为没反应。
                setArmed(false);
                beginClose(() => onDelete(record.id));
              }}
            >
              <Icon name="trash" />
              {armed ? t('sheet.deleteArmed') : t('sheet.delete')}
            </button>
          </div>

          {/* 原来那句后果说明住在 `window.confirm` 里，换成两段式按钮之后
              不能就这么丢掉 —— 用户仍然该被告知「文件会一起没」。
              只在闩扣下去之后出现（没扣下时它是一句噪音），不播入场动画：
              这台仪器里状态变化是即刻的，多一段淡入反而像在催人。
              aria-live 让屏幕阅读器在它出现时读到。 */}
          {armed && (
            <p className="note" role="status" style={{ color: 'var(--fault)', maxWidth: '62ch' }}>
              {t('sheet.deleteWarn')}
            </p>
          )}

          <div className="prompt-line" style={{ marginTop: 14, borderTop: '1px solid var(--engrave)', borderBottom: 0, paddingTop: 12 }}>
            <b className="silk silk-hi">{t('sheet.prompt')}</b>
            {record.promptText}
          </div>

          {svg && (
            <Fold label={`${t('sheet.svgSource')} · ${svg.length}`}>
              <pre className="code">{svg}</pre>
            </Fold>
          )}

          {reasoning && (
            <Fold label={t('sheet.reasoning')}>
              <pre className="code">{reasoning}</pre>
            </Fold>
          )}

          {raw ? (
            <Fold label={t('sheet.raw')}>
              <pre className="code">{raw}</pre>
            </Fold>
          ) : (
            <div className="note">{t('sheet.rawNotSaved')}</div>
          )}
        </div>

        <aside className="sheet-facts">
          <div className="bay-head">
            <span className="silk silk-hi">{t('sheet.facts')}</span>
            <span className="rule" />
          </div>

          <dl className="facts">
            <dt>{t('meta.channel')}</dt>
            <dd>
              {t('addr.full', { date: rackOf(record), n: channelText(channelOf(record)) })}
            </dd>
            <dt>{t('meta.time')}</dt>
            <dd>{formatTime(record.createdAt, lang)}</dd>
            <dt>{t('meta.duration')}</dt>
            <dd>
              {record.durationMs} ms
            </dd>
            <dt>{t('meta.attempts')}</dt>
            <dd>{record.attempts}</dd>
            <dt>{t('meta.provider')}</dt>
            <dd>{record.providerName}</dd>
            <dt>{t('meta.prompt')}</dt>
            <dd>{record.promptLabel}</dd>
            <dt>{t('meta.requestedModel')}</dt>
            <dd>{record.requestedModel}</dd>
            <dt>{t('meta.responseModel')}</dt>
            <dd className={record.flags.some((f) => f.code === 'model-mismatch') ? 'hot' : undefined}>
              {record.responseModel ?? '—'}
            </dd>
            <dt>{t('meta.params')}</dt>
            <dd>{paramsLine(record.params)}</dd>
            <dt>{t('meta.overrides')}</dt>
            <dd className="dim">{t(record.usedOverrides ? 'meta.overridesYes' : 'meta.overridesNo')}</dd>
            <dt>{t('meta.usage')}</dt>
            <dd>{usageLine(record.usage)}</dd>
            <dt>{t('meta.finishReason')}</dt>
            <dd className={record.finishReason && record.finishReason !== 'stop' && record.finishReason !== 'end_turn' ? 'hot' : undefined}>
              {record.finishReason ?? '—'}
            </dd>
            <dt>{t('meta.protocol')}</dt>
            <dd>{record.protocol}</dd>
            <dt>{t('meta.baseUrl')}</dt>
            <dd className="dim">{record.baseUrl}</dd>
            <dt>{t('meta.responseId')}</dt>
            <dd className="dim">{record.responseId ?? '—'}</dd>
            <dt>{t('meta.rawLength')}</dt>
            <dd>{record.rawLength}</dd>
          </dl>

          <div className="bay-head" style={{ marginTop: 18 }}>
            <span className="silk silk-hi">{t('sheet.flags')}</span>
            <span className="rule" />
          </div>

          {record.flags.length === 0 ? (
            <div className="note" style={{ marginTop: 0 }}>
              {t('sheet.noFlags')}
            </div>
          ) : (
            <>
              <FlagTags flags={record.flags} t={t} />
              <dl className="facts" style={{ marginTop: 10 }}>
                {record.flags.map((f) => (
                  <dd
                    key={f.code}
                    style={{ gridColumn: '1 / -1', textAlign: 'left', color: 'var(--silk-dim)' }}
                    title={f.detail}
                  >
                    {t(`flag.${f.code}`)} — {f.detail}
                  </dd>
                ))}
              </dl>
            </>
          )}

          {record.error && (
            <>
              <div className="bay-head" style={{ marginTop: 18 }}>
                <span className="silk silk-hi" style={{ color: 'var(--fault)' }}>
                  {t('sheet.error')}
                </span>
                <span className="rule" />
              </div>
              <pre className="code" style={{ color: 'var(--fault)' }}>
                {record.error}
              </pre>
            </>
          )}

          <div className="pathline">
            {record.id}
            <br />
            {record.svgPath ?? '—'}
          </div>
        </aside>
      </div>
        </div>
      </div>
    </>
  );

  // 挂到 body 上：面板是浮在机架之上的一层，不该受 .bench 的网格
  // 和层叠上下文摆布
  return createPortal(sheet, document.body);
}