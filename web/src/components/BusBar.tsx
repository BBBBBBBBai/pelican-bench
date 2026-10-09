import type { RunRecord } from '@shared/types';
import type { Lang, T } from '../i18n';
import type { LiveState } from './LiveBay';
import { channelOf, channelText, formatDuration, Lamp, Switch } from './bits';

/**
 * 顶部总线条：铭牌 + 两个计数器 + 一个状态灯，右端是正在测那一路的实时读数。
 * 这里没有标语、没有 hero、没有欢迎语——仪器正面不写这些。
 *
 * 「正在测那一路」在三个地方同时被标记：机架网格里的那一格、这条总线条的右端、
 * 以及标本页的地址行。指针沿通道推进，位置不丢。
 */
export function BusBar({
  t,
  lang,
  racks,
  channels,
  running,
  live,
  tracked,
  onLang,
}: {
  t: T;
  lang: Lang;
  racks: number;
  channels: number;
  running: boolean;
  live: LiveState;
  tracked: RunRecord | null;
  onLang: (l: Lang) => void;
}) {
  /* 跑的时候读的是这次运行的活数据，跑完读的是刚落盘那一格的记录。 */
  const animal = running ? live.promptLabel : (tracked?.promptLabel ?? '');
  const who = running ? live.providerName : (tracked?.providerName ?? '');
  const right = running ? live.model : tracked ? formatDuration(tracked.durationMs) : '';
  const addr = running
    ? t('bus.testing')
    : tracked
      ? t('addr.channel', { n: channelText(channelOf(tracked)) })
      : '';
  const show = running || Boolean(tracked);

  return (
    <div className="busbar">
      <div className="nameplate">
        <b>{t('app.brandMark')}</b>
        <span>{t('app.tagline')}</span>
      </div>

      <div className="window">
        <span className="silk">{t('bus.rack')}</span>
        <span className="read-lg">{racks}</span>
        <span className="silk" style={{ marginLeft: 6 }}>
          {t('bus.channel')}
        </span>
        <span className="read-lg">{channels}</span>
      </div>

      <div className={`window${running ? ' hot' : ''}`} style={{ alignItems: 'center' }}>
        <Lamp state={running ? 'live' : 'off'} />
        <span className="silk" style={{ color: running ? 'var(--lamp)' : undefined }}>
          {running ? t('bus.live') : t('bus.idle')}
        </span>
      </div>

      <span className="spacer" />

      {show && (
        <div
          className="bus-track"
          data-live={running ? 'true' : undefined}
          title={running ? t('bus.onTest') : t('bus.lastRun')}
        >
          <Lamp state={running ? 'live' : 'ok'} />
          <span className="addr">{addr}</span>
          {animal && <span className="who">{animal}</span>}
          {who && <span className="who dim">{who}</span>}
          {right && <span className="read">{right}</span>}
        </div>
      )}

      <Switch<Lang>
        value={lang}
        onChange={onLang}
        label="language"
        options={[
          { value: 'zh', label: t('app.lang.zh') },
          { value: 'en', label: t('app.lang.en') },
        ]}
      />
    </div>
  );
}
