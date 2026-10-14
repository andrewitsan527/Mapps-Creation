"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
];

const UNRESOLVED = "Unresolved";

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
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
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
            className="ls-drawer-overlay fixed inset-0 z-50 flex justify-end bg-black/30"
            onMouseDown={() => setOpenId(null)}
          >
            <div
              ref={drawerRef}
              className="ls-drawer flex h-full w-full max-w-xl min-w-0 flex-col"
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
                <table className="erp-table erp-register ls-roll-table w-full min-w-[24rem] table-fixed">
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
          <h2 className="ls-panel-title">Live Stock Register</h2>
          <label className="ls-search">
            <span>Search item / code / colour</span>
            <input
              className={fieldClass}
              value={query}
              placeholder="Search"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button" className="ls-clear" onClick={() => setQuery("")}>
              Clear
            </button>
          </label>
        </div>
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
