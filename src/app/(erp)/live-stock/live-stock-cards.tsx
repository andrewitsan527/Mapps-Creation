"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import type { LiveStockRollRow } from "@/server/actions/live-stock";

type StockRoll = {
  id: string;
  rollNo: string;
  finishedKg: string | null;
  qualityState: string;
  status: string;
};

type StockGroup = {
  id: string;
  item: string;
  code: string;
  colour: string;
  rolls: StockRoll[];
};

/**
 * Static review data only. Shown when Demo is on. Never written to stock.
 * Passed rolls + Without QC rolls = available rolls. Without QC is not extra stock.
 */
const DEMO_SPECS: {
  item: string;
  code: string;
  colour: string;
  rolls: number;
  withoutQc: number;
  totalKg: number;
}[] = [
  { item: "Alpino", code: "A1", colour: "Maroon", rolls: 24, withoutQc: 4, totalKg: 602.5 },
  { item: "Mario", code: "C1", colour: "Blue", rolls: 18, withoutQc: 0, totalKg: 451.2 },
  { item: "Alpino", code: "A1", colour: "Black", rolls: 32, withoutQc: 4, totalKg: 798.4 },
  { item: "Roma", code: "B2", colour: "Navy", rolls: 36, withoutQc: 6, totalKg: 910.8 },
  { item: "Roma", code: "B2", colour: "Grey", rolls: 22, withoutQc: 2, totalKg: 548.6 },
  { item: "Alpino", code: "A2", colour: "Cream", rolls: 28, withoutQc: 4, totalKg: 701.4 },
  { item: "Mario", code: "C2", colour: "Red", rolls: 16, withoutQc: 0, totalKg: 398.4 },
  { item: "Mario", code: "C3", colour: "Green", rolls: 40, withoutQc: 6, totalKg: 1004 },
  { item: "Linen", code: "D1", colour: "White", rolls: 30, withoutQc: 4, totalKg: 742.5 },
  { item: "Linen", code: "D1", colour: "Ivory", rolls: 14, withoutQc: 2, totalKg: 348.6 },
  { item: "Silk", code: "E1", colour: "Wine", rolls: 26, withoutQc: 3, totalKg: 655.2 },
  { item: "Silk", code: "E2", colour: "Gold", rolls: 12, withoutQc: 1, totalKg: 301.2 },
  { item: "Terry", code: "F1", colour: "Pink", rolls: 20, withoutQc: 4, totalKg: 502 },
  { item: "Terry", code: "F1", colour: "Peach", rolls: 18, withoutQc: 2, totalKg: 451.8 },
  { item: "Canvas", code: "G1", colour: "Olive", rolls: 44, withoutQc: 6, totalKg: 1102.2 },
  { item: "Canvas", code: "G2", colour: "Sand", rolls: 36, withoutQc: 0, totalKg: 904.5 },
  { item: "Denim", code: "H1", colour: "Indigo", rolls: 32, withoutQc: 0, totalKg: 817.2 },

  /* A quality carrying 12 colour codes, with the master's own trade names.
     Shows two things at once: the card capping at four colours with the rest
     behind the overflow link, and the blank square a name like Chikoo gets
     because it is a trade name, not a colour. */
  { item: "Valentino", code: "901", colour: "Mouse", rolls: 46, withoutQc: 6, totalKg: 1154.6 },
  { item: "Valentino", code: "902", colour: "Chikoo", rolls: 38, withoutQc: 0, totalKg: 952.8 },
  { item: "Valentino", code: "903", colour: "Magenta", rolls: 34, withoutQc: 4, totalKg: 851.4 },
  { item: "Valentino", code: "904", colour: "Rani", rolls: 29, withoutQc: 3, totalKg: 727.5 },
  { item: "Valentino", code: "905", colour: "D.Coffee", rolls: 26, withoutQc: 0, totalKg: 652.6 },
  { item: "Valentino", code: "906", colour: "N.Blue", rolls: 24, withoutQc: 2, totalKg: 601.2 },
  { item: "Valentino", code: "907", colour: "Coffee", rolls: 21, withoutQc: 0, totalKg: 526.8 },
  { item: "Valentino", code: "908", colour: "Onion", rolls: 18, withoutQc: 4, totalKg: 451.4 },
  { item: "Valentino", code: "909", colour: "Airforce", rolls: 16, withoutQc: 0, totalKg: 401.6 },
  { item: "Valentino", code: "910", colour: "Olive", rolls: 14, withoutQc: 2, totalKg: 351.2 },
  { item: "Valentino", code: "911", colour: "Pista", rolls: 11, withoutQc: 0, totalKg: 276.4 },
  { item: "Valentino", code: "912", colour: "Firozi", rolls: 9, withoutQc: 1, totalKg: 226.8 },
];

