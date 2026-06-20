export type CompareAccountIds = [string | null, string | null, string | null];

export const ANALYTICS_COMPARE_ACCOUNTS_COOKIE =
  "analytics_compare_account_ids";
export const ANALYTICS_COMPARE_ACCOUNTS_MAX_AGE = 60 * 60 * 24 * 180;

function normalizeCompareAccountId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function encodeCompareAccountIds(accountIds: CompareAccountIds) {
  return encodeURIComponent(JSON.stringify(accountIds));
}

export function decodeCompareAccountIds(
  value: string | undefined,
): CompareAccountIds {
  if (!value) return [null, null, null];

  try {
    const decodedValue = value.trim().startsWith("[")
      ? value
      : decodeURIComponent(value);
    const parsed = JSON.parse(decodedValue);

    if (!Array.isArray(parsed)) return [null, null, null];

    return [
      normalizeCompareAccountId(parsed[0]),
      normalizeCompareAccountId(parsed[1]),
      normalizeCompareAccountId(parsed[2]),
    ];
  } catch {
    return [null, null, null];
  }
}
