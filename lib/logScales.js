// Slider internal range: 0–1000. Log-uniform map: val = min * (max/min)^(t/1000)
// (equal t-steps → equal multiplicative steps; "linear" in log(val)).
//
// items: the working band 10–150 items/day covers ~4/5 of the track; the top of the
// range is a log tail for higher volume. Widen/tighten max to trade focus vs. headroom.
export const LOG_SCALES = {
  // Log; ~50–220 g uses most of the track; tails for very low / high. Type any g in the field.
  grams: [40, 300],
  ppkg: [20, 2000],
  salary: [5000, 150000],
  rent: [3000, 200000],
  ops: [500, 150000],
  price: [50, 2000],
  items: [10, 320],
};

/** Banking fee: linear 0%–10% of monthly revenue; slider still uses 0–1000 internally. */
const BANK_PCT = [0, 10];
export function bankToSlider(pct) {
  const [mn, mx] = BANK_PCT;
  pct = Math.max(mn, Math.min(mx, Number(pct) || 0));
  return Math.round(((pct - mn) / (mx - mn)) * 1000);
}

export function bankFromSlider(t) {
  const [mn, mx] = BANK_PCT;
  t = Math.max(0, Math.min(1000, +t));
  return Math.round((mn + (t / 1000) * (mx - mn)) * 10) / 10;
}

export function toSlider(scale, val) {
  const [mn, mx] = LOG_SCALES[scale];
  if (val <= mn) return 0;
  if (val >= mx) return 1000;
  return Math.round((Math.log(val / mn) / Math.log(mx / mn)) * 1000);
}

export function fromSlider(scale, t) {
  const [mn, mx] = LOG_SCALES[scale];
  t = Math.max(0, Math.min(1000, t));
  if (t === 0) return mn;
  if (t === 1000) return mx;
  return Math.round(mn * Math.pow(mx / mn, t / 1000));
}

export function updateSliderFillStyle(t) {
  return { "--fill": `${t / 10}%` };
}
