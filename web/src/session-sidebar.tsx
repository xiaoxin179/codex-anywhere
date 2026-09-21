import { memo, useEffect, useMemo, useState } from 'react';
import {
  formatDate,
  isSessionRunning,
  sessionProjectName,
  sessionUpdatedAt,
  type SessionAttentionState,
} from './app-utils';
import type { ExecutionState, Session } from './app-types';
import { t } from './i18n';
import { CustomSelect, SidebarIcon } from './ui-components';
import { environmentDisplayName } from './execution-environments';

type SessionSidebarProps = {
  open: boolean;
  environmentId: string;
  environmentIds: string[];
  onlineEnvironmentIds: string[];
  sessions: Session[];
  selectedThreadId: string | null;
  executionState: ExecutionState;
  attention: SessionAttentionState;
  searchOpen: boolean;
  search: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchChange: (search: string) => void;
  onEnvironmentChange: (environmentId: string) => void;
  onNewSession: (cwd?: string) => void;
  onClose: () => void;
  onSelect: (session: Session) => void;
};

export type SessionProjectGroup = {
  key: string;
  name: string;
  cwd: string;
  sessions: Session[];
  updatedAt: number;
  canStartNewSession: boolean;
};

const GENERAL_PROJECT_KEY = 'general';
const COLLAPSED_PROJECTS_STORAGE_PREFIX = 'codex-anywhere.collapsed-projects.v1:';

