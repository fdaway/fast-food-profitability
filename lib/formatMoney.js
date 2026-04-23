/** Locale fixed so SSR and browser produce identical number strings (avoids hydration mismatch). */
const LOCALE = "en-US";

export function formatIntLocaleStable(n) {
  return Math.round(Number(n)).toLocaleString(LOCALE);
}
