export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return value.toLocaleString("id-ID");
}
