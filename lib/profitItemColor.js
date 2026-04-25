/**
 * Profit / item (UAH) — three flat theme colors:
 *  - &lt; 20: red
 *  - 20–30: warm “yellow” (theme accent)
 *  - ≥ 30: system green
 */
export function getProfitPerItemTextColor(uaPerItem) {
  if (uaPerItem == null || Number.isNaN(Number(uaPerItem))) {
    return "var(--muted)";
  }
  const p = Number(uaPerItem);
  if (p < 20) return "var(--red-l)";
  if (p < 30) return "var(--accent)";
  return "var(--grn-l)";
}
