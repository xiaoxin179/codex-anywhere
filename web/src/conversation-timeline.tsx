import {
  lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject, type UIEventHandler,
} from 'react';
import {
  resolveTimelineAttachment,
  type KnownAttachment,
  type TimelineItem,
} from './history-utils';
import { t } from './i18n';
import type { TextPreviewDocument, TurnDiffDocument } from './app-types';
import type { QuestionReply } from '../../src/shared/async-questions';
import { AsyncQuestionCard } from './async-question-card';
import { normalizeMessageQuote, type MessageQuote } from './message-quotes';
import { buildSelectionSearchUrl, buildSelectionTranslateUrl } from './selection-actions';

const MessageBubble = lazy(() => import('./message-bubble').then((module) => ({
  default: module.MessageBubble,
})));

export function preloadMessageBubble() {
  // A failed speculative load must not block connecting or fetching history.
  void import('./message-bubble').catch(() => undefined);
}

type ConversationTimelineProps = {
  questionReplyDisabled?: boolean;
  onQuestionReply?: (replies: QuestionReply[]) => Promise<boolean>;
  messageListRef: RefObject<HTMLDivElement | null>;
  messageContentRef: RefObject<HTMLDivElement | null>;
  threadId: string | null;
  environmentId: string;
  creatingNewSession: boolean;
  initialHistoryLoaded: boolean;
  nextCursor: string | null;
  historyLoading: boolean;
  olderHistoryError: boolean;
  olderHistoryAutoLoadEnabled: boolean;
  timeline: TimelineItem[];
  knownAttachments: Record<string, KnownAttachment>;
  attachmentUrls: Record<string, string>;
  executionActive: boolean;
  progressAnimationReady: boolean;
  liveProgressItemId: string | null;
  onScroll: UIEventHandler<HTMLDivElement>;
  onLoadOlder: () => void;
  onDownloadFile: (path: string) => void;
  onReadTextFile: (path: string) => Promise<TextPreviewDocument>;
  onReadTurnDiff: (turnId: string) => Promise<TurnDiffDocument>;
  onReadVisualization: (path: string) => Promise<string>;
  onReadPreviewImage: (path: string) => Promise<string>;
  onQuoteAssistantText?: (quote: MessageQuote) => void;
};

type QuoteSelection = MessageQuote & { top: number; left: number };

async function copySelectionText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('copy failed');
}

