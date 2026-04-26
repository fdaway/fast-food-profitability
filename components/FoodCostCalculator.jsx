"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { formatIntLocaleStable } from "@/lib/formatMoney";
import { computePnl, ingCost, DAYS } from "@/lib/computePnl";
import {
  bankFromSlider,
  bankToSlider,
  fromSlider,
  toSlider,
  toSliderRange,
  fromSliderRange,
  updateSliderFillStyle,
  LOG_SCALES,
} from "@/lib/logScales";
import { getProfitPerItemTextColor } from "@/lib/profitItemColor";

const CostDonut = dynamic(() => import("@/components/CostDonut"), {
  ssr: false,
});

const UAH_USD = 0.024;

/** Applied to P&L selling price when combo sections are toggled on/off */
const COMBO_FRIES_ADD_UAH = 75;
const COMBO_DRINK_ADD_UAH = 35;
const PNL_PRICE_MIN_UAH = 120;
const PNL_PRICE_MAX_UAH = 620;

function clampPnlSellingPrice(n) {
  const v = Math.round(Number(n) || 0);
  return Math.max(PNL_PRICE_MIN_UAH, Math.min(PNL_PRICE_MAX_UAH, v));
}

const INGREDIENT_SECTION_LABELS = {
  burger: "Burger",
  fries: "Fries",
  drinks: "Drinks",
};

function getIngredientSection(ing) {
  return ing.section || "burger";
}

function isIngIncludedInPnl(ing, includeFries, includeDrinks) {
  const s = getIngredientSection(ing);
  if (s === "fries" && !includeFries) return false;
  if (s === "drinks" && !includeDrinks) return false;
  return true;
}

const DEFAULT_INGREDIENTS = [
  { id: "meat", name: "Meat", grams: 190, ppkg: 420, isLavash: false, section: "burger" },
  { id: "lavash", name: "Briosh", grams: 75, ppkg: 20, isLavash: true, section: "burger" },
  { id: "cheese", name: "American cheese", grams: 40, ppkg: 580, isLavash: false, section: "burger" },
  {
    id: "onion",
    name: "Onions",
    grams: 20,
    ppkg: 80,
    isLavash: false,
    gramsRange: [1, 100],
    section: "burger",
  },
  { id: "greens", name: "Iceberg Lettuce", grams: 35, ppkg: 200, isLavash: false, section: "burger" },
  { id: "sauce", name: "Sauce", grams: 40, ppkg: 247, isLavash: false, section: "burger" },
  {
    id: "packaging",
    name: "Packaging",
    grams: 0,
    ppkg: 3,
    isLavash: false,
    isPackaging: true,
    section: "burger",
  },
  { id: "potato", name: "Potatoes", grams: 140, ppkg: 200, isLavash: false, section: "fries" },
  {
    id: "ayran",
    name: "Ayran / Uzvar / Lemonade",
    grams: 200,
    ppkg: 16,
    isLavash: true,
    section: "drinks",
  },
];

const DEFAULT_EMPLOYEES = [
  { id: "owner", name: "Owner", salary: 10000 },
  { id: "w1", name: "Worker", salary: 40000 },
];

const DEFAULT_RENT = [{ id: "r1", name: "Property", monthly: 20000 }];

const DEFAULT_OPS = [
  { id: "util", name: "Utilities", monthly: 6000, isBank: false },
  { id: "elec", name: "Electricity", monthly: 17000, isBank: false },
  { id: "mkt", name: "Marketing", monthly: 3000, isBank: false },
  { id: "cln", name: "Cleaning", monthly: 3000, isBank: false },
  { id: "bank", name: "Banking", monthly: 2, isBank: true },
  { id: "car", name: "Car / Gas", monthly: 4900, isBank: false },
  { id: "unex", name: "Unexpected", monthly: 12000, isBank: false },
];

/** Fries + drinks (potatoes, drinks) are off by default; user enables via row toggles */
const DEFAULT_INCLUDE_FRIES = false;
const DEFAULT_INCLUDE_DRINKS = false;

