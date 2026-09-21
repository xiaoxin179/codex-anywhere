import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ContextUsage } from '../../src/shared/context-compaction';
import type { AccountRateLimit, AccountUsage } from '../../src/shared/account-usage';
import type { ExecutionState } from './app-types';
import { presenceLabel } from './app-utils';
import { t } from './i18n';

type PresenceIndicatorProps = {
  online: boolean;
  executionState: ExecutionState;
  statusText: string;
  contextUsage: ContextUsage | null;
  accountUsage?: AccountUsage | null;
  onRePair?: () => void;
};

const CONTEXT_RING_COLOR_STOPS = [
  { percent: 0, color: [99, 160, 255] },
  { percent: 65, color: [99, 160, 255] },
  { percent: 80, color: [224, 160, 94] },
  { percent: 92, color: [239, 102, 114] },
  { percent: 100, color: [239, 102, 114] },
] as const;

export function contextRingTone(percent: number) {
  const bounded = Math.min(100, Math.max(0, percent));
  const upperIndex = CONTEXT_RING_COLOR_STOPS.findIndex((stop) => stop.percent >= bounded);
  const upper = CONTEXT_RING_COLOR_STOPS[Math.max(0, upperIndex)];
  const lower = CONTEXT_RING_COLOR_STOPS[Math.max(0, upperIndex - 1)];
  const span = upper.percent - lower.percent;
  const progress = span ? (bounded - lower.percent) / span : 0;
  const color = lower.color.map((channel, index) => (
    Math.round(channel + (upper.color[index] - channel) * progress)
  ));
  const hex = `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  return { color: hex, glow: `rgba(${color.join(', ')}, .42)` };
}

export function contextUsagePresentation(usage: ContextUsage | null) {
  const percent = usage?.tokens !== undefined && usage.contextWindow
    ? Math.min(100, Math.max(0, Math.round(usage.tokens / usage.contextWindow * 100)))
    : null;
  const detail = usage?.tokens !== undefined && usage.contextWindow
    ? `${usage.tokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} Token`
    : usage?.tokens !== undefined
      ? `${usage.tokens.toLocaleString()} Token`
      : '';
  return { percent, detail };
}

export function accountLimitPresentation(usage: AccountUsage | null) {
  const byWindow = new Map(usage?.limits.map((limit) => [limit.windowMinutes, limit]) || []);
  return [
    { key: 'five-hour', shortLabel: '5h', zhLabel: '5 小时', enLabel: '5 hour', limit: byWindow.get(300) },
    { key: 'weekly', shortLabel: t('周', 'Wk'), zhLabel: '周', enLabel: 'Weekly', limit: byWindow.get(10_080) },
  ].flatMap((entry) => entry.limit ? [{
    ...entry,
    limit: entry.limit,
    remainingPercent: Math.min(100, Math.max(0, Math.round(100 - entry.limit.usedPercent))),
  }] : []);
}

function resetLabel(limit: AccountRateLimit) {
  if (!limit.resetsAt) return '';
  return new Date(limit.resetsAt).toLocaleString(undefined, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function PresenceIndicator({
  online,
  executionState,
  statusText,
  contextUsage,
  accountUsage = null,
  onRePair,
}: PresenceIndicatorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);
  const stateLabel = presenceLabel(online, executionState, statusText);
  const { percent, detail } = contextUsagePresentation(contextUsage);
  const contextLabel = detail
    ? t(`上下文 ${percent === null ? '' : `${percent}% · `}${detail}`, `Context ${percent === null ? '' : `${percent}% · `}${detail}`)
    : '';
  const label = [stateLabel, contextLabel].filter(Boolean).join(' · ');
  const ringTone = percent === null ? null : contextRingTone(percent);
  const ringStyle = ringTone ? {
    '--context-ring-color': ringTone.color,
    '--context-ring-glow': ringTone.glow,
  } as CSSProperties : undefined;
  const accountLimits = accountLimitPresentation(accountUsage);
  return (
    <div className="presence-cluster">
      {accountLimits.length > 0 && (
        <div className="account-usage" aria-label={t('账户剩余额度', 'Account limits remaining')}>
          {accountLimits.map(({ key, shortLabel, zhLabel, enLabel, limit, remainingPercent }) => {
            const reset = resetLabel(limit);
            const detail = t(
              `${zhLabel}额度剩余 ${remainingPercent}%${reset ? `，${reset} 重置` : ''}`,
              `${enLabel} limit ${remainingPercent}% remaining${reset ? ` · resets ${reset}` : ''}`,
            );
            return (
              <span
                key={key}
                className="account-limit"
                tabIndex={0}
                aria-label={detail}
                title={detail}
                style={{ '--account-limit-remaining': `${remainingPercent}%` } as CSSProperties}
              >
                <span>{shortLabel}</span>
                <strong>{remainingPercent}%</strong>
                <i aria-hidden="true" />
                <em aria-hidden="true">{detail}</em>
              </span>
            );
          })}
        </div>
      )}
      <div className="presence-control" ref={controlRef}>
        <button
          type="button"
          className={`presence ${online ? 'online' : 'offline'} ${online ? executionState : ''}`}
          style={ringStyle}
          aria-live="polite"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={label}
          data-context-percent={percent ?? undefined}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <svg className="presence-context-ring" viewBox="0 0 30 30" aria-hidden="true">
            <circle className="presence-context-track" cx="15" cy="15" r="12.5" pathLength="100" />
            {percent !== null && (
              <circle
                className="presence-context-value"
                cx="15"
                cy="15"
                r="12.5"
                pathLength="100"
                strokeDasharray={`${percent} ${100 - percent}`}
                transform="rotate(-90 15 15)"
              />
            )}
          </svg>
          <i aria-hidden="true" />
          <span className="visually-hidden">{label}</span>
        </button>
        {menuOpen && (
          <div className="presence-menu" role="menu">
            <div className="presence-menu-status">
              <strong>{stateLabel}</strong>
              {contextLabel && <small>{contextLabel}</small>}
            </div>
            {onRePair && (
              <button type="button" role="menuitem" onClick={() => {
                setMenuOpen(false);
                onRePair();
              }}>
                {t('重新配对', 'Pair again')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
