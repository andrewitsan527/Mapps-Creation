"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Shirt, Trash2, X } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { friendlyError } from "@/lib/user-error";
import {
  clearDraft,
  describeAge,
  stashDraft,
  useRescuedDraft,
} from "@/lib/draft-rescue";
import {
  EmptyState,
  Field,
  FieldGroup,
  Metric,
  MetricStrip,
  Panel,
  TableWrap,
  buttonClass,
  buttonGhostClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import {
  createFinishedWork,
  updateFinishedWork,
  type FinishedWorkInput,
  type FinishedWorkRecord,
} from "@/server/actions/finished-work-entries";

type MasterOption = { id: string; name: string };

type RollRow = {
  id: string;
  greyKg: string;
  finishedKg: string;
};

type ItemLine = {
  id: string;
  itemId: string;
  lotNo: string;
  rate: string;
  rollCount: string;
  acceptedRollCount: string;
  greyKg: string;
  finishedKg: string;
  rolls: RollRow[];
  legacy: { rolls: string; greyKg: string; finishedKg: string } | null;
};

type RollCut = {
  lineId: string;
  next: number;
  remove: number;
  previous: string;
  openAfter: boolean;
};

type Entry = {
  id: string;
  srNo: string;
  date: string;
  millId: string;
  gpNo: string;
  mill: string;
  knitterChallanNo: string;
  challanNo: string;
  lotNo: string;
  item: string;
  rolls: string;
  greyKg: string;
  finishedKg: string;
  rate: string;
  shortageKg: number;
  shortagePct: number;
  amount: number;
  uniformRate: boolean;
  lines: ItemLine[];
};

const cellInput = `${inputClass} h-8 py-1`;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatKg(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatPct(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function nextSrNo(rows: Entry[], isoDate: string) {
  const stamp = dateStamp(isoDate);
  const used = rows
    .filter((row) => row.srNo.endsWith(`-${stamp}`))
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function emptyRoll(): RollRow {
  return { id: crypto.randomUUID(), greyKg: "", finishedKg: "" };
}

function emptyLine(): ItemLine {
  return {
    id: crypto.randomUUID(),
    itemId: "",
    lotNo: "",
    rate: "",
    rollCount: "",
    acceptedRollCount: "",
    greyKg: "",
    finishedKg: "",
    rolls: [],
    legacy: null,
  };
}

function snapshotRolls(rolls: RollRow[]) {
  return JSON.stringify(rolls.map((roll) => [roll.greyKg, roll.finishedKg]));
}

function focusableIn(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    ),
  ].filter((el) => el.tabIndex !== -1);
}

function cycleFocus(root: HTMLElement, event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const items = focusableIn(root);
  if (items.length === 0) return;
  event.preventDefault();
  event.stopPropagation();
  const current = document.activeElement as HTMLElement | null;
  const index = current ? items.indexOf(current) : -1;
  if (index === -1) {
    items[event.shiftKey ? items.length - 1 : 0]?.focus();
    return;
  }
  const next = event.shiftKey
    ? items[(index - 1 + items.length) % items.length]
    : items[(index + 1) % items.length];
  next?.focus();
}

function parseQty(raw: string) {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function rollState(roll: RollRow) {
  const greyBlank = !roll.greyKg.trim();
  const finishedBlank = !roll.finishedKg.trim();
  if (greyBlank && finishedBlank) return "empty" as const;
  const grey = parseQty(roll.greyKg);
  const finished = parseQty(roll.finishedKg);
  if (
    grey == null ||
    finished == null ||
    grey < 0 ||
    finished < 0 ||
    finished > grey
  ) {
    return "invalid" as const;
  }
  return "valid" as const;
}

function rollProblem(roll: RollRow) {
  if (rollState(roll) !== "invalid") return null;
  const grey = parseQty(roll.greyKg);
  const finished = parseQty(roll.finishedKg);
  if (grey != null && grey < 0) return "“Grey KG” can't be less than 0.";
  if (finished != null && finished < 0) return "“Finished KG” can't be less than 0.";
  if (grey != null && finished != null && finished > grey) {
    return "“Finished KG” can't be more than “Grey KG” — check the weights.";
  }
  return "Enter “Grey KG” and “Finished KG” for each roll.";
}

function rollTotals(rolls: RollRow[]) {
  let grey = 0;
  let finished = 0;
  for (const roll of rolls) {
    if (rollState(roll) !== "valid") continue;
    grey += num(roll.greyKg);
    finished += num(roll.finishedKg);
  }
  return { grey, finished };
}

function hasSavedRolls(line: ItemLine) {
  return line.rolls.some((roll) => rollState(roll) === "valid");
}

function lineFigures(line: ItemLine) {
  if (hasSavedRolls(line)) {
    const totals = rollTotals(line.rolls);
    return { grey: totals.grey, finished: totals.finished, fromRolls: true };
  }
  return {
    grey: num(line.greyKg),
    finished: num(line.finishedKg),
    fromRolls: false,
  };
}

function aggregateWeightProblem(line: ItemLine) {
  if (hasSavedRolls(line)) return null;
  if (!line.greyKg.trim() && !line.finishedKg.trim()) return null;
  const grey = parseQty(line.greyKg);
  const finished = parseQty(line.finishedKg);
  if (!line.greyKg.trim()) return "Enter “Grey KG”.";
  if (!line.finishedKg.trim()) return "Enter “Finished KG”.";
  if (grey == null || grey < 0) return "“Grey KG” can't be less than 0.";
  if (finished == null || finished < 0) return "“Finished KG” can't be less than 0.";
  if (finished > grey) return "“Finished KG” can't be more than “Grey KG” — check the weights.";
  return null;
}

function displayRollCount(line: ItemLine) {
  const count = Number(line.rollCount);
  if (line.rollCount.trim() && Number.isInteger(count) && count >= 0) return count;
  if (hasSavedRolls(line)) {
    return line.rolls.filter((roll) => rollState(roll) === "valid").length;
  }
  return 0;
}

function rollCountValue(raw: string) {
  if (!raw.trim()) return null;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 0) return null;
  return count;
}

function lineStarted(line: ItemLine) {
  return Boolean(
    line.itemId ||
      line.lotNo.trim() ||
      line.rate.trim() ||
      line.rollCount.trim() ||
      line.greyKg.trim() ||
      line.finishedKg.trim() ||
      line.legacy ||
      line.rolls.some((roll) => rollState(roll) !== "empty"),
  );
}

function lineTouched(line: ItemLine) {
  return Boolean(
    line.itemId ||
      line.lotNo.trim() ||
      line.rate.trim() ||
      line.rollCount.trim() ||
      line.greyKg.trim() ||
      line.finishedKg.trim() ||
      line.rolls.some((roll) => rollState(roll) !== "empty"),
  );
}

function blankEntry(srNo: string): Entry {
  return {
    id: crypto.randomUUID(),
    srNo,
    date: todayIso(),
    millId: "",
    gpNo: "",
    mill: "",
    knitterChallanNo: "",
    challanNo: "",
    lotNo: "",
    item: "",
    rolls: "",
    greyKg: "",
    finishedKg: "",
    rate: "",
    shortageKg: 0,
    shortagePct: 0,
    amount: 0,
    uniformRate: true,
    lines: [emptyLine()],
  };
}

function toEntry(record: FinishedWorkRecord): Entry {
  const lines =
    record.lines.length > 0
      ? record.lines.map((line) => {
          const count =
            line.rollRows.length > 0 ? String(line.rollRows.length) : line.rolls;
          return {
            id: line.id,
            itemId: line.itemId,
            lotNo: line.lotNo,
            rate: line.rate,
            rollCount: count,
            acceptedRollCount: count,
            greyKg: line.greyKg,
            finishedKg: line.finishedKg,
            rolls: line.rollRows.map((roll) => ({
              id: roll.id,
              greyKg: roll.greyKg,
              finishedKg: roll.finishedKg,
            })),
            legacy: null,
          };
        })
      : [
          {
            id: crypto.randomUUID(),
            itemId: "",
            lotNo: record.lotNo,
            rate: record.rate,
            rollCount: record.rolls,
            acceptedRollCount: record.rolls,
            greyKg: record.greyKg,
            finishedKg: record.finishedKg,
            rolls: [],
            legacy: {
              rolls: record.rolls,
              greyKg: record.greyKg,
              finishedKg: record.finishedKg,
            },
          },
        ];
  return {
    id: record.id,
    srNo: record.srNo,
    date: record.date,
    millId: record.millId,
    gpNo: record.gpNo,
    mill: record.mill,
    knitterChallanNo: record.knitterChallanNo,
    challanNo: record.challanNo,
    lotNo: record.lotNo,
    item: record.item,
    rolls: record.rolls,
    greyKg: record.greyKg,
    finishedKg: record.finishedKg,
    rate: record.rate,
    shortageKg: record.shortageKg,
    shortagePct: record.shortagePct,
    amount: record.amount,
    uniformRate: record.uniformRate,
    lines,
  };
}

function toInput(entry: Entry): FinishedWorkInput {
  return {
    workDate: entry.date,
    millId: entry.millId,
    gpNo: entry.gpNo,
    knitterChallanNo: entry.knitterChallanNo,
    challanNo: entry.challanNo,
    lines: entry.lines.filter(lineTouched).map((line) => {
      const figures = lineFigures(line);
      return {
        itemId: line.itemId,
        lotNo: line.lotNo,
        rate: line.rate,
        rollCount: line.rollCount,
        greyKg: figures.fromRolls ? String(figures.grey) : line.greyKg,
        finishedKg: figures.fromRolls ? String(figures.finished) : line.finishedKg,
        rolls: line.rolls
          .filter((roll) => rollState(roll) === "valid")
          .map((roll) => ({
            greyKg: roll.greyKg.trim(),
            finishedKg: roll.finishedKg.trim(),
          })),
      };
    }),
  };
}

function isLegacyHold(entry: Entry, mode: "create" | "edit") {
  if (mode !== "edit") return false;
  if (entry.lines.some((line) => line.rolls.some((roll) => rollState(roll) !== "empty"))) {
    return false;
  }
  const started = entry.lines.filter(lineStarted);
  if (started.length > 1) return false;
  return entry.lines.some((line) => line.legacy != null);
}

/* ---------------------------------------------------------------------
   Presentation finished work.

   Eighteen entries so the register reads as a working desk. Whatever is in
   the database is ignored here on purpose: the walkthrough needs a fixed,
   matched set that reads the same every time. Restore the real list by
   returning `real` from padEntries.

   These continue the chain: the same mill / item / roll combinations that
   ran through Purchase Order, Grey Purchase, Mill Inward and Mill Program
   come back finished here, against the same GP and challan numbers.

   Shortage is real, not decoration: grey kg goes in, slightly less finished
   kg comes out, and the page derives shortage kg and percent from the two.
   A roll leaves at 25 kg and returns a little lighter after processing.
--------------------------------------------------------------------- */
const FW_KG_PER_ROLL = 25;

const FW_PRESENTATION_SPECS: {
  mill: string;
  item: string;
  rolls: number;
  /** kg recovered per roll after finishing, below the 25 that went in */
  finishedPerRoll: number;
  rate: number;
  lotNo: string;
}[] = [
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "US POLO", rolls: 72, finishedPerRoll: 24.4, rate: 265, lotNo: "L-4401" },
  { mill: "Shree Balaji Textile Mills", item: "VALENTINO", rolls: 48, finishedPerRoll: 24.1, rate: 278, lotNo: "L-4412" },
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "FRENCH RIB", rolls: 60, finishedPerRoll: 24.6, rate: 252, lotNo: "L-4423" },
  { mill: "Navkar Processing Mills", item: "PEANUT SPANDEX", rolls: 36, finishedPerRoll: 23.8, rate: 294, lotNo: "L-4434" },
  { mill: "Shree Balaji Textile Mills", item: "TWILL", rolls: 84, finishedPerRoll: 24.5, rate: 238, lotNo: "L-4445" },
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "Poly Knit", rolls: 24, finishedPerRoll: 24.2, rate: 286, lotNo: "L-4456" },
  { mill: "Navkar Processing Mills", item: "DOUBLE MALTY", rolls: 96, finishedPerRoll: 24.3, rate: 245, lotNo: "L-4467" },
  { mill: "Shree Balaji Textile Mills", item: "SCRAMBLE", rolls: 54, finishedPerRoll: 24.7, rate: 271, lotNo: "L-4478" },
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "MARIO RIB", rolls: 42, finishedPerRoll: 24.0, rate: 259, lotNo: "L-4489" },
  { mill: "Navkar Processing Mills", item: "PEARL MALTY", rolls: 66, finishedPerRoll: 24.4, rate: 282, lotNo: "L-4500" },
  { mill: "Shree Balaji Textile Mills", item: "FURRY", rolls: 30, finishedPerRoll: 23.9, rate: 308, lotNo: "L-4511" },
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "Cotton Lycra", rolls: 78, finishedPerRoll: 24.6, rate: 255, lotNo: "L-4522" },
  { mill: "Navkar Processing Mills", item: "Rib Knit Fabric", rolls: 90, finishedPerRoll: 24.5, rate: 248, lotNo: "L-4533" },
  { mill: "Shree Balaji Textile Mills", item: "TWILL", rolls: 45, finishedPerRoll: 24.2, rate: 241, lotNo: "L-4544" },
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "US POLO", rolls: 63, finishedPerRoll: 24.4, rate: 268, lotNo: "L-4555" },
  { mill: "Navkar Processing Mills", item: "VALENTINO", rolls: 51, finishedPerRoll: 24.1, rate: 284, lotNo: "L-4566" },
  { mill: "Shree Balaji Textile Mills", item: "FRENCH RIB", rolls: 33, finishedPerRoll: 24.6, rate: 256, lotNo: "L-4577" },
  { mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "PEARL MALTY", rolls: 57, finishedPerRoll: 24.3, rate: 276, lotNo: "L-4588" },
];

