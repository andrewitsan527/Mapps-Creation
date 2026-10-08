"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Shirt, Trash2 } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { useUnsavedClose } from "@/components/unsaved-changes";
import {
  EmptyState,
  Field,
  FieldGroup,
  Metric,
  MetricStrip,
  PageHeader,
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
  if (grey != null && grey < 0) return "Grey KG cannot be negative.";
  if (finished != null && finished < 0) return "Finished KG cannot be negative.";
  if (grey != null && finished != null && finished > grey) {
    return "Finished KG cannot be greater than Grey KG.";
  }
  return "Enter grey KG and finished KG for each roll.";
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
  if (!line.greyKg.trim()) return "Enter grey KG.";
  if (!line.finishedKg.trim()) return "Enter finished KG.";
  if (grey == null || grey < 0) return "Grey KG cannot be negative.";
  if (finished == null || finished < 0) return "Finished KG cannot be negative.";
  if (finished > grey) return "Finished KG cannot be greater than Grey KG.";
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

export function FinishedWorkDesk({
  entries,
  mills,
  items,
}: {
  entries: FinishedWorkRecord[];
  mills: MasterOption[];
  items: MasterOption[];
}) {
  const [rows, setRows] = useState<Entry[]>(() => entries.map(toEntry));
  const [draft, setDraft] = useState<Entry | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  }

  function openEdit(row: Entry) {
    setDraft({ ...row, lines: row.lines.map((line) => ({ ...line })) });
    setMode("edit");
    setDetailLineId(null);
    setError(null);
  }

  function closeModal() {
    setDraft(null);
    setMode(null);
    setDetailLineId(null);
    setRollDraft(null);
    setDetailDiscard(false);
    setRollCut(null);
    setError(null);
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
      setError("No. of rolls must be a whole number greater than zero.");
      return;
    }
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
        setError(
          openAfter
            ? "No. of rolls must be a whole number greater than zero."
            : "No. of rolls must be a whole number.",
        );
      } else {
        patchLine(line.id, { rollCount: line.acceptedRollCount });
      }
      return;
    }
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
      setDetailError("Enter roll details.");
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
    if (!entry.gpNo.trim()) return "Enter GP No.";
    if (!entry.knitterChallanNo.trim()) return "Enter knitter challan no.";
    if (!entry.challanNo.trim()) return "Enter challan no.";
    if (isLegacyHold(entry, editing)) {
      const line = entry.lines.find((row) => row.legacy) ?? entry.lines[0];
      if (line && !line.itemId.trim()) return "Select an item.";
      if (line && !line.lotNo.trim()) return "Enter lot no.";
      if (line && !line.rate.trim()) return "Enter rate.";
      const rate = Number(line?.rate);
      if (line && (!Number.isFinite(rate) || rate < 0)) return "Rate cannot be negative.";
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
      if (!line.lotNo.trim()) return "Enter lot no.";
      if (!line.rate.trim()) return "Enter rate.";
      const rate = Number(line.rate);
      if (!Number.isFinite(rate) || rate < 0) return "Rate cannot be negative.";
      const count = rollCountValue(line.rollCount);
      if (line.rollCount.trim() && count == null) {
        return "No. of rolls must be a whole number.";
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
      setError(message);
      return;
    }
    const creating = mode === "create";
    const currentId = draft.id;
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
        closeModal();
        const savedNotice = creating ? `${saved.srNo} saved.` : `${saved.srNo} updated.`;
        setNotice(
          result.linkWarning ? `${savedNotice} ${result.linkWarning}` : savedNotice,
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the finished work.");
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
    <div className="space-y-3">
      <PageHeader
        title="Finished Work"
        eyebrow="Produce"
        icon={Shirt}
        description="Record finished fabric received back from the mill."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            New Finished Work
          </button>
        }
      />

      {notice ? (
        <div className="flex items-center justify-between rounded-md border border-(--line) bg-(--panel-alt) px-2.5 py-1.5 text-[12px]">
          <span>{notice}</span>
          <button
            type="button"
            className={buttonTinyClass}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <MetricStrip className="grid-cols-2 sm:grid-cols-5">
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

      <Panel title="Finished work" flush>
        {rows.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Shirt} text="No finished work recorded yet." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
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
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {draft && mode && draftTotals ? (
        <Overlay
          title={
            mode === "create"
              ? `New Finished Work ${draft.srNo}`
              : `Finished Work ${draft.srNo}`
          }
          roomy
          trapFocus={detailLineId == null && rollCut == null}
          onClose={unsaved.requestClose}
        >
          <div className="space-y-2 px-4 py-2.5">
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}

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
                    value={draft.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </Field>
                <Field label="GP No.">
                  <input
                    className={inputClass}
                    value={draft.gpNo}
                    onChange={(e) => patch({ gpNo: e.target.value })}
                  />
                </Field>
                <Field label="Mill Name">
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
                    value={draft.knitterChallanNo}
                    onChange={(e) => patch({ knitterChallanNo: e.target.value })}
                  />
                </Field>
                <Field label="Challan No.">
                  <input
                    className={inputClass}
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
              <div className="overflow-x-auto rounded-md border border-(--line)">
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
              {weightIssue ? (
                <p className="text-[11px] text-(--danger)">{weightIssue}</p>
              ) : null}
            </FieldGroup>

            <div className="sticky bottom-0 -mx-4 flex justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
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

      {detailLine && rollDraft && detailTotals ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[4vw] py-8">
          <div
            ref={detailRootRef}
            role="dialog"
            aria-modal="true"
            aria-label="Roll / Takka Details"
            className="flex max-h-[calc(100vh-4rem)] w-[min(28rem,92vw)] flex-col overflow-hidden rounded-xl border border-(--line) bg-(--panel) shadow-(--shadow-sm)"
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
            <div className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
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
      ) : null}

      {detailDiscard ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
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
      ) : null}

      {rollCut ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
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
      ) : null}
    </div>
  );
}