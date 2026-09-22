export type AccountRateLimit = {
  usedPercent: number;
  windowMinutes: number;
  resetsAt?: number | null;
};

export type AccountUsage = {
  limits: AccountRateLimit[];
  updatedAt?: number | null;
};

export function newestAccountUsage(
  current: AccountUsage | null | undefined,
  candidate: AccountUsage | null | undefined,
): AccountUsage | undefined {
  if (!candidate) return current || undefined;
  if (!current) return candidate;
  const currentUpdatedAt = finiteTimestamp(current.updatedAt);
  const candidateUpdatedAt = finiteTimestamp(candidate.updatedAt);
  if (candidateUpdatedAt === undefined) return currentUpdatedAt === undefined ? candidate : current;
  if (currentUpdatedAt === undefined || candidateUpdatedAt >= currentUpdatedAt) return candidate;
  return current;
}

export function normalizeAccountUsage(value: unknown): AccountUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<AccountUsage>;
  if (!Array.isArray(candidate.limits)) return undefined;
  const limits = candidate.limits.slice(0, 4).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const limit = entry as Partial<AccountRateLimit>;
    const usedPercent = boundedPercent(limit.usedPercent);
    const windowMinutes = positiveInteger(limit.windowMinutes);
    if (usedPercent === undefined || !windowMinutes) return [];
    const resetsAt = finiteTimestamp(limit.resetsAt);
    return [{
      usedPercent,
      windowMinutes,
      ...(resetsAt !== undefined ? { resetsAt } : {}),
    }];
  });
  if (!limits.length) return undefined;
  const updatedAt = finiteTimestamp(candidate.updatedAt);
  return { limits, ...(updatedAt !== undefined ? { updatedAt } : {}) };
}

function boundedPercent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : undefined;
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function finiteTimestamp(value: unknown) {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