const UNRESOLVED = "Unresolved";

/* A seven-column register needs 672px and a phone gives it 370: you end up
   dragging sideways to read one row. Below this width the board is the only
   sensible view, so the table is not offered at all. Read through
   useSyncExternalStore rather than an effect, so there is no setState during
   render and the server snapshot stays stable. */
const NARROW = "(max-width: 767px)";

function subscribeToNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/* A quality can carry 10+ colour codes. Showing them all would make the card
   grow without bound and break the one rule these cards must keep: every card
   the same size. The rest are one click away in the table. */
const LOTS_PER_CARD = 4;

function expandDemo(specs: typeof DEMO_SPECS): StockGroup[] {
  return specs.map((spec) => {
    const thousandths = Math.round(spec.totalKg * 1000);
    const base = Math.floor(thousandths / spec.rolls);
    let extra = thousandths - base * spec.rolls;
    const rolls: StockRoll[] = [];
    for (let index = 0; index < spec.rolls; index += 1) {
      const weight = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      rolls.push({
        id: `demo-${spec.item}-${spec.code}-${spec.colour}-${index + 1}`,
        rollNo: `Roll ${index + 1}`,
        finishedKg: (weight / 1000).toFixed(3),
        qualityState: index < spec.withoutQc ? "WITHOUT_QC" : "PASSED",
        status: "available",
      });
    }
    return {
      id: `demo:${spec.item}|${spec.code}|${spec.colour}`,
      item: spec.item,
      code: spec.code,
      colour: spec.colour,
      rolls,
    };
  });
}

const DEMO_GROUPS = expandDemo(DEMO_SPECS);

function thousandths(value: string | null): number | null {
  if (value == null) return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[2]);
  if (!Number.isSafeInteger(whole)) return null;
  const digits = match[3] ?? "";
  const frac = digits.slice(0, 3).padEnd(3, "0");
  let units = whole * 1000 + Number(frac);
  if ((digits[3] ?? "0") >= "5") units += 1;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * units;
}