export const ConversationTimeline = memo(function ConversationTimeline({
  questionReplyDisabled = true,
  onQuestionReply,
  messageListRef,
  messageContentRef,
  threadId,
  environmentId,
  creatingNewSession,
  initialHistoryLoaded,
  nextCursor,
  historyLoading,
  olderHistoryError,
  olderHistoryAutoLoadEnabled,
  timeline,
  knownAttachments,
  attachmentUrls,
  executionActive,
  progressAnimationReady,
  liveProgressItemId,
  onScroll,
  onLoadOlder,
  onDownloadFile,
  onReadTextFile,
  onReadTurnDiff,
  onReadVisualization,
  onReadPreviewImage,
  onQuoteAssistantText,
}: ConversationTimelineProps) {
  const olderHistorySentinelRef = useRef<HTMLButtonElement | null>(null);
  const [quoteSelection, setQuoteSelection] = useState<QuoteSelection | null>(null);
  const [selectionCopyState, setSelectionCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const questionAnswers = useMemo(() => new Map(timeline.flatMap((item) => (
    item.kind === 'user' && (!item.transient || item.completedAt)
      ? (item.questionReplies || []).map((reply) => [reply.questionItemId, reply.answer] as const) : []
  ))), [timeline]);
  const resolvedItems = useMemo(() => timeline.map((item) => {
    const attachment = resolveTimelineAttachment(item, threadId, knownAttachments, environmentId);
    return {
      attachment,
      item: attachment && !item.attachment ? { ...item, attachment } : item,
    };
  }), [environmentId, knownAttachments, threadId, timeline]);
  const awaitingVisibleHistory = Boolean(
    threadId && !timeline.length && historyLoading,
  );
  const readQuoteSelection = useCallback(() => {
    if (!onQuoteAssistantText || typeof window === 'undefined') {
      setQuoteSelection(null);
      return;
    }
    const selection = window.getSelection();
    const root = messageContentRef.current;
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1 || !root) {
      setQuoteSelection(null);
      return;
    }
    const elementForNode = (node: Node | null) => (
      node instanceof Element ? node : node?.parentElement
    );
    const startMessage = elementForNode(selection.anchorNode)?.closest<HTMLElement>('.message.assistant[data-quote-message-id]');
    const endMessage = elementForNode(selection.focusNode)?.closest<HTMLElement>('.message.assistant[data-quote-message-id]');
    if (!startMessage || startMessage !== endMessage || !root.contains(startMessage)) {
      setQuoteSelection(null);
      return;
    }
    const quote = normalizeMessageQuote({
      sourceMessageId: startMessage.dataset.quoteMessageId || '',
      text: selection.toString(),
    });
    if (!quote) {
      setQuoteSelection(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      setQuoteSelection(null);
      return;
    }
    const toolbarHalfWidth = Math.min(280, Math.max(0, (window.innerWidth - 16) / 2));
    const rangeCenter = rect.left + rect.width / 2;
    const spaceBelow = window.innerHeight - rect.bottom;
    setSelectionCopyState('idle');
    setQuoteSelection({
      ...quote,
      top: spaceBelow >= 54 ? rect.bottom + 10 : Math.max(8, rect.top - 46),
      left: Math.min(window.innerWidth - toolbarHalfWidth - 8, Math.max(toolbarHalfWidth + 8, rangeCenter)),
    });
  }, [messageContentRef, onQuoteAssistantText]);

  useEffect(() => {
    if (!onQuoteAssistantText) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const selectionChanged = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(readQuoteSelection, 80);
    };
    const hide = () => setQuoteSelection(null);
    document.addEventListener('selectionchange', selectionChanged);
    window.addEventListener('resize', hide);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('selectionchange', selectionChanged);
      window.removeEventListener('resize', hide);
    };
  }, [onQuoteAssistantText, readQuoteSelection]);

  useEffect(() => setQuoteSelection(null), [threadId]);
  const selectWholeAssistantMessage = useCallback(() => {
    if (!quoteSelection) return;
    const message = Array.from(messageContentRef.current?.querySelectorAll<HTMLElement>(
      '.message.assistant[data-quote-message-id]',
    ) || []).find((candidate) => candidate.dataset.quoteMessageId === quoteSelection.sourceMessageId);
    if (!message) return;
    const range = document.createRange();
    range.selectNodeContents(message);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    setTimeout(readQuoteSelection, 0);
  }, [messageContentRef, quoteSelection, readQuoteSelection]);

  const openSelectionAction = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);
  useEffect(() => {
    const root = messageListRef.current;
    const sentinel = olderHistorySentinelRef.current;
    if (!root || !sentinel || !threadId || !initialHistoryLoaded || !nextCursor
      || !olderHistoryAutoLoadEnabled
      || historyLoading || olderHistoryError || typeof IntersectionObserver === 'undefined') return undefined;
    let requested = false;
    const observer = new IntersectionObserver((entries) => {
      if (!requested && entries.some((entry) => entry.isIntersecting)) {
        requested = true;
        onLoadOlder();
      }
    }, { root, rootMargin: '160px 0px 0px', threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    historyLoading, initialHistoryLoaded, messageListRef, nextCursor, olderHistoryAutoLoadEnabled,
    olderHistoryError, onLoadOlder, threadId,
  ]);

  return (
    <div className="message-list" ref={messageListRef} onScroll={(event) => {
      setQuoteSelection(null);
      onScroll(event);
    }} onPointerUp={() => setTimeout(readQuoteSelection, 0)} onKeyUp={readQuoteSelection}>
      <div className="message-list-content" ref={messageContentRef}>
        {threadId && initialHistoryLoaded && nextCursor && (
          <button
            ref={olderHistorySentinelRef}
            className={`load-older${historyLoading ? ' loading' : ''}${olderHistoryError ? ' failed' : ''}`}
            disabled={historyLoading}
            aria-busy={historyLoading}
            aria-live="polite"
            onClick={onLoadOlder}
          >
            {historyLoading && <span className="load-older-spinner" aria-hidden="true" />}
            <span>{historyLoading
              ? t('正在加载更早记录…', 'Loading older messages…')
              : olderHistoryError
                ? t('加载失败，点击重试', 'Loading failed. Tap to retry')
                : t('加载更早记录', 'Load older messages')}</span>
          </button>
        )}
        {awaitingVisibleHistory && (
          <div className="history-skeleton">{t('正在加载最近记录…', 'Loading recent messages…')}</div>
        )}
        {!timeline.length && !awaitingVisibleHistory && (
          <div className="empty-conversation">
            <div className="brand-mark small">C</div>
            <h2>{threadId
              ? t('这个分页暂无消息', 'No messages on this page')
              : creatingNewSession
                ? t('创建一个新会话', 'Create a new session')
                : t('选择已有会话', 'Choose an existing session')}</h2>
            <p>{threadId
              ? nextCursor
                ? t('这段记录没有可展示的消息，可点击上方按钮继续加载更早记录。', 'This range has no displayable messages. Use the button above to load earlier records.')
                : t('当前会话尚无可展示的消息。', 'This session has no displayable messages yet.')
              : creatingNewSession
                ? t('选择本机项目目录后，第一条消息将在该目录中运行。', 'Choose a local project directory; the first message will run there.')
                : t('打开左上角菜单选择会话；新会话入口也已移入菜单。', 'Open the top-left menu to choose a session or start a new one.')}</p>
          </div>
        )}
        <Suspense fallback={<div className="conversation-render-placeholder" aria-hidden="true" />}>
          {resolvedItems.map(({ item, attachment }) => item.questions ? (
            <AsyncQuestionCard
              key={`${environmentId}:${threadId}:${item.questions.map((question) => question.id).join(':')}`}
              questions={item.questions} answers={questionAnswers}
              disabled={questionReplyDisabled} onReply={onQuestionReply}
            />
          ) : (
            <MessageBubble
              key={item.id}
              item={item}
              active={executionActive && (item.kind === 'progress'
                ? progressAnimationReady && item.id === liveProgressItemId
                : Boolean(item.transient))}
              imageSource={attachment ? attachmentUrls[attachment.path] : undefined}
              onDownloadFile={onDownloadFile}
              onReadTextFile={onReadTextFile}
              onReadTurnDiff={onReadTurnDiff}
              onReadVisualization={onReadVisualization}
              onReadPreviewImage={onReadPreviewImage}
            />
          ))}
        </Suspense>
      </div>
      {quoteSelection && (
        <div
          className="selection-action-toolbar"
          style={{ top: quoteSelection.top, left: quoteSelection.left }}
          onPointerDown={(event) => event.preventDefault()}
          role="toolbar"
          aria-label={t('所选文字操作', 'Selected text actions')}
        >
          <button type="button" onClick={() => void copySelectionText(quoteSelection.text)
            .then(() => setSelectionCopyState('copied'))
            .catch(() => setSelectionCopyState('failed'))}>
            {selectionCopyState === 'copied'
              ? t('已复制', 'Copied')
              : selectionCopyState === 'failed'
                ? t('复制失败', 'Copy failed')
                : t('复制', 'Copy')}
          </button>
          {typeof navigator.share === 'function' && (
            <button type="button" onClick={() => void navigator.share({ text: quoteSelection.text }).catch(() => undefined)}>
              {t('分享', 'Share')}
            </button>
          )}
          <button type="button" onClick={selectWholeAssistantMessage}>{t('全选回复', 'Select reply')}</button>
          <button type="button" onClick={() => openSelectionAction(buildSelectionSearchUrl(quoteSelection.text))}>
            {t('网页搜索', 'Web search')}
          </button>
          <button type="button" onClick={() => openSelectionAction(buildSelectionTranslateUrl(
            quoteSelection.text,
            t('zh-CN', 'en'),
          ))}>
            {t('翻译', 'Translate')}
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => {
              onQuoteAssistantText?.({
                sourceMessageId: quoteSelection.sourceMessageId,
                text: quoteSelection.text,
              });
              window.getSelection()?.removeAllRanges();
              setQuoteSelection(null);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h4v4H7v5H5v-7a4 4 0 0 1 4-4h2M15 8h4v4h-4v5h-2v-7a4 4 0 0 1 4-4h2" /></svg>
            {t('引用提问', 'Quote')}
          </button>
        </div>
      )}
    </div>
  );
});
