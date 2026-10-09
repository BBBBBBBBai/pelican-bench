import { useMemo, useState } from 'react';
import type { RunRecord } from '@shared/types';
import type { T } from '../i18n';
import { LiveBay, type LiveState } from './LiveBay';
import {
  channelOf,
  channelText,
  FlagTags,
  formatClock,
  formatDuration,
  isFault,
  Lamp,
  lampOf,
  rackOf,
  Switch,
  usePromptLabels,
  useProviderNames,
} from './bits';
import { Icon } from './Icon';

type Size = 's' | 'm' | 'l';
type Order = 'new' | 'old';

/* ────────────────────────────────────────────────────────────────────────────
   一格通道。作品原样铺在格子里——不加底色、不裁切、不套框。
   底下那几行丝印就是这格的完整自述：什么动物、谁画的、哪个模型、什么时候。
   左上角指示灯、右上角通道地址，所以单独截一格发出去也能看懂。
   ──────────────────────────────────────────────────────────────────────────── */

function Channel({
  record,
  t,
  tracked,
  onOpen,
  onRenderFailed,
}: {
  record: RunRecord;
  t: T;
  tracked: boolean;
  onOpen: (id: string) => void;
  onRenderFailed: (id: string, reason: string) => void;
}) {
  const [broken, setBroken] = useState(false);
  const animal = record.promptLabel || record.promptId;

  /* 画面、灯、铭牌三处必须是同一种颜色，否则一格之内自相矛盾。
     浏览器渲染失败 = 真出事（红）；没给 SVG / 截断 = 琥珀。
     红的那一组只在 bits.tsx 里定义一次（isFault）—— 两个地方各写一份迟早会分岔。 */
  const voidFault = broken || record.flags.some((f) => isFault(f.code));

  return (
    <button
      type="button"
      className="ch"
      data-tracked={tracked ? 'true' : undefined}
      title={t('ch.open', { animal })}
      onClick={() => onOpen(record.id)}
    >
      <div className="ch-head">
        <Lamp state={broken ? 'fault' : lampOf(record)} />
        <span className="spacer" />
        <span className="ch-dur">{formatDuration(record.durationMs)}</span>
        <span className="ch-no">{t('addr.channel', { n: channelText(channelOf(record)) })}</span>
      </div>

      <div className="ch-plate">
        {record.hasSvg && !broken ? (
          <img
            src={`/api/records/${record.id}/svg`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => {
              setBroken(true);
              onRenderFailed(record.id, t('run.renderFailedByBrowser'));
            }}
          />
        ) : (
          <div className={voidFault ? 'broken fault' : 'broken'}>
            <span className="silk">{t(record.hasSvg ? 'ch.broken' : 'ch.noSvg')}</span>
          </div>
        )}
      </div>

      <div className="ch-silk">
        <div className="ch-animal">{animal}</div>
        <div className="ch-prov">{record.providerName}</div>
        <div className="ch-model">{record.requestedModel}</div>
        <div className="ch-when" title={t('ch.when')}>
          {rackOf(record)} {formatClock(record.createdAt)}
        </div>
        <FlagTags flags={record.flags} t={t} />
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   机架：按「机架 = 落盘那天」分组，组内是通道格。
   一屏能扫过去的密度优先于单格面积——这是几百到上千条时要用的东西。
   ──────────────────────────────────────────────────────────────────────────── */

export function Rack({
  records,
  t,
  trackedId,
  running,
  live,
  onStop,
  onOpen,
  onRenderFailed,
}: {
  records: RunRecord[];
  t: T;
  trackedId: string | null;
  running: boolean;
  live: LiveState;
  onStop: () => void;
  onOpen: (id: string) => void;
  onRenderFailed: (id: string, reason: string) => void;
}) {
  const providers = useProviderNames(records);
  const prompts = usePromptLabels(records);

  const [profile, setProfile] = useState<string>('all');
  const [promptId, setPromptId] = useState<string>('all');
  /* 状态是三档，不是布尔。原来只有「全部 / 只看有异常的」两档，一颗 onlyIssues
     布尔就够；加进「只看无异常的」之后布尔表达不了，所以这里直接存档位本身，
     下面两个派生布尔只给筛选与文案用。 */
  const [status, setStatus] = useState<'all' | 'issues' | 'clean'>('all');
  const onlyIssues = status === 'issues';
  const onlyClean = status === 'clean';
  const [order, setOrder] = useState<Order>('new');
  const [size, setSize] = useState<Size>('m');
  /* 窄屏上这一排挡位默认是收着的，点「筛选」才放出来。
     状态写在这里而不是 CSS 里：它要能被 `aria-expanded` 说出来。
     宽屏上这颗键不存在、内容由 CSS 强制展开，所以这个 state 在宽屏上是死的。 */
  const [railOpen, setRailOpen] = useState(false);

  const dirty = profile !== 'all' || promptId !== 'all' || status !== 'all' || order !== 'new' || size !== 'm';

  /* 收成一行之后，这一行必须自己说清「现在生效的是哪几个条件」——
     否则每看一眼画廊都要先点开来确认，收起来省下的高度就又赔进去了。
     只列非默认值：一个都没改的时候它就是「全部」两个字。 */
  const active = [
    profile === 'all' ? null : profile,
    promptId === 'all' ? null : (prompts.find((p) => p.id === promptId)?.label ?? promptId),
    order === 'new' ? null : t('rail.old'),
    size === 'm' ? null : t(size === 's' ? 'rail.dense' : 'rail.wide'),
    status === 'all' ? null : t(status === 'issues' ? 'rail.issues' : 'rail.clean'),
  ].filter((v): v is string => Boolean(v));

  const visible = useMemo(() => {
    const out = records.filter((r) => {
      if (profile !== 'all' && r.providerName !== profile) return false;
      if (promptId !== 'all' && r.promptId !== promptId) return false;
      if (onlyIssues && r.flags.length === 0) return false;
      if (onlyClean && r.flags.length > 0) return false;
      return true;
    });
    return order === 'old' ? [...out].reverse() : out;
  }, [records, profile, promptId, status, order]);

  const groups = useMemo(() => {
    const map = new Map<string, RunRecord[]>();
    for (const r of visible) {
      const k = rackOf(r);
      const bucket = map.get(k);
      if (bucket) bucket.push(r);
      else map.set(k, [r]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <>
      <div className={'rail' + (railOpen ? ' open' : '')}>
        {/* ── 摘要行 ──────────────────────────────────────────────────────
            窄屏上这一行是横杆的全部：当前生效的条件 + 显示几条 + 一颗开关键。
            宽屏上下面那颗键和这段摘要都收掉（CSS 里 display:none），
            看到的就是原来那条会折行的横杆 —— 宽屏没有要省的高度。 */}
        <div className="rail-line">
          <span className="rail-cur">
            {active.length === 0 ? t('rail.all') : active.join(' · ')}
          </span>
          <span className="spacer" />
          <span className="read" style={{ color: 'var(--silk-mute)', whiteSpace: 'nowrap' }}>
            {t('rail.shown', { n: visible.length, total: records.length })}
          </span>
          <button
            type="button"
            className="btn quiet rail-toggle"
            aria-expanded={railOpen}
            aria-controls="rail-full"
            onClick={() => setRailOpen((v) => !v)}
          >
            {t('rail.filters')}
          </button>
        </div>

        {/* ── 全部条件 ────────────────────────────────────────────────────
            窄屏上由上面那颗键开合（用 `.fold` 同一套 block-size 插值，
            所以这台仪器里仍然只有一种抽屉的读感）；宽屏上强制展开。 */}
        <div className="rail-full" id="rail-full">
          <div className="rail-groups">
            <div className="rail-group">
              <span className="silk">{t('rail.profile')}</span>
              <div className="detents">
                <button type="button" aria-pressed={profile === 'all'} onClick={() => setProfile('all')}>
                  {t('rail.all')}
                </button>
                {providers.map((p) => (
                  <button key={p} type="button" aria-pressed={profile === p} onClick={() => setProfile(p)} title={p}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <span className="rail-sep" />

            <div className="rail-group">
              <span className="silk">{t('rail.prompt')}</span>

              <select
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                aria-label={t('rail.prompt')}
              >
                <option value="all">{t('rail.anyPrompt')}</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

            </div>

            <span className="rail-sep" />

            <div className="rail-group">
              <span className="silk">{t('rail.order')}</span>
              <Switch<Order>
                value={order}
                onChange={setOrder}
                label={t('rail.order')}
                options={[
                  { value: 'new', label: t('rail.new') },
                  { value: 'old', label: t('rail.old') },
                ]}
              />
            </div>

            <div className="rail-group">
              <span className="silk">{t('rail.cell')}</span>
              <Switch<Size>
                value={size}
                onChange={setSize}
                label={t('rail.cell')}
                options={[
                  { value: 's', label: t('rail.dense') },
                  { value: 'm', label: t('rail.mid') },
                  { value: 'l', label: t('rail.wide') },
                ]}
              />
            </div>

            <div className="rail-group status-group">
              <span className="silk">{t('rail.status')}</span>
              <div className="sw" role="group" aria-label={t('rail.status')}>
                <button
                  type="button"
                  aria-pressed={status === 'all'}
                  title={t('rail.all')}
                  onClick={() => setStatus('all')}
                >
                  {t('rail.all')}
                </button>
                <button
                  type="button"
                  aria-pressed={status === 'issues'}
                  title={t('rail.onlyIssues')}
                  onClick={() => setStatus('issues')}
                >
                  {t('rail.issues')}
                </button>
                <button
                  type="button"
                  aria-pressed={status === 'clean'}
                  title={t('rail.cleanHint')}
                  onClick={() => setStatus('clean')}
                >
                  {t('rail.clean')}
                </button>
              </div>
            </div>

            {dirty && (
              <button
                type="button"
                className="btn quiet"
                onClick={() => {
                  setProfile('all');
                  setPromptId('all');
                  setStatus('all');
                  setOrder('new');
                  setSize('m');
                }}
              >
                {t('rail.reset')}
              </button>
            )}

            <span className="spacer" />
            <span className="read rail-shown" style={{ color: 'var(--silk-mute)', whiteSpace: 'nowrap' }}>
              {t('rail.shown', { n: visible.length, total: records.length })}
            </span>
          </div>
        </div>
      </div>

      <div className="rack-scroll">
        <div className="rack" data-size={size}>
          {running && (
            <div className="rack-grid" style={{ marginTop: 14 }}>
              <LiveBay state={live} t={t} onStop={onStop} />
            </div>
          )}

          {groups.map(([rack, items]) => (
            <section key={rack}>
              <div className="rack-band">
                <span className="addr">{t('addr.rack', { date: rack })}</span>
                <span className="rule" />
                <span className="silk">{t('rack.count', { n: items.length })}</span>
              </div>
              <div className="rack-grid">
                {items.map((r) => (
                  <Channel
                    key={r.id}
                    record={r}
                    t={t}
                    tracked={r.id === trackedId}
                    onOpen={onOpen}
                    onRenderFailed={onRenderFailed}
                  />
                ))}
              </div>
            </section>
          ))}

          {records.length === 0 && !running && (
            <div className="empty">
              <span className="silk silk-note">{t('rack.empty')}</span>
              {t('rack.emptyHint')}
            </div>
          )}

          {records.length > 0 && visible.length === 0 && !running && (
            <div className="empty">
              <span className="silk silk-note">{t('rack.noneMatch')}</span>
              <button
                type="button"
                className="btn quiet"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setProfile('all');
                  setPromptId('all');
                  setStatus('all');
                }}
              >
                <Icon name="x" />
                {t('rail.reset')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
