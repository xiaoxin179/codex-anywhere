export const MAX_PENDING_QUOTES = 5;
export const MAX_QUOTE_LENGTH = 4_000;
export const MAX_QUOTE_COMMENT_LENGTH = 1_200;

export type MessageQuote = {
  sourceMessageId: string;
  text: string;
  comment?: string;
};

export function normalizeMessageQuote(quote: MessageQuote): MessageQuote | null {
  const sourceMessageId = quote.sourceMessageId.trim();
  const text = quote.text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_QUOTE_LENGTH).trim();
  const comment = (quote.comment || '').replace(/\r\n?/g, '\n').slice(0, MAX_QUOTE_COMMENT_LENGTH);
  return sourceMessageId && text ? { sourceMessageId, text, comment } : null;
}

export function appendMessageQuote(current: MessageQuote[], quote: MessageQuote) {
  const normalized = normalizeMessageQuote(quote);
  if (!normalized) return current;
  if (current.some((item) => item.sourceMessageId === normalized.sourceMessageId && item.text === normalized.text)) {
    return current;
  }
  return [...current, normalized].slice(-MAX_PENDING_QUOTES);
}

function markdownQuote(text: string) {
  return text.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n');
}

function quoteComment(comment: string) {
  return comment.trim() ? `评论：${comment.trim()}` : '';
}

export function buildQuotedPrompt(prompt: string, quotes: MessageQuote[]) {
  const normalizedQuotes = quotes
    .map(normalizeMessageQuote)
    .filter((quote): quote is MessageQuote => Boolean(quote));
  const parts = normalizedQuotes.flatMap((quote) => [
    markdownQuote(quote.text),
    quoteComment(quote.comment || ''),
  ].filter(Boolean));
  const question = prompt.trim();
  if (question) parts.push(question);
  return parts.join('\n\n');
}