function fwIso(daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The register shows the presentation entries and nothing else. */
function padEntries(_real: Entry[]): Entry[] {
  return FW_PRESENTATION_SPECS.map((spec, index) => {
    const iso = fwIso(index);
    const [yyyy, mm, dd] = iso.split("-");
    const greyKg = spec.rolls * FW_KG_PER_ROLL;
    const finishedKg = Math.round(spec.rolls * spec.finishedPerRoll * 1000) / 1000;
    const shortageKg = Math.round((greyKg - finishedKg) * 1000) / 1000;
    const shortagePct = Math.round((shortageKg / greyKg) * 10000) / 100;
    const amount = Math.round(finishedKg * spec.rate * 100) / 100;

    const rolls: RollRow[] = Array.from({ length: spec.rolls }, (_, i) => ({
      id: `fw-demo-${index + 1}-r${i + 1}`,
      greyKg: FW_KG_PER_ROLL.toFixed(3),
      finishedKg: spec.finishedPerRoll.toFixed(3),
    }));

    return {
      id: `fw-demo-${index + 1}`,
      srNo: `${String(index + 1).padStart(3, "0")}-${dd}${mm}${yyyy}`,
      date: iso,
      millId: "",
      gpNo: `${String(index + 1).padStart(3, "0")}-${dd}${mm}${yyyy}`,
      mill: spec.mill,
      knitterChallanNo: `KC${2100 + index * 9}`,
      challanNo: `C${4400 + index * 11}`,
      lotNo: spec.lotNo,
      item: spec.item,
      rolls: String(spec.rolls),
      greyKg: greyKg.toFixed(3),
      finishedKg: finishedKg.toFixed(3),
      rate: spec.rate.toFixed(2),
      shortageKg,
      shortagePct,
      amount,
      uniformRate: true,
      lines: [
        {
          id: `fw-demo-${index + 1}-l1`,
          itemId: "",
          lotNo: spec.lotNo,
          rate: spec.rate.toFixed(2),
          rollCount: String(spec.rolls),
          acceptedRollCount: String(spec.rolls),
          greyKg: greyKg.toFixed(3),
          finishedKg: finishedKg.toFixed(3),
          rolls,
          legacy: null,
        },
      ],
    } satisfies Entry;
  });
}

/* TEMPORARY - presentation build only. See the note on the Grey Purchase
   desk: padEntries()' invented ids exist nowhere in the database. A real id
   still goes to the server. */
function isPresentationRow(id: string) {
  return id.startsWith("fw-demo-");
}

const RESCUE_KEY = "finished-work";

export function FinishedWorkDesk({
  entries,
  mills,
  items,
}: {
  entries: FinishedWorkRecord[];
  mills: MasterOption[];
  items: MasterOption[];
}) {
  const [rows, setRows] = useState<Entry[]>(() => padEntries(entries.map(toEntry)));
  const [draft, setDraft] = useState<Entry | null>(null);
  const rescued = useRescuedDraft<{ mode: "create" | "edit"; entry: Entry }>(
    RESCUE_KEY,
  );
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* raised when a save is refused, so the empty required fields mark */
  const [validated, setValidated] = useState(false);
  /* the line whose roll count blocked Details from opening */
  const [rollCountFlag, setRollCountFlag] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  const [detailLineId, setDetailLineId] = useState<string | null>(null);
  const [rollDraft, setRollDraft] = useState<RollRow[] | null>(null);
  const [rollBaseline, setRollBaseline] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailDiscard, setDetailDiscard] = useState(false);
  const [rollCut, setRollCut] = useState<RollCut | null>(null);
  const savingRef = useRef(false);
  const detailRootRef = useRef<HTMLDivElement>(null);
  const confirmRootRef = useRef<HTMLDivElement>(null);
  const openingDetails = useRef(false);
  const pendingLineFocus = useRef<string | null>(null);
  const pendingRollFocus = useRef<string | null>(null);

  const today = todayIso();
  const totals = useMemo(() => {
    const todayCount = rows.filter((row) => row.date === today).length;
    let grey = 0;
    let finished = 0;
    let shortage = 0;
    for (const row of rows) {
      grey += num(row.greyKg);
      finished += num(row.finishedKg);
      shortage += Math.max(0, row.shortageKg);
    }
    return { todayCount, grey, finished, shortage };
  }, [rows, today]);

  const draftTotals = useMemo(() => {
    if (!draft) return null;
    let rolls = 0;
    let grey = 0;
    let finished = 0;
    let amount = 0;
    for (const line of draft.lines) {
      const figures = lineFigures(line);
      rolls += displayRollCount(line);
      grey += figures.grey;
      finished += figures.finished;
      amount += figures.finished * num(line.rate);
    }
    const shortageKg = grey - finished;
    const shortagePct = grey > 0 ? (shortageKg / grey) * 100 : 0;
    return { rolls, grey, finished, amount, shortageKg, shortagePct };
  }, [draft]);

  const millOptions = useMemo(
    () => [...mills].sort((a, b) => a.name.localeCompare(b.name)),
    [mills],
  );
  const itemOptions = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  const detailLine = draft?.lines.find((line) => line.id === detailLineId) ?? null;
  const weightIssue = draft?.lines
    .map((line) => aggregateWeightProblem(line))
    .find((problem) => problem != null);

  useEffect(() => {
    const lineId = pendingLineFocus.current;
    if (lineId) {
      const el = document.querySelector<HTMLElement>(
        `[data-item-select="${lineId}"] input`,
      );
      if (el) {
        pendingLineFocus.current = null;
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        el.focus();
      }
    }
    const rollId = pendingRollFocus.current;
    if (rollId) {
      const el = document.querySelector<HTMLInputElement>(`[data-roll-grey="${rollId}"]`);
      if (el) {
        pendingRollFocus.current = null;
        el.focus();
      }
    }
  });

  useEffect(() => {
    if (!detailLineId || detailDiscard || !rollDraft) return;
    const root = detailRootRef.current;
    if (!root) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestCloseDetails();
        return;
      }
      if (!root) return;
      cycleFocus(root, event);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    if (!detailDiscard && !rollCut) return;
    const root = confirmRootRef.current;
    if (!root) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (detailDiscard) setDetailDiscard(false);
        else cancelRollCut();
        return;
      }
      if (!root) return;
      cycleFocus(root, event);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  function patch(partial: Partial<Entry>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function patchLine(id: string, partial: Partial<ItemLine>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lines: prev.lines.map((line) => (line.id === id ? { ...line, ...partial } : line)),
      };
    });
    setError(null);
  }

  function openCreate() {
    setDraft(blankEntry(nextSrNo(rows, todayIso())));
    setMode("create");
    setDetailLineId(null);
    setError(null);
    setValidated(false);
    setRollCountFlag(null);
  }

  function openEdit(row: Entry) {
    setDraft({ ...row, lines: row.lines.map((line) => ({ ...line })) });
    setMode("edit");
    setDetailLineId(null);
    setError(null);
    setValidated(false);
    setRollCountFlag(null);
  }

  function closeModal() {
    setDraft(null);
    setMode(null);
    setDetailLineId(null);
    setRollDraft(null);
    setDetailDiscard(false);
    setRollCut(null);
    setError(null);
    setValidated(false);
    setRollCountFlag(null);
  }

  const unsaved = useUnsavedClose({
    active: mode != null && draft != null,
    current: draft,
    onDiscard: closeModal,
  });

  function addItemRow() {
    if (!draft) return;
    const last = draft.lines[draft.lines.length - 1];
    if (last && !lineStarted(last)) {
      pendingLineFocus.current = last.id;
      setDraft({ ...draft });
      return;
    }
    const created = emptyLine();
    pendingLineFocus.current = created.id;
    patch({ lines: [...draft.lines, created] });
  }

  function deleteLine(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const remaining = prev.lines.filter((line) => line.id !== id);
      return {
        ...prev,
        lines: remaining.length > 0 ? remaining : [emptyLine()],
      };
    });
    if (detailLineId === id) setDetailLineId(null);
    setError(null);
  }

  function focusRollCount(lineId: string) {
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-roll-count="${lineId}"]`)?.focus();
    });
  }

  function focusDetailsButton(lineId: string) {
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-details="${lineId}"]`)?.focus();
    });
  }

  function withRollCount(line: ItemLine, next: number): Partial<ItemLine> {
    const kept = line.rolls.slice(0, next);
    const count = String(next);
    if (kept.some((roll) => rollState(roll) === "valid")) {
      const totals = rollTotals(kept);
      return {
        rolls: kept.filter((roll) => rollState(roll) !== "empty"),
        rollCount: count,
        acceptedRollCount: count,
        greyKg: String(totals.grey),
        finishedKg: String(totals.finished),
        legacy: null,
      };
    }
    return {
      rolls: [],
      rollCount: count,
      acceptedRollCount: count,
      greyKg: line.rolls.length > 0 ? "" : line.greyKg,
      finishedKg: line.rolls.length > 0 ? "" : line.finishedKg,
      legacy: line.rolls.length > 0 ? null : line.legacy,
    };
  }

  function startDetails(line: ItemLine) {
    const count = rollCountValue(line.rollCount);
    if (count == null || count <= 0) {
      /* mark the row's own field: the banner says what is missing, the red
         border says where. It clears itself as soon as the count is valid. */
      setRollCountFlag(line.id);
      setError("Enter “No. of Rolls” first, for example 25.");
      return;
    }
    setRollCountFlag(null);
    const rows = Array.from({ length: count }, (_, index) => {
      const existing = line.rolls[index];
      return existing
        ? { id: existing.id, greyKg: existing.greyKg, finishedKg: existing.finishedKg }
        : emptyRoll();
    });
    setRollDraft(rows);
    setRollBaseline(snapshotRolls(rows));
    setDetailError(null);
    setDetailDiscard(false);
    setDetailLineId(line.id);
    pendingRollFocus.current = rows[0]?.id ?? null;
  }

  function commitRollCount(line: ItemLine, openAfter: boolean) {
    if (rollCut || (openAfter && detailLineId === line.id)) return;
    const next = rollCountValue(line.rollCount);
    if (next == null || (openAfter && next <= 0)) {
      if (openAfter || line.rollCount.trim()) {
        /* the banner says what is missing; the red border on this row's own
           field says where, so Details not opening explains itself */
        setRollCountFlag(line.id);
        setError(
          openAfter
            ? "Enter “No. of Rolls” first, for example 25."
            : "“No. of Rolls” must be a full number — 25, not 25.5.",
        );
      } else {
        patchLine(line.id, { rollCount: line.acceptedRollCount });
      }
      return;
    }
    setRollCountFlag(null);
    const excess = line.rolls.slice(next);
    if (excess.some((roll) => roll.greyKg.trim() || roll.finishedKg.trim())) {
      setRollCut({
        lineId: line.id,
        next,
        remove: excess.length,
        previous: line.acceptedRollCount,
        openAfter,
      });
      return;
    }
    const partial = withRollCount(line, next);
    const updated = { ...line, ...partial };
    patchLine(line.id, partial);
    if (openAfter) startDetails(updated);
  }

  function cancelRollCut() {
    if (!rollCut) return;
    const lineId = rollCut.lineId;
    patchLine(lineId, { rollCount: rollCut.previous });
    setRollCut(null);
    focusRollCount(lineId);
  }

  function continueRollCut() {
    if (!rollCut || !draft) return;
    const line = draft.lines.find((row) => row.id === rollCut.lineId);
    if (!line) {
      setRollCut(null);
      return;
    }
    const partial = withRollCount(line, rollCut.next);
    const updated = { ...line, ...partial };
    patchLine(line.id, partial);
    const openAfter = rollCut.openAfter;
    setRollCut(null);
    if (openAfter) startDetails(updated);
    else focusRollCount(line.id);
  }

  function requestCloseDetails() {
    if (!rollDraft || detailDiscard) return;
    if (snapshotRolls(rollDraft) === rollBaseline) {
      discardDetails();
      return;
    }
    setDetailDiscard(true);
  }

  function discardDetails() {
    const current = detailLineId;
    setDetailDiscard(false);
    setDetailError(null);
    setRollDraft(null);
    setDetailLineId(null);
    if (current) focusDetailsButton(current);
  }

  function patchRoll(rollId: string, partial: Partial<RollRow>) {
    setRollDraft((prev) =>
      prev
        ? prev.map((roll) => (roll.id === rollId ? { ...roll, ...partial } : roll))
        : prev,
    );
    setDetailError(null);
  }

  function saveDetails() {
    if (!rollDraft || !detailLineId) return;
    for (const roll of rollDraft) {
      const problem = rollProblem(roll);
      if (problem) {
        setDetailError(problem);
        return;
      }
    }
    const valid = rollDraft.filter((roll) => rollState(roll) === "valid");
    if (valid.length === 0) {
      setDetailError("Open Details and enter the weights for each roll.");
      return;
    }
    const totals = rollTotals(valid);
    const count = String(valid.length);
    patchLine(detailLineId, {
      rolls: valid.map((roll) => ({ ...roll })),
      rollCount: count,
      acceptedRollCount: count,
      greyKg: String(totals.grey),
      finishedKg: String(totals.finished),
      legacy: null,
    });
    const current = detailLineId;
    setDetailError(null);
    setDetailDiscard(false);
    setRollDraft(null);
    setDetailLineId(null);
    focusDetailsButton(current);
  }

  function onRollKey(
    index: number,
    field: "grey" | "fin",
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (!rollDraft || event.key !== "Enter") return;
    event.preventDefault();
    const roll = rollDraft[index];
    if (!roll) return;
    if (field === "grey") {
      document.querySelector<HTMLInputElement>(`[data-roll-fin="${roll.id}"]`)?.focus();
      return;
    }
    const next = rollDraft[index + 1];
    if (next) {
      document.querySelector<HTMLInputElement>(`[data-roll-grey="${next.id}"]`)?.focus();
      return;
    }
    document.querySelector<HTMLButtonElement>("[data-save-details]")?.focus();
  }

  function onRateKey(line: ItemLine, index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !draft) return;
    event.preventDefault();
    const next = draft.lines[index + 1];
    if (next) {
      document
        .querySelector<HTMLElement>(`[data-item-select="${next.id}"] input`)
        ?.focus();
      return;
    }
    if (lineStarted(line)) addItemRow();
  }

  function validate(entry: Entry, editing: "create" | "edit") {
    if (!entry.date.trim()) return "Enter date.";
    if (!entry.millId.trim()) return "Select a mill.";
    if (!entry.gpNo.trim()) return "Enter “GP No.”.";
    if (!entry.knitterChallanNo.trim()) return "Enter knitter challan no.";
    if (!entry.challanNo.trim()) return "Enter challan no.";
    if (isLegacyHold(entry, editing)) {
      const line = entry.lines.find((row) => row.legacy) ?? entry.lines[0];
      if (line && !line.itemId.trim()) return "Select an item.";
      if (line && !line.lotNo.trim()) return "Enter “Lot No.”.";
      if (line && !line.rate.trim()) return "Enter “Rate”.";
      const rate = Number(line?.rate);
      if (line && (!Number.isFinite(rate) || rate < 0)) return "“Rate” can't be less than 0.";
      if (line) {
        const weight = aggregateWeightProblem(line);
        if (weight) return weight;
      }
      return null;
    }
    const active = entry.lines.filter(lineTouched);
    if (active.length === 0) return "Add at least one item.";
    const allowed = new Set(itemOptions.map((item) => item.id));
    for (const line of active) {
      if (!line.itemId || (allowed.size > 0 && !allowed.has(line.itemId))) {
        return "Select an item.";
      }
      if (!line.lotNo.trim()) return "Enter “Lot No.”.";
      if (!line.rate.trim()) return "Enter “Rate”.";
      const rate = Number(line.rate);
      if (!Number.isFinite(rate) || rate < 0) return "“Rate” can't be less than 0.";
      const count = rollCountValue(line.rollCount);
      if (line.rollCount.trim() && count == null) {
        return "“No. of Rolls” must be a full number — 25, not 25.5.";
      }
      const weight = aggregateWeightProblem(line);
      if (weight) return weight;
      for (const roll of line.rolls) {
        const problem = rollProblem(roll);
        if (problem) return problem;
      }
    }
    return null;
  }

  function saveEntry() {
    if (!draft || !mode || savingRef.current) return;
    const message = validate(draft, mode);
    if (message) {
      setValidated(true);
      setError(message);
      return;
    }
    const creating = mode === "create";
    const currentId = draft.id;
    if (!creating && isPresentationRow(currentId)) {
      setRows((prev) => prev.map((row) => (row.id === currentId ? draft : row)));
      clearDraft(RESCUE_KEY);
      closeModal();
      setNotice(`${draft.srNo} updated.`);
      return;
    }
    savingRef.current = true;
    setError(null);
    const run = creating
      ? createFinishedWork(toInput(draft))
      : updateFinishedWork(currentId, toInput(draft));
    void run
      .then((result) => {
        const saved = toEntry(result.record);
        setRows((prev) =>
          creating ? [saved, ...prev] : prev.map((row) => (row.id === currentId ? saved : row)),
        );
        clearDraft(RESCUE_KEY);
        closeModal();
        const savedNotice = creating ? `${saved.srNo} saved.` : `${saved.srNo} updated.`;
        setNotice(
          result.linkWarning ? `${savedNotice} ${result.linkWarning}` : savedNotice,
        );
      })
      .catch((err: unknown) => {
        if (mode) stashDraft(RESCUE_KEY, { mode, entry: draft });
        setError(friendlyError(err, "Could not save the finished work."));
      })
      .finally(() => {
        savingRef.current = false;
      });
  }

  const detailTotals = rollDraft ? rollTotals(rollDraft) : null;
  const detailItemName =
    itemOptions.find((item) => item.id === detailLine?.itemId)?.name ||
    draft?.item ||
    "—";

  return (
    <div className="fw-page">
      <div className="fw-stage">
      {notice ? (
        <div className="gb-toast-wrap" role="status" aria-live="polite">
          <div className="gb-toast" data-tone="ok">
            <span className="gb-toast-text">{notice}</span>
            <button
              type="button"
              className="gb-toast-close"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {rescued && !mode ? (
        <div className="aw-rescue" role="status">
          <span className="aw-rescue-text">
            Unsaved Finished Work from {describeAge(rescued.at)}
          </span>
          <button
            type="button"
            className="aw-rescue-go"
            onClick={() => {
              setDraft(rescued.data.entry);
              setMode(rescued.data.mode);
              setError(null);
              setValidated(false);
              clearDraft(RESCUE_KEY);
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="aw-rescue-drop"
            onClick={() => clearDraft(RESCUE_KEY)}
          >
            Discard
          </button>
        </div>
      ) : null}

      <MetricStrip className="fw-metrics grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <Metric
          label="Today's Entries"
          value={totals.todayCount}
          tone={totals.todayCount ? "accent" : "neutral"}
        />
        <Metric label="Total Entries" value={rows.length} />
        <Metric label="Total Grey KG" value={formatKg(totals.grey)} />
        <Metric
          label="Total Finished KG"
          value={formatKg(totals.finished)}
          tone="accent"
        />
        <Metric
          label="Total Shortage KG"
          value={formatKg(totals.shortage)}
          tone={totals.shortage ? "warn" : "neutral"}
        />
      </MetricStrip>

      <Panel
        title="Finished work"
        flush
        className="fw-panel"
        action={
          <button
            className={`${buttonClass} fw-new`}
            type="button"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            New Finished Work
          </button>
        }
      >
        {rows.length === 0 ? (
          <div className="fw-empty">
            <EmptyState icon={Shirt} text="No finished work recorded yet." />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register fw-reg w-full min-w-[78rem] table-fixed">
              <colgroup>
                <col className="w-[6.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[6rem]" />
                <col />
                <col className="w-[6rem]" />
                <col />
                <col className="w-[4rem]" />
                <col className="w-[6.25rem]" />
                <col className="w-[6.75rem]" />
                <col className="w-[6.75rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[7rem]" />
                <col className="w-[4.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Date</th>
                  <th>GP No.</th>
                  <th>Mill</th>
                  <th>Lot No.</th>
                  <th>Item</th>
                  <th className="num">Rolls</th>
                  <th className="num">Grey KG</th>
                  <th className="num">Finished KG</th>
                  <th className="num">Shortage KG</th>
                  <th className="num">Shortage %</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-(--panel-sunken)"
                    onClick={() => openEdit(row)}
                  >
                    <td className="font-semibold tabular-nums">{row.srNo}</td>
                    <td className="tabular-nums">{formatDisplayDate(row.date)}</td>
                    <td>{row.gpNo}</td>
                    <td>{row.mill}</td>
                    <td>{row.lotNo}</td>
                    <td>{row.item}</td>
                    <td className="num tabular-nums">{row.rolls}</td>
                    <td className="num tabular-nums">{formatKg(num(row.greyKg))}</td>
                    <td className="num tabular-nums">{formatKg(num(row.finishedKg))}</td>
                    <td className="num tabular-nums">
                      {formatKg(Math.max(0, row.shortageKg))}
                    </td>
                    <td className="num tabular-nums">
                      {formatPct(Math.max(0, row.shortagePct))}%
                    </td>
                    <td className="num tabular-nums">
                      {row.uniformRate ? formatInr(num(row.rate)) : "—"}
                    </td>
                    <td className="num tabular-nums">{formatInr(row.amount)}</td>
                    <td>
                      <button
                        type="button"
                        className={buttonTinyClass}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="fw-filler" aria-hidden>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {draft && mode && draftTotals ? (
        <Overlay
          portal
          lockScroll
          flushBody
          overlayClassName="fw-sheet-overlay"
          frameWidthClass="fw-sheet"
          closeClassName="gb-sheet-close fw-close"
          title={
            mode === "create"
              ? `New Finished Work ${draft.srNo}`
              : `Finished Work ${draft.srNo}`
          }
          roomy
          trapFocus={detailLineId == null && rollCut == null}
          onClose={unsaved.requestClose}
        >
          <div className="fw-entry" data-validated={validated ? "" : undefined}>
            {error ? (
              <div className="fw-alert" role="alert" key={error}>
                <span className="fw-alert-text">{error}</span>
                <button
                  type="button"
                  className="fw-alert-close"
                  onClick={() => setError(null)}
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
                <i className="fw-alert-timer" aria-hidden />
              </div>
            ) : null}
            <div className="fw-entry-main">

            <FieldGroup label="Receipt details">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Sr. No.">
                  <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                    {draft.srNo}
                  </p>
                </Field>
                <Field label="Date">
                  <input
                    className={inputClass}
                    type="date"
                    required
                    value={draft.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </Field>
                <Field label="GP No.">
                  <input
                    className={inputClass}
                    required
                    value={draft.gpNo}
                    onChange={(e) => patch({ gpNo: e.target.value })}
                  />
                </Field>
                <Field label="Mill Name" className="fw-req">
                  <SearchableSelect
                    value={draft.millId}
                    options={millOptions.map((mill) => ({
                      id: mill.id,
                      label: mill.name,
                    }))}
                    placeholder="Search mill..."
                    onChange={(id) => {
                      const mill = millOptions.find((row) => row.id === id);
                      patch({ millId: id, mill: mill?.name ?? "" });
                    }}
                  />
                </Field>
                <Field label="Knitter Challan No.">
                  <input
                    className={inputClass}
                    required
                    value={draft.knitterChallanNo}
                    onChange={(e) => patch({ knitterChallanNo: e.target.value })}
                  />
                </Field>
                <Field label="Challan No.">
                  <input
                    className={inputClass}
                    required
                    value={draft.challanNo}
                    onChange={(e) => patch({ challanNo: e.target.value })}
                  />
                </Field>
              </div>
            </FieldGroup>

            <FieldGroup label="Fabric details">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] text-(--muted)">
                  Enter no. of rolls, then open Details for each roll.
                </p>
                <button type="button" className={buttonTinyClass} onClick={addItemRow}>
                  + Add Item
                </button>
              </div>
              <div className="fw-items overflow-x-auto rounded-md border border-(--line)">
                <table className="erp-table table-fixed min-w-[58rem]">
                  <colgroup>
                    <col className="w-11" />
                    <col />
                    <col className="w-[7rem]" />
                    <col className="w-[6.5rem]" />
                    <col className="w-[5.5rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[6.5rem]" />
                    <col className="w-[8rem]" />
                    <col className="w-9" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="text-center">Sr.</th>
                      <th>Item Name</th>
                      <th>Lot No.</th>
                      <th className="num">No. of Rolls</th>
                      <th className="text-center">Details</th>
                      <th className="num">Grey KG</th>
                      <th className="num">Finished KG</th>
                      <th className="num">Rate</th>
                      <th className="num">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((line, index) => {
                      const figures = lineFigures(line);
                      const amount = figures.finished * num(line.rate);
                      const locked = figures.fromRolls;
                      return (
                        <tr key={line.id}>
                          <td className="text-center tabular-nums text-(--muted)">
                            {index + 1}
                          </td>
                          <td data-item-select={line.id}>
                            <SearchableSelect
                              value={line.itemId}
                              options={itemOptions.map((item) => ({
                                id: item.id,
                                label: item.name,
                              }))}
                              placeholder="Search item..."
                              onChange={(id) => patchLine(line.id, { itemId: id })}
                            />
                          </td>
                          <td>
                            <input
                              className={cellInput}
                              value={line.lotNo}
                              onChange={(e) => patchLine(line.id, { lotNo: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              data-roll-count={line.id}
                              data-invalid={
                                rollCountFlag === line.id &&
                                (rollCountValue(line.rollCount) ?? 0) <= 0
                                  ? ""
                                  : undefined
                              }
                              className={`${cellInput} text-right`}
                              inputMode="numeric"
                              value={line.rollCount}
                              onChange={(e) => patchLine(line.id, { rollCount: e.target.value })}
                              onBlur={() => {
                                const openAfter = openingDetails.current;
                                openingDetails.current = false;
                                commitRollCount(line, openAfter);
                              }}
                            />
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              data-details={line.id}
                              className={buttonTinyClass}
                              onMouseDown={() => {
                                openingDetails.current = true;
                              }}
                              onClick={() => {
                                openingDetails.current = false;
                                commitRollCount(line, true);
                              }}
                            >
                              Details
                            </button>
                          </td>
                          <td>
                            {locked ? (
                              <p className="px-1 text-right text-[12px] font-medium tabular-nums">
                                {formatKg(figures.grey)}
                              </p>
                            ) : (
                              <input
                                className={`${cellInput} text-right`}
                                inputMode="decimal"
                                value={line.greyKg}
                                onChange={(e) => patchLine(line.id, { greyKg: e.target.value })}
                              />
                            )}
                          </td>
                          <td>
                            {locked ? (
                              <p className="px-1 text-right text-[12px] font-medium tabular-nums">
                                {formatKg(figures.finished)}
                              </p>
                            ) : (
                              <input
                                className={`${cellInput} text-right`}
                                inputMode="decimal"
                                value={line.finishedKg}
                                onChange={(e) =>
                                  patchLine(line.id, { finishedKg: e.target.value })
                                }
                              />
                            )}
                          </td>
                          <td>
                            <input
                              className={`${cellInput} text-right`}
                              inputMode="decimal"
                              value={line.rate}
                              onChange={(e) => patchLine(line.id, { rate: e.target.value })}
                              onKeyDown={(e) => onRateKey(line, index, e)}
                            />
                          </td>
                          <td className="num tabular-nums font-medium">{formatInr(amount)}</td>
                          <td>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--muted) hover:bg-(--danger-soft) hover:text-(--danger)"
                              aria-label="Remove item"
                              onClick={() => deleteLine(line.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="fw-item-filler" aria-hidden>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="border-t border-(--line) bg-(--panel-alt)" />
                      <td className="border-t border-(--line) bg-(--panel-alt) font-semibold">
                        TOTAL
                      </td>
                      <td className="border-t border-(--line) bg-(--panel-alt)" />
                      <td className="num sticky bottom-0 border-t border-(--line) bg-(--panel-alt) font-semibold tabular-nums">
                        {draftTotals.rolls}
                      </td>
                      <td className="sticky bottom-0 border-t border-(--line) bg-(--panel-alt)" />
                      <td className="num sticky bottom-0 border-t border-(--line) bg-(--panel-alt) font-semibold tabular-nums">
                        {formatKg(draftTotals.grey)}
                      </td>
                      <td className="num sticky bottom-0 border-t border-(--line) bg-(--panel-alt) font-semibold tabular-nums">
                        {formatKg(draftTotals.finished)}
                      </td>
                      <td className="sticky bottom-0 border-t border-(--line) bg-(--panel-alt)" />
                      <td className="num sticky bottom-0 border-t border-(--line) bg-(--panel-alt) font-semibold tabular-nums">
                        {formatInr(draftTotals.amount)}
                      </td>
                      <td className="border-t border-(--line) bg-(--panel-alt)" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Shortage KG">
                  <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                    {weightIssue
                      ? "—"
                      : `${formatKg(Math.max(0, draftTotals.shortageKg))} KG`}
                  </p>
                </Field>
                <Field label="Shortage %">
                  <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                    {weightIssue
                      ? "—"
                      : `${formatPct(Math.max(0, draftTotals.shortagePct))}%`}
                  </p>
                </Field>
              </div>
              {/* always rendered: a validation line that appears and
                  disappears must not resize the sheet */}
              <p
                className="fw-weight-issue text-[11px] text-(--danger)"
                role="status"
                aria-live="polite"
              >
                {weightIssue ?? ""}
              </p>
            </FieldGroup>
            </div>

            <div className="fw-foot">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={Boolean(weightIssue)}
                onClick={saveEntry}
              >
                Save Finished Work
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {detailLine && rollDraft && detailTotals ? createPortal((
        <div className="fw-roll-overlay fixed inset-0 z-[60] flex items-center justify-center px-[4vw] py-8">
          <div
            ref={detailRootRef}
            role="dialog"
            aria-modal="true"
            aria-label="Roll / Takka Details"
            className="fw-roll-sheet flex max-h-[calc(100vh-4rem)] w-[min(28rem,92vw)] flex-col overflow-hidden rounded-xl border border-(--line) bg-(--panel) shadow-(--shadow-sm)"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-(--line) px-4 py-2">
              <h2 className="text-[14px] font-semibold">Roll / Takka Details</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {detailError ? (
                <p className="mb-2 rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                  {detailError}
                </p>
              ) : null}
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-(--line) bg-(--panel-alt) px-3 py-2 text-[12px]">
                <div>
                  <span className="text-[11px] text-(--muted)">Item Name</span>
                  <p className="truncate font-medium">{detailItemName}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-(--muted)">Lot No.</span>
                  <p className="truncate font-medium">{detailLine.lotNo || "—"}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-(--line)">
                <table className="erp-table table-fixed">
                  <colgroup>
                    <col className="w-14" />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="text-center">Sr.</th>
                      <th className="num">G. Qty</th>
                      <th className="num">F. Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollDraft.map((roll, index) => (
                      <tr key={roll.id}>
                        <td className="text-center tabular-nums text-(--muted)">{index + 1}</td>
                        <td className="py-1">
                          <input
                            data-roll-grey={roll.id}
                            className={`${inputClass} h-8 py-1 text-right`}
                            inputMode="decimal"
                            value={roll.greyKg}
                            onChange={(e) => patchRoll(roll.id, { greyKg: e.target.value })}
                            onKeyDown={(e) => onRollKey(index, "grey", e)}
                          />
                        </td>
                        <td className="py-1">
                          <input
                            data-roll-fin={roll.id}
                            className={`${inputClass} h-8 py-1 text-right`}
                            inputMode="decimal"
                            value={roll.finishedKg}
                            onChange={(e) => patchRoll(roll.id, { finishedKg: e.target.value })}
                            onKeyDown={(e) => onRollKey(index, "fin", e)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="border-t border-(--line) bg-(--panel-alt) text-center font-semibold">
                        TOTAL
                      </td>
                      <td className="border-t border-(--line) bg-(--panel-alt) text-right font-semibold tabular-nums">
                        {formatKg(detailTotals.grey)}
                      </td>
                      <td className="border-t border-(--line) bg-(--panel-alt) text-right font-semibold tabular-nums">
                        {formatKg(detailTotals.finished)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="fw-roll-foot flex shrink-0 justify-end gap-1.5 border-t border-(--line) px-4 py-2.5">
              <button type="button" className={buttonGhostClass} onClick={requestCloseDetails}>
                Cancel
              </button>
              <button
                type="button"
                data-save-details
                className={buttonClass}
                onClick={saveDetails}
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      ), document.body) : null}

      {detailDiscard ? createPortal((
        <div className="fw-confirm-overlay fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            ref={confirmRootRef}
            data-modal-confirm
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-(--line) bg-(--panel) p-4 shadow-(--shadow-sm)"
          >
            <p className="text-[13px] text-(--ink)">Discard unsaved roll/takka changes?</p>
            <div className="mt-4 flex justify-end gap-1.5">
              <button
                type="button"
                className={buttonClass}
                onClick={() => setDetailDiscard(false)}
              >
                Continue Editing
              </button>
              <button type="button" className={buttonGhostClass} onClick={discardDetails}>
                Discard
              </button>
            </div>
          </div>
        </div>
      ), document.body) : null}

      {rollCut ? createPortal((
        <div className="fw-confirm-overlay fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            ref={confirmRootRef}
            data-modal-confirm
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-(--line) bg-(--panel) p-4 shadow-(--shadow-sm)"
          >
            <p className="text-[13px] text-(--ink)">
              Reducing the roll count will remove the last {rollCut.remove} roll{" "}
              {rollCut.remove === 1 ? "entry" : "entries"}. Continue?
            </p>
            <div className="mt-4 flex justify-end gap-1.5">
              <button type="button" className={buttonGhostClass} onClick={cancelRollCut}>
                Cancel
              </button>
              <button type="button" className={buttonClass} onClick={continueRollCut}>
                Continue
              </button>
            </div>
          </div>
        </div>
      ), document.body) : null}
      </div>
    </div>
  );
}
