import { useEffect, useRef, useState } from 'react';
import type { GenParams, RunEvent } from '@shared/types';
import type { T } from '../i18n';
import { Lamp, paramsLine } from './bits';

export interface LiveState {
  runId: string | null;
  providerName: string;
  model: string;
  params: GenParams | null;
  promptText: string;
  promptLabel: string;
  attempt: number;
  retry: string | null;
  text: string;
  reasoning: string;
}

export const EMPTY_LIVE: LiveState = {
  runId: null,
  providerName: '',
  model: '',
  params: null,
  promptText: '',
  promptLabel: '',
  attempt: 1,
  retry: null,
  text: '',
  reasoning: '',
};

/** 把 SSE 事件折成当前这一路的状态。start 会重置正文，因为那是新的一次尝试。 */
export function reduceEvents(events: RunEvent[]): LiveState {
  const s: LiveState = { ...EMPTY_LIVE };
  for (const e of events) {
    switch (e.type) {
      case 'start':
        s.runId = e.runId;
        s.providerName = e.providerName;
        s.model = e.model;
        s.params = e.params;
        s.promptText = e.prompt.text;
        s.promptLabel = e.prompt.label;
        s.attempt = e.attempt;
        s.retry = null;
        s.text = '';
        s.reasoning = '';
        break;
      case 'delta':
        s.text += e.text;
        break;
      case 'reasoning':
        s.reasoning += e.text;
        break;
      case 'retry':
        s.attempt = e.attempt;
        s.retry = e.reason;
        break;
      default:
        break;
    }
  }
  return s;
}

/**
 * 通电中的那一格。它不是一块弹出来的面板——它就是机架上的一格，
 * 只不过这一格此刻正亮着。跑完就熄灭，变成旁边那格标本。
 */
export function LiveBay({ state, t, onStop }: { state: LiveState; t: T; onStop: () => void }) {
  const streamRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const el = streamRef.current;
    if (!el || !follow) return;
    el.scrollTop = el.scrollHeight;
  }, [state.text, follow]);

  return (
    <div className="ch live">
      <div className="ch-head">
        <Lamp state="live" />
        <span className="ch-no">{t('live.title')}</span>
        {state.attempt > 1 && <span className="ch-dur">{t('live.attempt', { n: state.attempt })}</span>}
        <span className="spacer" />
        <button type="button" className="btn quiet halt dense" onClick={onStop}>
          {t('run.stop')}
        </button>
      </div>

      <div className="live-body">
        <div className="prompt-line">
          <b className="silk silk-hi">
            {state.promptLabel || t('sheet.prompt')} · {state.providerName} · {state.model}
          </b>
          {state.promptText || t('live.waiting')}
        </div>

        {state.retry && (
          <div className="prompt-line" style={{ color: 'var(--warn)' }}>
            {t('live.retrying', { reason: state.retry })}
          </div>
        )}

        {state.reasoning && (
          <>
            <div className="stream-head">
              <span className="silk">{t('live.reasoning')}</span>
              <span className="rule" />
            </div>
            <div className="stream reasoning">{state.reasoning}</div>
          </>
        )}

        <div className="stream-head">
          <span className="silk">{t('live.output')}</span>
          <span className="rule" />
          {state.params && <span className="read" style={{ color: 'var(--silk-mute)' }}>{paramsLine(state.params)}</span>}
          <button
            type="button"
            className="btn quiet dense"
            aria-pressed={follow}
            onClick={() => setFollow((v) => !v)}
          >
            {t('live.follow')}
          </button>
        </div>
        <div
          className="stream"
          ref={streamRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            if (atBottom !== follow) setFollow(atBottom);
          }}
        >
          {state.text || (state.retry ? '' : t('live.waiting'))}
        </div>
      </div>
    </div>
  );
}