export function groupSessionsByProject(sessions: Session[]): SessionProjectGroup[] {
  const groups = new Map<string, SessionProjectGroup>();
  for (const session of sessions) {
    const cwd = String(session.cwd || '').trim();
    const normalizedCwd = cwd.replace(/[\\/]+$/, '') || cwd;
    const name = sessionProjectName(cwd);
    const key = name && cwd ? `cwd:${normalizedCwd.toLocaleLowerCase()}` : GENERAL_PROJECT_KEY;
    const updatedAt = sessionUpdatedAt(session.updatedAt);
    const existing = groups.get(key);
    if (existing) {
      existing.sessions.push(session);
      existing.updatedAt = Math.max(existing.updatedAt, updatedAt);
      existing.canStartNewSession ||= Boolean(existing.cwd && session.canStartNewSession !== false);
      continue;
    }
    groups.set(key, {
      key,
      name,
      cwd: name ? cwd : '',
      sessions: [session],
      updatedAt,
      canStartNewSession: Boolean(name && cwd && session.canStartNewSession !== false),
    });
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      sessions: [...group.sessions]
        .sort((left, right) => sessionUpdatedAt(right.updatedAt) - sessionUpdatedAt(left.updatedAt)),
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function loadCollapsedProjects(environmentId: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const value = JSON.parse(localStorage.getItem(`${COLLAPSED_PROJECTS_STORAGE_PREFIX}${environmentId}`) || '[]');
    return new Set(Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string').slice(0, 200) : []);
  } catch {
    return new Set<string>();
  }
}

function storeCollapsedProjects(environmentId: string, projects: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${COLLAPSED_PROJECTS_STORAGE_PREFIX}${environmentId}`,
      JSON.stringify([...projects].slice(0, 200)),
    );
  } catch { /* storage may be unavailable */ }
}

/**
 * Kept outside App so prompt typing and live progress updates do not rebuild a
 * potentially long session list. It still refreshes for real session/status changes.
 */
export const SessionSidebar = memo(function SessionSidebar({
  open,
  environmentId,
  environmentIds,
  onlineEnvironmentIds,
  sessions,
  selectedThreadId,
  executionState,
  attention,
  searchOpen,
  search,
  onSearchOpenChange,
  onSearchChange,
  onEnvironmentChange,
  onNewSession,
  onClose,
  onSelect,
}: SessionSidebarProps) {
  const projectGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matches = query
      ? sessions.filter((session) => `${session.title} ${session.cwd || ''} ${session.preview || ''}`
        .toLocaleLowerCase().includes(query))
      : sessions;
    return groupSessionsByProject(matches);
  }, [search, sessions]);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    () => loadCollapsedProjects(environmentId),
  );
  useEffect(() => {
    setCollapsedProjects(loadCollapsedProjects(environmentId));
  }, [environmentId]);
  const toggleProject = (key: string) => {
    setCollapsedProjects((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      storeCollapsedProjects(environmentId, next);
      return next;
    });
  };
  const environmentOptions = useMemo(() => environmentIds.map((id) => {
    const online = onlineEnvironmentIds.includes(id);
    return {
      value: id,
      label: environmentDisplayName(id),
      description: online ? t('在线', 'Online') : t('离线', 'Offline'),
      leading: <span className={`environment-status-dot ${online ? 'online' : 'offline'}`} />,
    };
  }), [environmentIds, onlineEnvironmentIds]);
  const selectedEnvironmentOnline = onlineEnvironmentIds.includes(environmentId);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label={t('会话列表', 'Session list')}>
      <div className="sidebar-head">
        <div><p className="eyebrow">CODEX ANYWHERE</p></div>
        <div className="sidebar-actions">
          <button className="sidebar-tool" onClick={() => onNewSession()} aria-label={t('新会话', 'New session')} title={t('新会话', 'New session')}>
            <SidebarIcon name="plus" />
          </button>
          <button
            className={`sidebar-tool ${searchOpen ? 'active' : ''}`}
            onClick={() => {
              if (searchOpen) onSearchChange('');
              onSearchOpenChange(!searchOpen);
            }}
            aria-label={searchOpen ? t('收起搜索', 'Collapse search') : t('搜索会话', 'Search sessions')}
            title={searchOpen ? t('收起搜索', 'Collapse search') : t('搜索会话', 'Search sessions')}
          >
            <SidebarIcon name="search" />
          </button>
          <button className="sidebar-tool mobile-only" onClick={onClose} aria-label={t('收起会话列表', 'Collapse session list')} title={t('收起会话列表', 'Collapse session list')}>
            <SidebarIcon name="panel-close" />
          </button>
        </div>
      </div>
      <div className="environment-picker">
        <span className="environment-picker-label">{t('执行环境', 'Execution environment')}</span>
        <CustomSelect
          className="environment-picker-select"
          value={environmentId}
          options={environmentOptions}
          onChange={onEnvironmentChange}
          ariaLabel={t('切换执行环境', 'Switch execution environment')}
          triggerContent={(
            <>
              <span className={`environment-status-dot ${selectedEnvironmentOnline ? 'online' : 'offline'}`} aria-hidden="true" />
              <strong>{environmentDisplayName(environmentId)}</strong>
              <small>{selectedEnvironmentOnline ? t('在线', 'Online') : t('离线', 'Offline')}</small>
            </>
          )}
        />
      </div>
      {searchOpen && (
        <label className="compact-search session-search-panel">
          <span className="compact-search-icon"><SidebarIcon name="search" /></span>
          <input
            autoFocus
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onSearchChange('');
                onSearchOpenChange(false);
              }
            }}
            placeholder={t('搜索会话或目录', 'Search sessions or folders')}
          />
        </label>
      )}
      <nav className="session-list">
        {projectGroups.map((group, groupIndex) => {
          const expanded = Boolean(search.trim()) || !collapsedProjects.has(group.key);
          const groupId = `session-project-${groupIndex}`;
          const projectName = group.name || t('常规会话', 'General sessions');
          return (
            <section className={`session-project-group${expanded ? ' expanded' : ' collapsed'}`} key={group.key}>
              <div className="session-project-head">
                <button
                  type="button"
                  className="session-project-toggle"
                  aria-expanded={expanded}
                  aria-controls={groupId}
                  title={group.cwd || projectName}
                  onClick={() => toggleProject(group.key)}
                >
                  <span className="session-project-chevron"><SidebarIcon name="panel-open" /></span>
                  <span className="session-project-name">{projectName}</span>
                  <span className="session-project-count" aria-label={t(`${group.sessions.length} 个会话`, `${group.sessions.length} sessions`)}>{group.sessions.length}</span>
                </button>
                {group.canStartNewSession && (
                  <button
                    type="button"
                    className="session-project-new"
                    aria-label={t(`在 ${projectName} 中新建会话`, `New session in ${projectName}`)}
                    title={t(`在 ${projectName} 中新建会话`, `New session in ${projectName}`)}
                    onClick={() => onNewSession(group.cwd)}
                  >
                    <SidebarIcon name="plus" />
                  </button>
                )}
              </div>
              {expanded && (
                <div className="session-project-sessions" id={groupId}>
                  {group.sessions.map((session) => {
                    const sessionRunning = isSessionRunning(session.status)
                      || (session.id === selectedThreadId
                        && (executionState === 'running' || executionState === 'waiting'));
                    const completedUnread = !sessionRunning && attention[session.id] === 'unread';
                    return (
                      <button
                        key={session.id}
                        className={`session-card ${selectedThreadId === session.id ? 'active' : ''} ${sessionRunning ? 'running' : ''} ${completedUnread ? 'completed-unread' : ''}`}
                        onClick={() => onSelect(session)}
                      >
                        <span className="session-title" title={session.title || session.id}>{session.title || session.id}</span>
                        <span className="session-meta">
                          {sessionRunning && <span className="session-running-dot" aria-label={t('运行中', 'Running')} title={t('运行中', 'Running')} />}
                          {completedUnread && <span className="session-unread-dot" aria-label={t('已完成，未读', 'Completed, unread')} title={t('已完成，未读', 'Completed, unread')} />}
                          <time>{formatDate(session.updatedAt)}</time>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {!projectGroups.length && <p className="empty-list">{t('没有匹配的会话', 'No matching sessions')}</p>}
      </nav>
    </aside>
  );
});
