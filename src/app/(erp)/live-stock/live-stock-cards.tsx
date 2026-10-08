"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

/** Future LiveStockRoll.qualityState. WITHOUT_QC stays sellable. */
type StockQuality = "PASSED" | "WITHOUT_QC";

type DemoRoll = {
  id: string;
  rollNo: string;
  finishedKg: number;
  qualityState: StockQuality;
  status: "available";
};

type DemoGroup = {
  id: string;
  item: string;
  code: string;
  colour: string;
  rolls: DemoRoll[];
};

const QUALITY_LABEL: Record<StockQuality, string> = {
  PASSED: "QC Passed",
  WITHOUT_QC: "Without QC",
};

/**
 * Static review data only. Replace this list with LiveStockRoll groups later.
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

function expandDemo(specs: typeof DEMO_SPECS): DemoGroup[] {
  return specs.map((spec) => {
    const thousandths = Math.round(spec.totalKg * 1000);
    const base = Math.floor(thousandths / spec.rolls);
    let extra = thousandths - base * spec.rolls;
    const rolls: DemoRoll[] = [];
    for (let index = 0; index < spec.rolls; index += 1) {
      const weight = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      rolls.push({
        id: `${spec.item}-${spec.code}-${spec.colour}-${index + 1}`,
        rollNo: `Roll ${index + 1}`,
        finishedKg: weight / 1000,
        qualityState: index < spec.withoutQc ? "WITHOUT_QC" : "PASSED",
        status: "available",
      });
    }
    return {
      id: `${spec.item}|${spec.code}|${spec.colour}`,
      item: spec.item,
      code: spec.code,
      colour: spec.colour,
      rolls,
    };
  });
}

const DEMO_GROUPS = expandDemo(DEMO_SPECS);

function formatKg(value: number, digits = 2) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const fieldClass =
  "h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-500";

export function LiveStockBoard() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const rolls = DEMO_GROUPS.flatMap((group) => group.rolls);
    const kg = rolls.reduce((sum, roll) => sum + roll.finishedKg, 0);
    const passed = rolls.filter((roll) => roll.qualityState === "PASSED").length;
    const withoutQc = rolls.filter((roll) => roll.qualityState === "WITHOUT_QC").length;
    return { rolls: rolls.length, kg, passed, withoutQc };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return DEMO_GROUPS.flatMap((group) => {
      if (
        needle &&
        !group.item.toLowerCase().includes(needle) &&
        !group.code.toLowerCase().includes(needle) &&
        !group.colour.toLowerCase().includes(needle)
      ) {
        return [];
      }
      const totalKg = group.rolls.reduce((sum, roll) => sum + roll.finishedKg, 0);
      return [{ ...group, totalKg }];
    });
  }, [query]);

  const open = visible.find((group) => group.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Total Rolls" value={String(summary.rolls)} />
        <Stat label="Total KG" value={`${formatKg(summary.kg)} KG`} />
        <Stat label="QC Passed" value={`${summary.passed} Rolls`} />
        <Stat label="Without QC" value={`${summary.withoutQc} Rolls`} />
      </div>
      <label className="block w-[30%] min-w-56 text-[12px] font-medium text-neutral-700">
        Search item / code / colour
        <span className="mt-1 flex items-center gap-2">
          <input
            className={fieldClass}
            value={query}
            placeholder="Search"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="h-9 shrink-0 rounded-md border border-neutral-300 bg-white px-3 text-[13px] font-medium text-neutral-800"
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        </span>
      </label>

      {visible.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-6 text-center text-[13px] text-neutral-600">
          No matching stock.
        </p>
      ) : (
        <div className="max-h-[calc(100vh-16rem)] overflow-auto rounded-md border border-neutral-200">
          <table className="w-full border-collapse text-[13px] text-neutral-900">
            <thead>
              <tr>
                <th className={headClass}>Item</th>
                <th className={headClass}>Code</th>
                <th className={headClass}>Colour</th>
                <th className={`${headClass} text-right`}>Rolls</th>
                <th className={`${headClass} text-right`}>Total KG</th>
                <th className={`${headClass} w-24 text-right`}> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((group, index) => (
                <tr
                  key={group.id}
                  className={`cursor-pointer border-b border-neutral-200 ${index % 2 === 0 ? "bg-white" : "bg-neutral-50"} hover:bg-neutral-100`}
                  onClick={() => setOpenId(group.id)}
                >
                  <td className={cellClass}>{group.item}</td>
                  <td className={cellClass}>{group.code}</td>
                  <td className={cellClass}>{group.colour}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{group.rolls.length}</td>
                  <td className={`${cellClass} text-right tabular-nums`}>{formatKg(group.totalKg)} KG</td>
                  <td className={`${cellClass} text-right text-neutral-500`}>
                    <span className="inline-flex items-center gap-0.5">
                      View
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={() => setOpenId(null)}>
          <div
            className="flex h-full w-full max-w-xl flex-col border-l border-neutral-200 bg-white shadow-sm"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={`${open.item} ${open.code} ${open.colour}`}
          >
            <div className="flex items-start justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <h2 className="text-[18px] font-semibold text-neutral-950">{open.item}</h2>
                <p className="mt-0.5 text-[13px] text-neutral-600">
                  Code {open.code} · {open.colour}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-[13px] text-neutral-800"
                onClick={() => setOpenId(null)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              <Stat label="Total Rolls" value={String(open.rolls.length)} />
              <Stat label="Total KG" value={`${formatKg(open.totalKg)} KG`} />
              <Stat
                label="Without QC"
                value={`${open.rolls.filter((roll) => roll.qualityState === "WITHOUT_QC").length} Rolls`}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
              <table className="w-full border-collapse text-[13px] text-neutral-900">
                <thead>
                  <tr>
                    <th className={headClass}>Roll</th>
                    <th className={`${headClass} text-right`}>Finished KG</th>
                    <th className={headClass}>Quality</th>
                    <th className={headClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {open.rolls.map((roll, index) => (
                    <tr key={roll.id} className={index % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                      <td className={cellClass}>{roll.rollNo}</td>
                      <td className={`${cellClass} text-right tabular-nums`}>{formatKg(roll.finishedKg, 3)} KG</td>
                      <td className={cellClass}>{QUALITY_LABEL[roll.qualityState]}</td>
                      <td className={cellClass}>Available</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const headClass =
  "sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-neutral-600 uppercase";
const cellClass = "border-b border-neutral-200 px-3 py-3 align-middle";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="mt-1 text-[18px] leading-none font-semibold text-neutral-950 tabular-nums">{value}</p>
    </div>
  );
}

