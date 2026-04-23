const DAYS = 30;

export function ingCost(ing) {
  if (ing.isLavash) return ing.ppkg;
  if (ing.isPackaging) return ing.ppkg;
  return (ing.grams / 1000) * ing.ppkg;
}

/**
 * @param {object} input
 * @param {number} input.price
 * @param {number} input.items
 * @param {Array} input.ingredients
 * @param {Array} input.employees
 * @param {Array} input.rentItems
 * @param {Array} input.opsItems
 */
export function computePnl({
  price,
  items,
  ingredients,
  employees,
  rentItems,
  opsItems,
  days = DAYS,
}) {
  const dailyRev = price * items;
  const monthRev = dailyRev * days;

  const cogsUnit = ingredients.reduce((s, i) => s + ingCost(i), 0);
  const dailyFood = cogsUnit * items;
  const monthFood = dailyFood * days;

  const monthLabor = employees.reduce((s, e) => s + e.salary, 0);
  const dailyLabor = monthLabor / days;

  const monthRent = rentItems.reduce((s, r) => s + r.monthly, 0);
  const dailyRent = monthRent / days;

  const monthOps = opsItems.reduce(
    (s, op) =>
      op.isBank
        ? s + monthRev * (Number(op.monthly) / 100)
        : s + op.monthly,
    0
  );
  const dailyOps = monthOps / days;

  const dailyCost = dailyFood + dailyLabor + dailyRent + dailyOps;
  const dailyProf = dailyRev - dailyCost;
  const monthProf = dailyProf * days;
  const margin = dailyRev > 0 ? (dailyProf / dailyRev) * 100 : 0;

  const fixedM =
    monthLabor +
    monthRent +
    opsItems.reduce((s, op) => (op.isBank ? s : s + op.monthly), 0);
  const bankRate =
    opsItems
      .filter((o) => o.isBank)
      .reduce((s, o) => s + Number(o.monthly), 0) / 100;
  const varUnit = cogsUnit + price * bankRate;
  const contrib = price - varUnit;
  const be = contrib > 0 ? Math.ceil(fixedM / days / contrib) : "∞";

  const fp = dailyRev > 0 ? (dailyFood / dailyRev) * 100 : 0;
  const lp = dailyRev > 0 ? (dailyLabor / dailyRev) * 100 : 0;
  const rp = dailyRev > 0 ? (dailyRent / dailyRev) * 100 : 0;
  const op = dailyRev > 0 ? (dailyOps / dailyRev) * 100 : 0;

  const tot =
    dailyFood + dailyLabor + dailyRent + dailyOps + Math.max(dailyProf, 0);
  const pctOfTot = (v) => (tot > 0 ? (v / tot) * 100 : 0);

  return {
    days,
    dailyRev,
    monthRev,
    cogsUnit,
    monthFood,
    monthLabor,
    monthRent,
    monthOps,
    dailyProf,
    monthProf,
    margin,
    foodPct: fp,
    laborRevPct: lp,
    rentRevPct: rp,
    opsRevPct: op,
    breakEven: be,
    donut: [
      pctOfTot(dailyFood),
      pctOfTot(dailyLabor),
      pctOfTot(dailyRent),
      pctOfTot(dailyOps),
      pctOfTot(Math.max(dailyProf, 0)),
    ],
  };
}

export { DAYS };