/** Food cost % of revenue: green 28%–55%, red outside that band (too low or too high) */
function foodCostInTargetBand(fp) {
  return fp >= 28 && fp <= 55;
}
function foodCostPctClass(fp) {
  return foodCostInTargetBand(fp) ? "good" : "high";
}
function foodCostBarFillHex(fp) {
  return foodCostInTargetBand(fp) ? "#16a34a" : "#ef4444";
}
function foodCostBarPctColor(fp) {
  return foodCostInTargetBand(fp) ? "var(--grn-l)" : "var(--red-l)";
}
function foodCostKpiClass(fp) {
  return foodCostInTargetBand(fp) ? "pos" : "neg";
}

const cc = (v) => (v < 0 ? "neg" : v < 5 ? "neu" : "pos");

const marginStatus = (m) => {
  if (m < 0) return "⚠ Loss";
  if (m < 5) return "⚡ Razor thin";
  if (m < 10) return "✓ Average";
  if (m < 20) return "✓ Healthy";
  return "★ Excellent";
};

export default function FoodCostCalculator() {
  const [currency, setCurrency] = useState("UAH");
  const [price, setPrice] = useState(300);
  const [items, setItems] = useState(30);
  const [ingredients, setIngredients] = useState(DEFAULT_INGREDIENTS);
  const [includeFries, setIncludeFries] = useState(DEFAULT_INCLUDE_FRIES);
  const [includeDrinks, setIncludeDrinks] = useState(DEFAULT_INCLUDE_DRINKS);
  const [ingOpenState, setIngOpenState] = useState(() => {
    const meatIdx = DEFAULT_INGREDIENTS.findIndex((g) => g.id === "meat");
    return meatIdx >= 0 ? { [meatIdx]: true } : {};
  });
  const [employees, setEmployees] = useState(DEFAULT_EMPLOYEES);
  const [rentItems, setRentItems] = useState(DEFAULT_RENT);
  const [opsItems, setOpsItems] = useState(DEFAULT_OPS);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const ingredientsForPnl = useMemo(
    () =>
      ingredients.filter((ing) =>
        isIngIncludedInPnl(ing, includeFries, includeDrinks)
      ),
    [ingredients, includeFries, includeDrinks]
  );

  /** P&L “Price” = per-item selling price; toggles nudge it by ±fries/±drinks UAH. */
  const pnl = useMemo(
    () =>
      computePnl({
        price,
        items,
        ingredients: ingredientsForPnl,
        employees,
        rentItems,
        opsItems,
        days: DAYS,
      }),
    [price, items, ingredientsForPnl, employees, rentItems, opsItems]
  );

  const {
    dailyRev,
    cogsUnit,
    margin,
    foodPct: fp,
    laborRevPct: lp,
    rentRevPct: rp,
    opsRevPct: opPct,
    breakEven: be,
  } = pnl;
  const dailyProf = pnl.dailyProf;
  const monthProf = pnl.monthProf;
  const profitPerItem = pnl.profitPerItem;
  const monthLabor = pnl.monthLabor;
  const monthRent = pnl.monthRent;
  const monthOps = pnl.monthOps;
  const monthRev = pnl.monthRev;

  const fmt = (v) =>
    currency === "USD"
      ? "$" + (v * UAH_USD).toFixed(0)
      : "₴" + formatIntLocaleStable(v);
  const fmtPerItem = (v) =>
    currency === "USD"
      ? "$" + (v * UAH_USD).toFixed(2)
      : "₴" + v.toFixed(2);
  const fUAH = (v) => "₴" + formatIntLocaleStable(v);
  const fUSD = (v) => "$" + (v * UAH_USD).toFixed(0);

  const priceT = toSlider("price", price);
  const itemsT = toSlider("items", items);

  const totalProductWeightG = useMemo(
    () =>
      ingredientsForPnl.reduce(
        (s, i) => s + (Number(i.grams) || 0),
        0
      ),
    [ingredientsForPnl]
  );

  const onMainSlider = (key, t) => {
    const real = fromSlider(key === "price" ? "price" : "items", +t);
    if (key === "price") setPrice(clampPnlSellingPrice(real));
    else setItems(real);
  };

  const onMainInput = (key, val) => {
    const v = +val || 0;
    if (key === "price") setPrice(clampPnlSellingPrice(v));
    else setItems(v);
  };

  const patchIngredient = (idx, next) => {
    setIngredients((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
  };

  const ingGramsSl = (idx, t) => {
    setIngredients((prev) => {
      const range = prev[idx]?.gramsRange ?? LOG_SCALES.grams;
      const v = fromSliderRange(+t, range);
      const n = [...prev];
      n[idx] = { ...n[idx], grams: v };
      return n;
    });
  };
  const ingPpkgSl = (idx, t) => {
    const v = fromSlider("ppkg", +t);
    patchIngredient(idx, { ppkg: v });
  };

  const toggleIng = (idx) => {
    setIngOpenState((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const removeIngredient = (idx) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    setIngOpenState((prev) => {
      const n = {};
      Object.keys(prev).forEach((k) => {
        const ki = +k;
        if (ki < idx) n[ki] = prev[ki];
        else if (ki > idx) n[ki - 1] = prev[ki];
      });
      return n;
    });
  };

  const addIngredient = () => {
    const newIdx = ingredients.length;
    setIngredients((prev) => [
      ...prev,
      {
        id: "i" + Date.now(),
        name: "New Item",
        grams: 50,
        ppkg: 100,
        isLavash: false,
        isPackaging: false,
        section: "burger",
      },
    ]);
    setIngOpenState((prev) => ({ ...prev, [newIdx]: true }));
  };

  const empSl = (idx, t) => {
    const v = fromSlider("salary", +t);
    setEmployees((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], salary: v };
      return n;
    });
  };
  const rentSl = (idx, t) => {
    const v = fromSlider("rent", +t);
    setRentItems((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], monthly: v };
      return n;
    });
  };
  const opsSl = (idx, t) => {
    setOpsItems((prev) => {
      const n = [...prev];
      if (prev[idx].isBank) {
        n[idx] = { ...n[idx], monthly: bankFromSlider(+t) };
        return n;
      }
      const v = fromSlider("ops", +t);
      n[idx] = { ...n[idx], monthly: v };
      return n;
    });
  };

  const setBarW = (pct) => `${Math.min(Math.max(pct, 0), 100)}%`;

  const meterW =
    ((Math.min(Math.max(margin, -5), 30) + 5) / 35) * 100;
  const meterBg =
    margin < 0 ? "var(--red-l)" : margin < 8 ? "var(--accent)" : "var(--grn-l)";

  const spctClass = foodCostPctClass(fp);

  return (
    <>
      <header>
        <div className="hdr-brand">
          <div className="hdr-titles">
            <div className="hdr-name">
              Margin <em>/</em> Profit <em>/</em> Food Cost <em>/</em> Upsells{" "}
              <em>/</em> Projections{" "}
              <span className="hdr-name-cal">Calculator</span>
            </div>
          </div>
        </div>
        <div className="hdr-right">
          <span className="hdr-currency">Currency</span>
          <button
            type="button"
            className={"cur-btn" + (currency === "UAH" ? " active" : "")}
            onClick={() => setCurrency("UAH")}
          >
            UAH
          </button>
          <button
            type="button"
            className={"cur-btn" + (currency === "USD" ? " active" : "")}
            onClick={() => setCurrency("USD")}
          >
            USD
          </button>
        </div>
      </header>

      <div className="app">
        <div className="panel" style={{ gridColumn: 1, gridRow: 1 }}>
          <div className="ptitle">🥩 Food cost</div>
          <div className="sh">
            <span className="sl">Ingredients</span>
            <span className={"spct " + spctClass}>{fp.toFixed(1)}%</span>
          </div>
          <div className="ing-list">
            {ingredients.map((ing, idx) => {
              const lineCost = ingCost(ing);
              const inPl = ingredientsForPnl.some((x) => x === ing);
              const pct =
                cogsUnit > 0 && inPl
                  ? (lineCost / cogsUnit) * 100
                  : 0;
              const open = !!ingOpenState[idx];
              const gramsRange = ing.gramsRange ?? LOG_SCALES.grams;
              const gt = toSliderRange(ing.grams, gramsRange);
              const pt = toSlider("ppkg", ing.ppkg);
              const sec = getIngredientSection(ing);
              const prevSec =
                idx > 0 ? getIngredientSection(ingredients[idx - 1]) : null;
              const showSectionHead = sec !== prevSec && sec === "burger";
              const isFirstFries = sec === "fries" && prevSec !== "fries";
              const isFirstDrinks = sec === "drinks" && prevSec !== "drinks";
              const sectionTitle =
                INGREDIENT_SECTION_LABELS[sec] || String(sec);

              return (
                <Fragment key={ing.id}>
                  {showSectionHead ? (
                    <div className="ing-section-hd" role="presentation">
                      {sectionTitle}
                    </div>
                  ) : null}
                <div
                  className={
                    "ing-row" +
                    (open ? " open" : "") +
                    (inPl ? "" : " ing-row--pnl-off") +
                    (sec !== prevSec && (sec === "fries" || sec === "drinks")
                      ? " ing-row--section-gap"
                      : "")
                  }
                >
                  <div
                    className="ing-hdr"
                    onClick={() => toggleIng(idx)}
                    onKeyDown={(e) => {
                      if (
                        e.target?.closest?.(
                          "input, textarea, select, [contenteditable=true], .ing-sw, label.ing-sw"
                        )
                      ) {
                        return;
                      }
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleIng(idx);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ing-hdr-nm">
                      <div className="ing-hdr-nm-l">
                        {open ? (
                          <div
                            className="ing-nm-clip"
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <input
                              type="text"
                              className="ing-nm ing-nm--hdr"
                              value={ing.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                patchIngredient(idx, { name: e.target.value })
                              }
                              aria-label="Ingredient name"
                              style={{
                                width: `${Math.min(
                                  32,
                                  Math.max(4, (ing.name || "").length + 1.25)
                                )}ch`,
                                maxWidth: "100%",
                              }}
                            />
                          </div>
                        ) : (
                          <span className="ing-nm ing-nm-clip">{ing.name}</span>
                        )}
                        {isFirstFries ? (
                          <span
                            className="ing-hdr-selladd"
                            title="Added to PnL selling price when this section is included"
                          >
                            +₴{COMBO_FRIES_ADD_UAH}
                          </span>
                        ) : null}
                        {isFirstDrinks ? (
                          <span
                            className="ing-hdr-selladd"
                            title="Added to PnL selling price when this section is included"
                          >
                            +₴{COMBO_DRINK_ADD_UAH}
                          </span>
                        ) : null}
                      </div>
                      {sec === "fries" ? (
                        <label
                          className="ing-sw"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="ing-sw-input"
                            role="switch"
                            checked={includeFries}
                            onChange={(e) => {
                              e.stopPropagation();
                              const c = e.target.checked;
                              if (c === includeFries) return;
                              setPrice((p) =>
                                clampPnlSellingPrice(
                                  p + (c ? COMBO_FRIES_ADD_UAH : -COMBO_FRIES_ADD_UAH)
                                )
                              );
                              setIncludeFries(c);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Include fries in product cost"
                          />
                          <span className="ing-sw-track" aria-hidden="true" />
                        </label>
                      ) : null}
                      {sec === "drinks" ? (
                        <label
                          className="ing-sw"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="ing-sw-input"
                            role="switch"
                            checked={includeDrinks}
                            onChange={(e) => {
                              e.stopPropagation();
                              const c = e.target.checked;
                              if (c === includeDrinks) return;
                              setPrice((p) =>
                                clampPnlSellingPrice(
                                  p + (c ? COMBO_DRINK_ADD_UAH : -COMBO_DRINK_ADD_UAH)
                                )
                              );
                              setIncludeDrinks(c);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Include drink in product cost"
                          />
                          <span className="ing-sw-track" aria-hidden="true" />
                        </label>
                      ) : null}
                    </div>
                    <span
                      className={
                        "ing-cv" + (!inPl ? " ing-cost-muted" : "")
                      }
                    >
                      ₴{lineCost.toFixed(2)}
                    </span>
                    <span
                      className={
                        "ing-pv" + (!inPl ? " ing-cost-muted" : "")
                      }
                    >
                      {inPl ? `${pct.toFixed(0)}%` : "—"}
                    </span>
                    <span className="ing-chv">▼</span>
                  </div>
                  <div className="ing-body">
                    {ing.isLavash ? (
                      <>
                        <div className="ing-slider-block">
                          <div className="ing-sl-row">
                            <input
                              type="range"
                              min="0"
                              max="1000"
                              value={gt}
                              style={updateSliderFillStyle(gt)}
                              onChange={(e) => ingGramsSl(idx, e.target.value)}
                            />
                            <div className="ing-sl-ctl">
                              <span className="ing-sl-label">Weight, g</span>
                              <input
                                type="number"
                                className="w52"
                                value={ing.grams}
                                onChange={(e) => {
                                  let v = +e.target.value || 0;
                                  if (ing.gramsRange) {
                                    const [gmin, gmax] = ing.gramsRange;
                                    v = Math.max(gmin, Math.min(gmax, v));
                                  }
                                  patchIngredient(idx, { grams: v });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="lavash-price">
                          <div className="ing-sl-ctl">
                            <span className="ing-sl-label">Price / unit (₴)</span>
                            <div className="ing-sl-inline">
                              <input
                                type="number"
                                className={
                                  "w60" + (!inPl ? " ing-cost-inp" : "")
                                }
                                value={ing.ppkg}
                                onChange={(e) =>
                                  patchIngredient(idx, {
                                    ppkg: +e.target.value || 0,
                                  })
                                }
                              />
                              <span className="ing-sl-hint">per piece</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : ing.isPackaging ? (
                      <div className="ing-slider-block">
                        <div className="ing-sl-row ing-sl-row--packaging">
                          <div className="ing-sl-ctl">
                            <span className="ing-sl-label">Cost per item (₴)</span>
                            <input
                              type="number"
                              className="w60"
                              value={ing.ppkg}
                              onChange={(e) =>
                                patchIngredient(idx, {
                                  ppkg: +e.target.value || 0,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="ing-slider-block">
                          <div className="ing-sl-row">
                            <input
                              type="range"
                              min="0"
                              max="1000"
                              value={gt}
                              style={updateSliderFillStyle(gt)}
                              onChange={(e) => ingGramsSl(idx, e.target.value)}
                            />
                            <div className="ing-sl-ctl">
                              <span className="ing-sl-label">Weight, g</span>
                              <input
                                type="number"
                                className="w52"
                                value={ing.grams}
                                onChange={(e) => {
                                  let v = +e.target.value || 0;
                                  if (ing.gramsRange) {
                                    const [gmin, gmax] = ing.gramsRange;
                                    v = Math.max(gmin, Math.min(gmax, v));
                                  }
                                  patchIngredient(idx, { grams: v });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="ing-slider-block">
                          <div className="ing-sl-row">
                            <input
                              type="range"
                              min="0"
                              max="1000"
                              value={pt}
                              style={updateSliderFillStyle(pt)}
                              onChange={(e) => ingPpkgSl(idx, e.target.value)}
                            />
                            <div className="ing-sl-ctl">
                              <span className="ing-sl-label">Price / kg (₴)</span>
                            <input
                              type="number"
                              className={
                                "w60" + (!inPl ? " ing-cost-inp" : "")
                              }
                              value={ing.ppkg}
                              onChange={(e) => {
                                const v = +e.target.value || 0;
                                patchIngredient(idx, { ppkg: v });
                              }}
                            />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 6,
                      }}
                    >
                      <button
                        type="button"
                        className="del-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeIngredient(idx);
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                </div>
                </Fragment>
              );
            })}
          </div>
          <button type="button" className="add-btn" onClick={addIngredient}>
            + Add Ingredient
          </button>
          <div className="sr" style={{ marginTop: 9 }}>
            <span className="sr-l">Total product weight</span>
            <span className="sr-v">
              {formatIntLocaleStable(Math.round(totalProductWeightG))} g
            </span>
          </div>
          <div className="sr" style={{ marginTop: 4 }}>
            <span className="sr-l">Cost per item</span>
            <span className="sr-v acc">
              {currency === "USD" ? fUSD(cogsUnit) : "₴" + cogsUnit.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="panel" style={{ gridColumn: 2, gridRow: 1 }}>
          <div className="ptitle">📊 Sales & PnL</div>

          <div className="pnl-row">
            <div>
              <div className="ifl">Price</div>
              <div className="ci-sl">
                <input
                  type="range"
                  id="price-sl"
                  min="0"
                  max="1000"
                  value={priceT}
                  style={updateSliderFillStyle(priceT)}
                  onChange={(e) => onMainSlider("price", e.target.value)}
                  aria-label="Adjust price with slider"
                />
              </div>
            </div>
            <input
              type="number"
              id="in-price"
              className="w88"
              value={price}
              min={PNL_PRICE_MIN_UAH}
              max={PNL_PRICE_MAX_UAH}
              onChange={(e) => onMainInput("price", e.target.value)}
            />
          </div>
          <div className="pnl-row">
            <div>
              <div className="ifl">Items / day</div>
              <div className="ci-sl">
                <input
                  type="range"
                  id="items-sl"
                  min="0"
                  max="1000"
                  value={itemsT}
                  style={updateSliderFillStyle(itemsT)}
                  onChange={(e) => onMainSlider("items", e.target.value)}
                  aria-label="Adjust daily volume with slider"
                />
              </div>
            </div>
            <input
              type="number"
              id="in-items"
              className="w88"
              value={items}
              onChange={(e) => onMainInput("items", e.target.value)}
            />
          </div>

          <div className="divider" />
          <div className="sub-lbl">Daily Snapshot</div>
          <div className="snap-grid">
            <div className="sc">
              <div className="sc-l">Revenue</div>
              <div className="sc-v">{fmt(dailyRev)}</div>
            </div>
            <div className="sc">
              <div className="sc-l">Profit</div>
              <div
                className="sc-v"
                style={{
                  color:
                    dailyProf >= 0 ? "var(--grn-l)" : "var(--red-l)",
                }}
              >
                {fmt(dailyProf)}
              </div>
            </div>
          </div>

          <div className="sub-lbl">Cost Breakdown (% of Revenue)</div>
          <div className="bar-item">
            <div className="bar-top">
              <span className="bar-nm">Food</span>
              <span
                className="bar-pct"
                style={{ color: foodCostBarPctColor(fp) }}
              >
                {fp.toFixed(1)}%
              </span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: setBarW(fp),
                  background: foodCostBarFillHex(fp),
                }}
              />
            </div>
          </div>
          <div className="bar-item">
            <div className="bar-top">
              <span className="bar-nm">Labor</span>
              <span className="bar-pct">{lp.toFixed(1)}%</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: setBarW(lp), background: "#f5a623" }}
              />
            </div>
          </div>
          <div className="bar-item">
            <div className="bar-top">
              <span className="bar-nm">Rent</span>
              <span className="bar-pct">{rp.toFixed(1)}%</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: setBarW(rp), background: "#3b82f6" }}
              />
            </div>
          </div>
          <div className="bar-item">
            <div className="bar-top">
              <span className="bar-nm">Operational</span>
              <span className="bar-pct">{opPct.toFixed(1)}%</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: setBarW(opPct), background: "#a855f7" }}
              />
            </div>
          </div>
          <div className="bar-item">
            <div className="bar-top">
              <span className="bar-nm">Profit</span>
              <span className="bar-pct">{margin.toFixed(1)}%</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: setBarW(margin),
                  background: "var(--grn-l)",
                }}
              />
            </div>
          </div>
          <div className="divider" />
          <div className="sr">
            <span className="sr-l">Break-even items/day</span>
            <span className="sr-v acc">
              {typeof be === "number" ? be + " items" : be}
            </span>
          </div>
          <div className="sr">
            <span className="sr-l">Profit / item (monthly avg.)</span>
            <span
              className="sr-v"
              style={{ color: getProfitPerItemTextColor(profitPerItem) }}
            >
              {profitPerItem == null ? "—" : fmtPerItem(profitPerItem)}
            </span>
          </div>
        </div>

        <div className="out-panel">
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-l">Profit Margin</div>
              <div className={"kpi-v " + cc(margin)}>{margin.toFixed(1)}%</div>
              <div className="kpi-s">{marginStatus(margin)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">Daily Profit</div>
              <div className={"kpi-v " + cc(dailyProf)}>{fmt(dailyProf)}</div>
              <div className="kpi-s">
                {items} × {fmt(price)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-l">Monthly Profit</div>
              <div className={"kpi-v " + cc(monthProf)}>{fmt(monthProf)}</div>
              <div className="kpi-s">30 days</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">Food Cost %</div>
              <div
                className={"kpi-v " + foodCostKpiClass(fp)}
                id="kpi-food-pct"
              >
                {fp.toFixed(1)}%
              </div>
              <div className="kpi-s">of revenue</div>
            </div>
          </div>
          <div className="meter-wrap">
            <div className="meter-hd">
              <span className="meter-txt">Margin Health</span>
              <span className="meter-pct">{margin.toFixed(1)}%</span>
            </div>
            <div className="meter-trk">
              <div
                className="meter-fil"
                id="meter-fil"
                style={{
                  width: Math.max(meterW, 0) + "%",
                  background: meterBg,
                }}
              />
            </div>
            <div className="meter-sc">
              <span style={{ color: "var(--red-l)" }}>Loss</span>
              <span>0%</span>
              <span style={{ color: "var(--grn-l)" }}>Healthy</span>
            </div>
          </div>
          <div className="proj-wrap">
            <div className="proj-ttl">PROJECTIONS</div>
            <div className="proj-row">
              <span className="proj-rl">Daily</span>
              <div className="proj-rv">
                <div className="proj-v">
                  <span>{fUAH(dailyProf)}</span>
                  <small>UAH</small>
                </div>
                <div className="proj-v">
                  <span>{fUSD(dailyProf)}</span>
                  <small>USD</small>
                </div>
              </div>
            </div>
            <div className="proj-row">
              <span className="proj-rl">Monthly</span>
              <div className="proj-rv">
                <div className="proj-v">
                  <span>{fUAH(monthProf)}</span>
                  <small>UAH</small>
                </div>
                <div className="proj-v">
                  <span>{fUSD(monthProf)}</span>
                  <small>USD</small>
                </div>
              </div>
            </div>
            <div className="proj-row">
              <span className="proj-rl">Annual</span>
              <div className="proj-rv">
                <div className="proj-v">
                  <span>{fUAH(monthProf * 12)}</span>
                  <small>UAH</small>
                </div>
                <div className="proj-v">
                  <span>{fUSD(monthProf * 12)}</span>
                  <small>USD</small>
                </div>
              </div>
            </div>
            <div className="proj-row">
              <span className="proj-rl">5 Years</span>
              <div className="proj-rv">
                <div className="proj-v">
                  <span>{fUAH(monthProf * 60)}</span>
                  <small>UAH</small>
                </div>
                <div className="proj-v">
                  <span>{fUSD(monthProf * 60)}</span>
                  <small>USD</small>
                </div>
              </div>
            </div>
          </div>
          <div className="chart-wrap">
            <div className="proj-ttl" style={{ marginBottom: 7 }}>
              COST STRUCTURE
            </div>
            {chartReady ? (
              <CostDonut data={pnl.donut} />
            ) : (
              <div
                className="chart-wrap-skeleton"
                style={{ minHeight: 155 }}
                aria-hidden
              />
            )}
          </div>
        </div>

        <div className="bot-row">
          <div className="panel">
            <div className="ptitle">👥 Labor</div>
            <div className="sh">
              <span className="sl">% of revenue</span>
              <span className="spct" style={{ color: "var(--accent)" }}>
                {lp.toFixed(1)}%
              </span>
            </div>
            <div className="sh" style={{ marginTop: 4, marginBottom: 10 }}>
              <span className="sl">Monthly total</span>
              <span className="spct spct-total">{fUAH(monthLabor)}</span>
            </div>
            {employees.map((e, idx) => {
              const t = toSlider("salary", e.salary);
              return (
                <div className="ci ci-vstack" key={e.id}>
                  <div className="ci-line-3">
                    <input
                      type="text"
                      className="ci-inp-name"
                      value={e.name}
                      onChange={(ev) => {
                        setEmployees((prev) => {
                          const c = [...prev];
                          c[idx] = { ...c[idx], name: ev.target.value };
                          return c;
                        });
                      }}
                    />
                    <div className="ci-amt-blk">
                      <span className="ci-cur">₴</span>
                      <input
                        type="number"
                        className="ci-amt"
                        value={e.salary}
                        onChange={(ev) => {
                          const v = +ev.target.value || 0;
                          setEmployees((prev) => {
                            const c = [...prev];
                            c[idx] = { ...c[idx], salary: v };
                            return c;
                          });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="del-btn"
                      onClick={() => {
                        setEmployees((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="ci-slider-full">
                    <div className="ci-sl">
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        value={t}
                        style={updateSliderFillStyle(t)}
                        onChange={(ev) => empSl(idx, ev.target.value)}
                        aria-label="Adjust monthly salary with slider"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="add-btn"
              onClick={() =>
                setEmployees((prev) => [
                  ...prev,
                  { id: "e" + Date.now(), name: "Employee", salary: 30000 },
                ])
              }
            >
              + Add Employee
            </button>
          </div>

          <div className="panel">
            <div className="ptitle">🏢 Rent</div>
            <div className="sh">
              <span className="sl">% of revenue</span>
              <span className="spct" style={{ color: "var(--accent)" }}>
                {rp.toFixed(1)}%
              </span>
            </div>
            <div className="sh" style={{ marginTop: 4, marginBottom: 10 }}>
              <span className="sl">Monthly total</span>
              <span className="spct spct-total">{fmt(monthRent)}</span>
            </div>
            {rentItems.map((r, idx) => {
              const t = toSlider("rent", r.monthly);
              return (
                <div className="ci ci-vstack" key={r.id}>
                  <div className="ci-line-3">
                    <input
                      type="text"
                      className="ci-inp-name"
                      value={r.name}
                      onChange={(ev) => {
                        setRentItems((prev) => {
                          const c = [...prev];
                          c[idx] = { ...c[idx], name: ev.target.value };
                          return c;
                        });
                      }}
                    />
                    <div className="ci-amt-blk">
                      <span className="ci-cur">₴</span>
                      <input
                        type="number"
                        className="ci-amt"
                        value={r.monthly}
                        onChange={(ev) => {
                          const v = +ev.target.value || 0;
                          setRentItems((p) => {
                            const c = [...p];
                            c[idx] = { ...c[idx], monthly: v };
                            return c;
                          });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="del-btn"
                      onClick={() => {
                        setRentItems((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="ci-slider-full">
                    <div className="ci-sl">
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        value={t}
                        style={updateSliderFillStyle(t)}
                        onChange={(ev) => rentSl(idx, ev.target.value)}
                        aria-label="Adjust rent with slider"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="add-btn"
              onClick={() =>
                setRentItems((prev) => [
                  ...prev,
                  { id: "r" + Date.now(), name: "Property", monthly: 10000 },
                ])
              }
            >
              + Add Property
            </button>
          </div>

          <div className="panel">
            <div className="ptitle">⚡ Operational</div>
            <div className="sh">
              <span className="sl">% of revenue</span>
              <span className="spct" style={{ color: "var(--accent)" }}>
                {opPct.toFixed(1)}%
              </span>
            </div>
            <div className="sh" style={{ marginTop: 4, marginBottom: 10 }}>
              <span className="sl">Monthly total</span>
              <span className="spct spct-total">{fUAH(monthOps)}</span>
            </div>
            {opsItems.map((op, idx) => {
              const bankVal = op.isBank
                ? Math.round(monthRev * (Number(op.monthly) / 100))
                : 0;
              const displayVal = op.isBank ? bankVal : op.monthly;
              const t = op.isBank
                ? bankToSlider(op.monthly)
                : toSlider("ops", op.monthly);
              return (
                <div className="ci ci-vstack" key={op.id}>
                  <div className="ci-line-3">
                    <div
                      className="ci-ops-lbl"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                        minWidth: 0,
                      }}
                    >
                      <input
                        type="text"
                        className="ci-inp-name"
                        value={op.name}
                        onChange={(ev) => {
                          setOpsItems((prev) => {
                            const c = [...prev];
                            c[idx] = { ...c[idx], name: ev.target.value };
                            return c;
                          });
                        }}
                        style={op.isBank ? { maxWidth: 100 } : undefined}
                      />
                      {op.isBank ? (
                        <span
                          className="ci-bank-pct-lbl"
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {Number(op.monthly).toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                    {op.isBank ? (
                      <span className="ci-amt-txt">{fUAH(displayVal)}</span>
                    ) : (
                      <div className="ci-amt-blk">
                        <span className="ci-cur">₴</span>
                        <input
                          type="number"
                          className="ci-amt"
                          value={displayVal}
                          onChange={(ev) => {
                            const v = +ev.target.value || 0;
                            setOpsItems((p) => {
                              const c = [...p];
                              c[idx] = { ...c[idx], monthly: v };
                              return c;
                            });
                          }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className="del-btn"
                      onClick={() => {
                        setOpsItems((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="ci-slider-full">
                    <div className="ci-sl">
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        value={t}
                        style={updateSliderFillStyle(t)}
                        onChange={(ev) => opsSl(idx, ev.target.value)}
                        aria-label={
                          op.isBank
                            ? "Adjust banking fee percent with slider"
                            : "Adjust operational cost with slider"
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="add-btn"
              onClick={() =>
                setOpsItems((prev) => [
                  ...prev,
                  { id: "o" + Date.now(), name: "New Cost", monthly: 1000, isBank: false },
                ])
              }
            >
              + Add Item
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
