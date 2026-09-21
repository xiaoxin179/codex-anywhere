const MAX_EXTERNAL_SELECTION_LENGTH = 1_200;

function boundedSelectionText(text: string) {
  return text.trim().slice(0, MAX_EXTERNAL_SELECTION_LENGTH).trim();
}

export function buildSelectionSearchUrl(text: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(boundedSelectionText(text))}`;
}

export function buildSelectionTranslateUrl(text: string, targetLanguage: string) {
  const safeTargetLanguage = targetLanguage === 'en' ? 'en' : 'zh-CN';
  const params = new URLSearchParams({
    sl: 'auto',
    tl: safeTargetLanguage,
    text: boundedSelectionText(text),
    op: 'translate',
  });
  return `https://translate.google.com/?${params.toString()}`;
}