function formatThousandths(value: number, digits = 2) {
  return (value / 1000).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatKg(value: string | null, digits = 2) {
  const weight = thousandths(value);
  if (weight == null) return "—";
  return formatThousandths(weight, digits);
}

function sumKg(values: (string | null)[]) {
  let total = 0;
  let any = false;
  for (const value of values) {
    const weight = thousandths(value);
    if (weight == null) continue;
    any = true;
    total += weight;
  }
  return any ? total : null;
}

function qualityLabel(state: string) {
  if (state === "PASSED") return "QC Passed";
  if (state === "WITHOUT_QC") return "Without QC";
  return state.trim() || "—";
}

function statusLabel(status: string) {
  const text = status.trim();
  if (!text) return "—";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function codeLabel(code: string) {
  return code.trim() || UNRESOLVED;
}

/* ---------------------------------------------------------------
   Colour swatches.

   ColorCode stores only { colorCode, colorName } — there is no hex in the
   schema, and the names are trade names (Mouse, Chikoo, Rani, Onion,
   Airforce), not colours. Painting a guess would be worse than painting
   nothing: a wrong swatch is read as fact.

   So: a name that IS a colour gets its colour. Anything else gets its code
   on a neutral chip, which is honest and still unique per lot. The "D." /
   "L." / "N." prefixes the client actually uses are resolved first.
----------------------------------------------------------------- */
const COLOUR_HEX: Record<string, string> = {
  white: "#f4f6f8", ivory: "#f2ead9", cream: "#f0e4c8", beige: "#e4d5bb",
  sand: "#ddc9a3", khaki: "#c3b091", tan: "#cf9f6e", camel: "#bf8f55",
  gold: "#d2a53c", mustard: "#cf9f1c", yellow: "#e8c53f", lime: "#9fcb3b",
  green: "#3f8f4f", olive: "#6f7a33", bottle: "#1f5137", mint: "#8fd3b6",
  teal: "#1f7a78", aqua: "#5fc4c9", sky: "#7fb8e0", blue: "#2b6cb0",
  navy: "#1b2f52", indigo: "#38427a", violet: "#6b4e9b", purple: "#6a3d8f",
  lavender: "#b5a8dd", magenta: "#b5267e", pink: "#dd7fa6", rose: "#cf6b82",
  peach: "#efb08c", orange: "#d97b2b", rust: "#a4532a", brown: "#6f4a30",
  coffee: "#5a4030", maroon: "#6d2230", wine: "#5d1f33", red: "#b3271c",
  grey: "#8a949e", gray: "#8a949e", silver: "#c3c9cf", charcoal: "#3b4248",
  black: "#1a1f24",
};

const SHADE_PREFIX: Record<string, "dark" | "light" | "navy"> = {
  d: "dark",
  l: "light",
  n: "navy",
};

function shade(hex: string, amount: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const mix = (channel: number) =>
    Math.round(
      amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount,
    );
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function swatchFor(colour: string): string | null {
  const raw = colour.trim().toLowerCase();
  if (!raw) return null;
  const prefixed = /^([a-z])[.\s]+(.+)$/.exec(raw);
  const base = prefixed ? prefixed[2].trim() : raw;
  const word = base.split(/[\s/-]+/).find((part) => COLOUR_HEX[part]) ?? base;
  const hex = COLOUR_HEX[word];
  if (!hex) return null;
  if (!prefixed) return hex;
  const kind = SHADE_PREFIX[prefixed[1]];
  if (kind === "dark") return shade(hex, -0.35);
  if (kind === "light") return shade(hex, 0.35);
  if (kind === "navy") return shade(COLOUR_HEX.navy, 0.1);
  return hex;
}

function rollOrder(a: string, b: string) {
  const left = a.trim();
  const right = b.trim();
  const leftNo = Number(left);
  const rightNo = Number(right);
  if (left !== "" && right !== "" && Number.isFinite(leftNo) && Number.isFinite(rightNo)) {
    return leftNo - rightNo;
  }
  return left.localeCompare(right, undefined, { numeric: true });
}

function groupStock(rows: LiveStockRollRow[]): StockGroup[] {
  const groups = new Map<string, StockGroup>();
  for (const row of rows) {
    const item = row.item.trim();
    const code = row.code.trim();
    const colour = row.colour;
    const key = `${item}\u0000${code}\u0000${colour}`;
    const group = groups.get(key) ?? {
      id: `stock:${key}`,
      item,
      code: codeLabel(code),
      colour,
      rolls: [],
    };
    group.rolls.push({
      id: row.id,
      rollNo: row.rollNo,
      finishedKg: row.finishedKg,
      qualityState: row.qualityState,
      status: row.status,
    });
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      rolls: [...group.rolls].sort(
        (a, b) => rollOrder(a.rollNo, b.rollNo) || a.id.localeCompare(b.id),
      ),
    }))
    .sort((a, b) => {
      const item = a.item.localeCompare(b.item);
      if (item) return item;
      const aCode = a.code === UNRESOLVED ? "" : a.code;
      const bCode = b.code === UNRESOLVED ? "" : b.code;
      if (!aCode && bCode) return 1;
      if (aCode && !bCode) return -1;
      const code = aCode.localeCompare(bCode);
      if (code) return code;
      return a.colour.localeCompare(b.colour);
    });
}

const fieldClass =
  "h-9 min-w-0 w-full flex-1 rounded-md border border-(--line) bg-(--panel) px-2.5 text-[13px] text-(--ink) outline-none focus:border-(--line-strong)";

export function LiveStockBoard({ rolls }: { rolls: LiveStockRollRow[] }) {
  const [demo, setDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const isNarrow = useSyncExternalStore(
    subscribeToNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
  const shownView = isNarrow ? "cards" : view;
  const [sort, setSort] = useState<"rolls" | "kg" | "name">("rolls");
  const [openId, setOpenId] = useState<string | null>(null);
  const [canPortal, setCanPortal] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const realGroups = useMemo(() => groupStock(rolls), [rolls]);
  const groups = demo ? DEMO_GROUPS : realGroups;

  useEffect(() => {
    if (!openId) return;
    const root = drawerRef.current;
    function focusables() {
      return root
        ? [...root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )]
        : [];
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenId(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      event.preventDefault();
      const current = document.activeElement as HTMLElement | null;
      const index = current ? items.indexOf(current) : -1;
      const next = event.shiftKey
        ? items[(index - 1 + items.length) % items.length]
        : items[(index + 1) % items.length];
      next?.focus();
    }
    focusables()[0]?.focus();
    /* the sheet is centred now, so the page must not scroll behind it; the
       gutter is compensated or the sheet jumps sideways as it opens */
    const previousOverflow = document.body.style.overflow;
    const previousPad = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPad;
      returnFocusRef.current?.focus();
    };
  }, [openId]);

  useEffect(() => {
    setCanPortal(true);
  }, []);

  const summary = useMemo(() => {
    const listed = groups.flatMap((group) => group.rolls);
    return {
      rolls: listed.length,
      kg: sumKg(listed.map((roll) => roll.finishedKg)),
      passed: listed.filter((roll) => roll.qualityState === "PASSED").length,
      withoutQc: listed.filter((roll) => roll.qualityState === "WITHOUT_QC").length,
    };
  }, [groups]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups.flatMap((group) => {
      if (
        needle &&
        !group.item.toLowerCase().includes(needle) &&
        !group.code.toLowerCase().includes(needle) &&
        !group.colour.toLowerCase().includes(needle)
      ) {
        return [];
      }
      return [{ ...group, totalKg: sumKg(group.rolls.map((roll) => roll.finishedKg)) }];
    });
  }, [groups, query]);

  /* One card per quality, its colour codes inside — the shape the Color Code
     master already uses (ColorQuality -> ColorCode). Rolls lead: the client
     counts rolls, not kilos, so KG rides along as the second line. */
  const qualities = useMemo(() => {
    type Lot = (typeof visible)[number];
    const map = new Map<
      string,
      {
        item: string;
        lots: Lot[];
        rolls: number;
        kg: number | null;
        passed: number;
        withoutQc: number;
        codes: string[];
      }
    >();
    for (const lot of visible) {
      const entry = map.get(lot.item) ?? {
        item: lot.item,
        lots: [],
        rolls: 0,
        kg: null,
        passed: 0,
        withoutQc: 0,
        codes: [],
      };
      entry.lots.push(lot);
      entry.rolls += lot.rolls.length;
      entry.passed += lot.rolls.filter((roll) => roll.qualityState === "PASSED").length;
      entry.withoutQc += lot.rolls.filter(
        (roll) => roll.qualityState === "WITHOUT_QC",
      ).length;
      if (lot.totalKg != null) entry.kg = (entry.kg ?? 0) + lot.totalKg;
      if (!entry.codes.includes(lot.code)) entry.codes.push(lot.code);
      map.set(lot.item, entry);
    }
    const list = [...map.values()];
    for (const entry of list) {
      entry.lots.sort((x, y) => y.rolls.length - x.rolls.length);
      entry.codes.sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
    }
    list.sort((x, y) => {
      if (sort === "name") return x.item.localeCompare(y.item);
      if (sort === "kg") return (y.kg ?? 0) - (x.kg ?? 0);
      return y.rolls - x.rolls;
    });
    return list;
  }, [visible, sort]);

  const open = visible.find((group) => group.id === openId) ?? null;

  function toggleDemo() {
    setDemo((current) => !current);
    setQuery("");
    setOpenId(null);
  }

  const drawer =
    open && canPortal
      ? createPortal(
          <div
            className="ls-sheet-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            onMouseDown={() => setOpenId(null)}
          >
            <div
              ref={drawerRef}
              className="ls-sheet flex min-w-0 flex-col"
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
              aria-label={`${open.item} ${open.code} ${open.colour}`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-(--line) px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold break-words text-(--ink)">{open.item}</h2>
                  <p className="mt-0.5 text-[13px] break-words text-(--muted)">
                    Code {open.code} · {open.colour}
                  </p>
                  {demo ? (
                    <p className="mt-1 text-[12px] font-medium text-(--warn)">Sample data</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ls-drawer-close"
                  onClick={() => setOpenId(null)}
                >
                  Close
                </button>
              </div>
              <div className="ls-drawer-tiles grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-3">
                <Stat label="Total Rolls" value={String(open.rolls.length)} />
                <Stat
                  label="Total KG"
                  value={open.totalKg == null ? "—" : formatThousandths(open.totalKg)}
                />
                <Stat
                  label="Without QC"
                  value={String(open.rolls.filter((roll) => roll.qualityState === "WITHOUT_QC").length)}
                />
              </div>
              <div className="table-scroll min-h-0 flex-1 overflow-auto px-4 pb-4">
                <table className="erp-table erp-register ls-roll-table ls-reg w-full min-w-[24rem] table-fixed">
                  <colgroup>
                    <col className="w-[6rem]" />
                    <col className="w-[9.5rem]" />
                    <col />
                    <col className="w-[7rem]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th className="num !text-right">Finished KG</th>
                      <th>Quality</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.rolls.map((roll) => (
                      <tr key={roll.id}>
                        <td className="truncate" title={roll.rollNo}>
                          {roll.rollNo}
                        </td>
                        <td className="num !text-right">
                          {thousandths(roll.finishedKg) == null
                            ? "—"
                            : `${formatKg(roll.finishedKg, 3)} KG`}
                        </td>
                        <td className="truncate">
                          <span className="ls-chip" data-quality={roll.qualityState}>
                            {qualityLabel(roll.qualityState)}
                          </span>
                        </td>
                        <td className="truncate">
                          <span className="ls-chip" data-status={roll.status}>
                            {statusLabel(roll.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="ls-page">
      <div className="ls-stage">
      <div className="ls-topbar">
        <button
          type="button"
          className={`ls-demo-toggle${demo ? " is-on" : ""}`}
          aria-pressed={demo}
          onClick={toggleDemo}
        >
          {demo ? "Exit Demo Mode" : "Demo Mode"}
        </button>
      </div>
      {demo ? (
        <p className="ls-demo-banner" role="status">
          <span className="ls-demo-tag">DEMO MODE</span>
          Simulated inventory — this is not real warehouse stock.
        </p>
      ) : null}
      <div className="aw-metrics ls-metrics grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Total Rolls" value={String(summary.rolls)} />
        <Stat label="Total KG" value={summary.kg == null ? "—" : formatThousandths(summary.kg)} />
        <Stat label="QC Passed" value={String(summary.passed)} />
        <Stat label="Without QC" value={String(summary.withoutQc)} />
      </div>
      <div className="ls-panel">
        <div className="ls-panel-bar">
          <h2 className="ls-panel-title">Live Stock</h2>
          <div className="ls-bar-tools">
            <label className="ls-search">
              <span className="sr-only">Search quality / code / colour</span>
              <input
                className={fieldClass}
                value={query}
                placeholder="Search quality / code / colour"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button type="button" className="ls-clear" onClick={() => setQuery("")}>
                  Clear
                </button>
              ) : null}
            </label>
            <select
              className="ls-sort"
              aria-label="Sort by"
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value === "kg"
                    ? "kg"
                    : event.target.value === "name"
                      ? "name"
                      : "rolls",
                )
              }
            >
              <option value="rolls">Most rolls</option>
              <option value="kg">Most KG</option>
              <option value="name">Quality A&ndash;Z</option>
            </select>
            {isNarrow ? null : (
            <div className="ls-view-switch" role="group" aria-label="View">
              <button
                type="button"
                className={view === "cards" ? "is-on" : undefined}
                aria-pressed={view === "cards"}
                onClick={() => setView("cards")}
              >
                Cards
              </button>
              <button
                type="button"
                className={view === "table" ? "is-on" : undefined}
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
              >
                Table
              </button>
            </div>
            )}
          </div>
        </div>
        {shownView === "cards" ? (
          <div className="ls-board">
            {qualities.length === 0 ? (
              <p className="ls-board-empty">
                {query.trim() || demo ? "No matching stock." : "No available stock."}
              </p>
            ) : (
              qualities.map((quality, index) => {
                const cleared =
                  quality.rolls > 0
                    ? Math.round((quality.passed / quality.rolls) * 100)
                    : 0;
                return (
                  <article
                    key={quality.item}
                    className="ls-card"
                    data-accent={index % 5}
                    data-flag={quality.withoutQc > 0 ? "hold" : "clear"}
                  >
                    <header className="ls-card-head">
                      <div className="ls-card-id">
                        <h3 title={quality.item}>{quality.item}</h3>
                      </div>
                      <div className="ls-card-figure">
                        <span className="ls-card-rolls tabular-nums">{quality.rolls}</span>
                        <span className="ls-card-unit">rolls</span>
                        <span className="ls-card-kg tabular-nums">
                          {quality.kg == null
                            ? "\u2014"
                            : `${formatThousandths(quality.kg)} KG`}
                        </span>
                      </div>
                    </header>

                    <div
                      className="ls-qcbar"
                      role="img"
                      aria-label={`${quality.passed} of ${quality.rolls} rolls QC passed`}
                    >
                      <span style={{ width: `${cleared}%` }} />
                    </div>
                    <p className="ls-card-note">
                      {quality.withoutQc > 0
                        ? `${quality.withoutQc} roll${quality.withoutQc === 1 ? "" : "s"} waiting on QC`
                        : "All rolls QC cleared"}
                    </p>

                    <ul className="ls-lots">
                      {quality.lots.slice(0, LOTS_PER_CARD).map((lot) => {
                        const hex = swatchFor(lot.colour);
                        const held = lot.rolls.filter(
                          (roll) => roll.qualityState === "WITHOUT_QC",
                        ).length;
                        return (
                          <li key={lot.id} className="ls-lot">
                            <button
                              type="button"
                              className="ls-lot-btn"
                              aria-label={`View rolls for ${quality.item} code ${lot.code} ${lot.colour}`}
                              onClick={(event) => {
                                returnFocusRef.current = event.currentTarget;
                                setOpenId(lot.id);
                              }}
                            >
                              <span
                                className="ls-swatch"
                                data-known={hex ? "yes" : "no"}
                                style={hex ? { background: hex } : undefined}
                                aria-hidden
                              />
                              <span className="ls-lot-text">
                                <span className="ls-lot-name" title={lot.colour}>
                                  {lot.colour}
                                </span>
                                {/* the code never sits beside the roll count:
                                    real codes are 102 / 701 / 1001 and two bare
                                    numbers side by side cannot be told apart */}
                                <span className="ls-lot-code">{lot.code}</span>
                              </span>
                              <span className="ls-lot-kg tabular-nums">
                                {lot.totalKg == null
                                  ? "\u2014"
                                  : `${formatThousandths(lot.totalKg)} KG`}
                              </span>
                              <span
                                className="ls-lot-rolls tabular-nums"
                                data-held={held > 0 ? "yes" : "no"}
                                title={
                                  held > 0
                                    ? `${lot.rolls.length} rolls, ${held} waiting on QC`
                                    : `${lot.rolls.length} rolls, all QC cleared`
                                }
                              >
                                {lot.rolls.length}
                                <small>rolls</small>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {quality.lots.length > LOTS_PER_CARD ? (
                      <button
                        type="button"
                        className="ls-more"
                        onClick={() => {
                          setQuery(quality.item);
                          if (!isNarrow) setView("table");
                        }}
                      >
                        +{quality.lots.length - LOTS_PER_CARD} more colour
                        {quality.lots.length - LOTS_PER_CARD === 1 ? "" : "s"}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        ) : (
        <div className="table-scroll ls-scroll min-w-0 overflow-auto">
        <table className="erp-table erp-register ls-reg w-full min-w-[42rem] table-fixed">
          <colgroup>
            <col className="w-[2.75rem]" />
            <col />
            <col className="w-[8rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[9.5rem]" />
            <col className="w-[4.75rem]" />
          </colgroup>
          <thead>
            <tr>
              <th className="!text-center">No.</th>
              <th>Item</th>
              <th>Code</th>
              <th>Colour</th>
              <th className="num !text-right">Rolls</th>
              <th className="num !text-right">Total KG</th>
              <th className="!text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-(--muted)">
                  {query.trim() || demo ? "No matching stock." : "No available stock."}
                </td>
              </tr>
            ) : (
              visible.map((group, index) => (
                <tr
                  key={group.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View rolls for ${group.item} ${group.code} ${group.colour}`}
                  className="cursor-pointer"
                  onClick={(event) => {
                    returnFocusRef.current = event.currentTarget;
                    setOpenId(group.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      returnFocusRef.current = event.currentTarget;
                      setOpenId(group.id);
                    }
                  }}
                >
                  <td className="!text-center tabular-nums">{index + 1}</td>
                  <td className="overflow-hidden">
                    <span className="block truncate" title={group.item}>
                      {group.item}
                    </span>
                  </td>
                  <td className="overflow-hidden whitespace-nowrap">
                    {group.code === UNRESOLVED ? (
                      <span className="font-medium text-(--warn)">{UNRESOLVED}</span>
                    ) : (
                      group.code
                    )}
                  </td>
                  <td className="overflow-hidden">
                    <span className="block truncate" title={group.colour}>
                      {group.colour}
                    </span>
                  </td>
                  <td className="num !text-right">{group.rolls.length}</td>
                  <td className="num !text-right">
                    {group.totalKg == null ? "—" : `${formatThousandths(group.totalKg)} KG`}
                  </td>
                  <td className="!text-right text-(--muted)">
                    <button
                      type="button"
                      className="ls-view"
                      aria-label={`View rolls for ${group.item}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        returnFocusRef.current = event.currentTarget;
                        setOpenId(group.id);
                      }}
                    >
                      View
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {visible.length > 0 ? (
              <tr className="ls-filler" aria-hidden>
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
        )}
      </div>
      {drawer}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-(--line) bg-(--panel) px-3 py-2">
      <p className="text-[11px] font-medium text-(--muted)">{label}</p>
      <p className="mt-0.5 truncate text-[17px] leading-none font-semibold text-(--ink) tabular-nums" title={value}>
        {value}
      </p>
    </div>
  );
}
