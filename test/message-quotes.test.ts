import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  appendMessageQuote,
  buildQuotedPrompt,
  MAX_PENDING_QUOTES,
  normalizeMessageQuote,
} from '../web/src/message-quotes.js';
import { MessageBubble } from '../web/src/message-bubble.js';

test('selected assistant text becomes a bounded Markdown quote followed by the question', () => {
  assert.equal(buildQuotedPrompt('为什么这样设计？', [
    { sourceMessageId: 'assistant-1', text: '第一行\r\n第二行' },
  ]), '> 第一行\n> 第二行\n\n为什么这样设计？');
  assert.equal(normalizeMessageQuote({ sourceMessageId: '', text: '内容' }), null);
});

test('pending message quotes deduplicate and remain bounded', () => {
  let quotes = [{ sourceMessageId: 'same', text: '相同内容' }];
  quotes = appendMessageQuote(quotes, { sourceMessageId: 'same', text: '相同内容' });
  assert.equal(quotes.length, 1);
  for (let index = 0; index < MAX_PENDING_QUOTES + 2; index += 1) {
    quotes = appendMessageQuote(quotes, { sourceMessageId: `assistant-${index}`, text: `引用 ${index}` });
  }
  assert.equal(quotes.length, MAX_PENDING_QUOTES);
  assert.equal(quotes.at(-1)?.text, `引用 ${MAX_PENDING_QUOTES + 1}`);
});

test('only assistant message bodies expose a selection quote source', () => {
  const render = (kind: 'assistant' | 'user') => renderToStaticMarkup(createElement(MessageBubble, {
    item: { id: `${kind}-message`, kind, text: '可选择的内容' },
    onDownloadFile: () => undefined,
    onReadVisualization: async () => '',
  }));
  assert.match(render('assistant'), /data-quote-message-id="assistant-message"/);
  assert.doesNotMatch(render('user'), /data-quote-message-id/);
});
