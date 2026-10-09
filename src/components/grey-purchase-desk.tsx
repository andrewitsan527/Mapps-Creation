"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
import {
  EmptyState,
  Field,
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
  attachGreyBillDocument,
  createGreyBill,
  deleteGreyBill,
  updateGreyBill,
  type GreyBillDocumentLink,
  type GreyBillInput,
  type GreyBillItemRecord,
  type GreyBillRecord,
} from "@/server/actions/grey-bills";
import type { ItemRecord } from "@/server/actions/items";
import type { KnitterRecord } from "@/server/actions/knitters";
import { ensureMillInwardFromGreyBill } from "@/server/actions/mill-inward-entries";
import type { MillRecord } from "@/server/actions/mills";
import type { PurchaseOrderRecord } from "@/server/actions/purchase-orders";
import { GreyChallanUploadButton } from "@/components/grey-purchase-upload-test";
import type { GreyBillExtract } from "@/lib/grey-upload-check";
import {
  extractGreyPurchaseBill,
  extractGreyPurchaseChallan,
} from "@/server/actions/grey-document-test";

type DraftItem = GreyBillItemRecord;
type DraftRoll = { id: string; weight: string };
type Draft = GreyBillRecord;

const SGST_PCT = 0.025;
const CGST_PCT = 0.025;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nextSrNo(srNos: string[], isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  const stamp = `${d}${m}${y}`;
  const used = srNos
    .filter((srNo) => srNo.endsWith(`-${stamp}`))
    .map((srNo) => Number(srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function rupee(n: number) {
  return Math.round(n);
}

function isValidNumericEntry(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return /^\d*\.?\d*$/.test(trimmed);
}

function formatEnteredDecimal(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!isValidNumericEntry(trimmed)) return trimmed;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  if (!trimmed.includes(".") && Number.isInteger(n)) return n.toFixed(2);
  return trimmed;
}

function formatWeightKg(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || !isValidNumericEntry(trimmed)) return trimmed;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  return n.toFixed(3);
}

function numericInputClass(value: string, base: string) {
  if (isValidNumericEntry(value)) return base;
  return `${base} border-red-500 bg-red-50 ring-1 ring-red-500`;
}

function formatRupeeAmount(n: number) {
  return `₹${rupee(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatKg(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function emptyItem(): DraftItem {
  return {
    id: crypto.randomUUID(),
    itemId: "",
    itemName: "",
    rolls: "",
    qty: "",
    rate: "",
    amount: 0,
  };
}

function emptyRoll(): DraftRoll {
  return { id: crypto.randomUUID(), weight: "" };
}

function requiredRollCount(items: DraftItem[]) {
  return items.reduce((sum, item) => {
    const n = Number(item.rolls);
    if (!Number.isFinite(n) || n <= 0) return sum;
    return sum + Math.floor(n);
  }, 0);
}

function syncRollsToCount(rolls: DraftRoll[], count: number) {
  const n = count > 0 ? count : 1;
  if (rolls.length === n) return rolls;
  if (rolls.length < n) {
    return [
      ...rolls,
      ...Array.from({ length: n - rolls.length }, () => emptyRoll()),
    ];
  }
  return rolls.slice(0, n);
}

function itemHasEntry(item: DraftItem) {
  return Boolean(
    item.itemId ||
      item.itemName.trim() ||
      item.rolls.trim() ||
      item.qty.trim() ||
      item.rate.trim(),
  );
}

function rollStats(rolls: DraftRoll[]) {
  const filled = rolls.filter((roll) => roll.weight.trim() !== "");
  const totalWeight = filled.reduce((sum, roll) => sum + num(roll.weight), 0);
  return { totalRolls: filled.length, totalWeight };
}

function moneyFor(draft: Draft) {
  const named = draft.items.filter(itemHasEntry);
  const lines = named.map((item) => ({
    ...item,
    amount: rupee(num(item.qty) * num(item.rate)),
  }));
  const goodsAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const itemKg = named.reduce((sum, item) => sum + num(item.qty), 0);
  const rollKg = rollStats(draft.rolls).totalWeight;
  const totalKg = rollKg > 0 ? rollKg : itemKg;
  const freightAmount = rupee(num(draft.freightRate) * totalKg);
  const taxableAmount = rupee(goodsAmount + freightAmount);
  const sgstAmount = rupee(taxableAmount * SGST_PCT);
  const cgstAmount = rupee(taxableAmount * CGST_PCT);
  const netAmount = rupee(taxableAmount + sgstAmount + cgstAmount);
  return {
    lines,
    goodsAmount,
    freightAmount,
    taxableAmount,
    sgstAmount,
    cgstAmount,
    netAmount,
    totalKg,
  };
}

function blankDraft(srNo: string): Draft {
  return {
    id: crypto.randomUUID(),
    srNo,
    billDate: todayIso(),
    billNo: "",
    challanNo: "",
    knitterId: "",
    knitterName: "",
    millId: "",
    millName: "",
    agent: "",
    remarks: "",
    freightRate: "",
    goodsAmount: 0,
    freightAmount: 0,
    taxableAmount: 0,
    sgstAmount: 0,
    cgstAmount: 0,
    netAmount: 0,
    status: "DRAFT",
    purchaseOrderId: null,
    matchScore: null,
    matchStatus: null,
    matchedAt: null,
    items: [emptyItem()],
    rolls: [emptyRoll()],
    documents: [],
  };
}

function mergeDocument(row: GreyBillRecord, link: GreyBillDocumentLink): GreyBillRecord {
  return {
    ...row,
    documents: [...row.documents.filter((document) => document.kind !== link.kind), link],
  };
}

function documentForm(file: File, kind: GreyBillDocumentLink["kind"]) {
  const data = new FormData();
  data.set("file", file);
  data.set("kind", kind);
  return data;
}

function DocumentActions({ documents }: { documents: GreyBillDocumentLink[] }) {
  const links = documents.filter(
    (document) => document.kind === "BILL" || document.kind === "CHALLAN",
  );
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]">
      {links.map((document) => {
        const href = `/api/grey-documents/${document.accessToken}`;
        const label = document.kind === "BILL" ? "Bill PDF" : "Challan PDF";
        return (
          <span key={document.kind} className="inline-flex items-center gap-1.5">
            <a
              className="font-semibold text-(--accent) underline"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {label}
            </a>
            <a className="text-(--muted) underline" href={`${href}?download=1`}>
              Download
            </a>
          </span>
        );
      })}
    </div>
  );
}

function cloneBill(row: GreyBillRecord): Draft {
  return {
    ...row,
    items:
      row.items.length > 0
        ? row.items.map((item) => ({ ...item }))
        : [emptyItem()],
    rolls:
      row.rolls.length > 0
        ? row.rolls.map((roll) => ({
            id: roll.id,
            weight: roll.weight,
          }))
        : [emptyRoll()],
  };
}

function billInput(draft: Draft): GreyBillInput {
  const money = moneyFor(draft);
  return {
    billDate: draft.billDate,
    billNo: draft.billNo,
    challanNo: draft.challanNo,
    knitterId: draft.knitterId,
    millId: draft.millId,
    agent: draft.agent,
    remarks: draft.remarks,
    freightRate: draft.freightRate,
    status: draft.status,
    items: money.lines.map((item) => ({
      itemId: item.itemId,
      rolls: item.rolls,
      qty: item.qty,
      rate: item.rate,
    })),
    rolls: draft.rolls
      .filter((roll) => roll.weight.trim() !== "")
      .map((roll) => ({ weight: roll.weight })),
  };
}

function optionLabel(
  options: { id: string; label: string }[],
  id: string,
) {
  return options.find((row) => row.id === id)?.label ?? "";
}

export function GreyPurchaseDesk({
  bills,
  knitters,
  mills,
  items,
  purchaseOrders: _purchaseOrders,
}: {
  bills: GreyBillRecord[];
  knitters: KnitterRecord[];
  mills: MillRecord[];
  items: ItemRecord[];
  purchaseOrders: PurchaseOrderRecord[];
}) {
  const [rows, setRows] = useState<GreyBillRecord[]>(bills);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rollOpen, setRollOpen] = useState(false);
  const [billBusy, setBillBusy] = useState(false);
  const [billWarnings, setBillWarnings] = useState<string[]>([]);
  const [challanBusy, setChallanBusy] = useState(false);
  const [challanNote, setChallanNote] = useState<string | null>(null);
  const billFileRef = useRef<HTMLInputElement>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [challanFile, setChallanFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GreyBillRecord | null>(
    null,
  );
  const savingRef = useRef(false);
  const pendingLineFocus = useRef<string | null>(null);
  const pendingRollFocus = useRef<string | null>(null);
  const weightRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const billTrapRef = useRef<HTMLDivElement>(null);
  const itemGridScrollRef = useRef<HTMLDivElement>(null);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const readOnly = mode === "view";

  const knitterOptions = useMemo(
    () => knitters.map((row) => ({ id: row.id, label: row.knitterName })),
    [knitters],
  );
  const millOptions = useMemo(
    () => mills.map((row) => ({ id: row.id, label: row.millName })),
    [mills],
  );
  const itemOptions = useMemo(
    () => items.map((row) => ({ id: row.id, label: row.itemName })),
    [items],
  );

  const live = useMemo(() => (draft ? moneyFor(draft) : null), [draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.srNo.toLowerCase().includes(q) ||
        row.billNo.toLowerCase().includes(q) ||
        row.challanNo.toLowerCase().includes(q) ||
        row.knitterName.toLowerCase().includes(q) ||
        row.millName.toLowerCase().includes(q),
    );
  }, [query, rows]);

  useEffect(() => {
    const id = pendingLineFocus.current;
    if (!id || !billTrapRef.current) return;
    const target = billTrapRef.current.querySelector<HTMLInputElement>(
      `[data-line-id="${id}"] input:not([disabled])`,
    );
    if (target) {
      pendingLineFocus.current = null;
      target.focus();
      const row = itemGridScrollRef.current?.querySelector<HTMLElement>(
        `[data-line-id="${id}"]`,
      );
      row?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [draft?.items]);

  useEffect(() => {
    const id = pendingRollFocus.current;
    if (!id) return;
    const el = weightRefs.current[id];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    pendingRollFocus.current = null;
  }, [draft?.rolls.length, rollOpen]);

  function closeModal() {
    setDraft(null);
    setMode(null);
    setError(null);
    setRollOpen(false);
    setBillWarnings([]);
    setChallanNote(null);
  }

  function matchMaster(name: string, options: { id: string; label: string }[]) {
    const key = name.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key) return null;
    const hits = options.filter(
      (option) => option.label.trim().toLowerCase().replace(/\s+/g, " ") === key,
    );
    return hits.length === 1 ? hits[0] : null;
  }

  function applyBillExtract(extracted: GreyBillExtract) {
    let warnings: string[] = [];
    setDraft((prev) => {
      if (!prev) return prev;
      warnings = [];
      const next: Draft = {
        ...prev,
        items: prev.items.map((item) => ({ ...item })),
      };
      const billNo = extracted.billNo.trim();
      if (billNo) {
        next.billNo = billNo;
        if (!next.challanNo.trim() || next.challanNo === prev.billNo) next.challanNo = billNo;
      } else warnings.push("Bill no. was not read.");
      const billDate = extracted.billDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(billDate)) next.billDate = billDate;
      else warnings.push(billDate ? "Bill date was not a valid date." : "Bill date was not read.");
      const agent = extracted.agent.trim();
      if (agent) next.agent = agent;
      else warnings.push("Agent was not read.");
      const remark = extracted.remark.trim();
      if (remark) next.remarks = remark;
      const line = next.items[0] ?? emptyItem();
      if (!next.items[0]) next.items = [line];
      const rolls = extracted.quantityRolls.trim();
      if (rolls && Number.isFinite(Number(rolls))) line.rolls = rolls;
      else warnings.push("Roll count was not read.");
      const qty = extracted.quantityKg.trim();
      if (qty && Number.isFinite(Number(qty))) line.qty = qty;
      else warnings.push("Quantity KG was not read.");
      const rate = extracted.rate.trim();
      if (rate && Number.isFinite(Number(rate))) line.rate = rate;
      else warnings.push("Rate was not read.");
      const knitter = matchMaster(extracted.knitter, knitterOptions);
      if (knitter) {
        next.knitterId = knitter.id;
        next.knitterName = knitter.label;
      } else if (extracted.knitter.trim()) {
        if (!next.knitterId) next.knitterName = extracted.knitter.trim();
        warnings.push(`Knitter not matched: ${extracted.knitter.trim()}`);
      } else warnings.push("Knitter was not read.");
      const mill = matchMaster(extracted.mill, millOptions);
      if (mill) {
        next.millId = mill.id;
        next.millName = mill.label;
      } else if (extracted.mill.trim()) {
        if (!next.millId) next.millName = extracted.mill.trim();
        warnings.push(`Mill not matched: ${extracted.mill.trim()}`);
      } else warnings.push("Mill was not read.");
      const item = matchMaster(extracted.item, itemOptions);
      if (item) {
        line.itemId = item.id;
        line.itemName = item.label;
      } else if (extracted.item.trim()) {
        if (!line.itemId) line.itemName = extracted.item.trim();
        warnings.push(`Item not matched: ${extracted.item.trim()}`);
      } else warnings.push("Item was not read.");
      return next;
    });
    setBillWarnings(warnings);
    setError(null);
  }

  async function uploadBill(file: File) {
    if (billBusy) return;
    setBillFile(file);
    setBillBusy(true);
    setError(null);
    try {
      const data = new FormData();
      data.set("file", file);
      applyBillExtract(await extractGreyPurchaseBill(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract the bill.");
    } finally {
      setBillBusy(false);
      if (billFileRef.current) billFileRef.current.value = "";
    }
  }

  function uploadChallan(file: File) {
    if (challanBusy) return;
    setChallanFile(file);
    setChallanBusy(true);
    setError(null);
    void (async () => {
      try {
        const data = new FormData();
        data.set("file", file);
        const result = await extractGreyPurchaseChallan(data);
        let note = "";
        setDraft((prev) => {
          if (!prev) return prev;
          const expected = requiredRollCount(prev.items);
          if (expected <= 0) {
            note = "Enter the roll count on the bill before uploading the challan.";
            return prev;
          }
          const rolls = syncRollsToCount(prev.rolls, expected);
          let extracted = 0;
          const nextRolls = rolls.map((roll, index) => {
            if (index >= result.slots.length) return { ...roll, weight: roll.weight.trim() ? formatWeightKg(roll.weight) : "" };
            const slot = result.slots[index].trim();
            if (!slot) return { ...roll, weight: "" };
            extracted += 1;
            return { ...roll, weight: formatWeightKg(slot) };
          });
          const manual = expected - extracted;
          const extra = result.slots.slice(expected).filter((slot) => slot.trim()).length;
          const sum = result.slots.slice(0, expected).reduce((total, slot) => {
            if (!slot.trim()) return total;
            const value = Number(slot);
            return Number.isFinite(value) ? total + value : total;
          }, 0);
          const lines = [
            `Expected rolls: ${expected}. Extracted weights: ${extracted}. Manual entry: ${manual}.`,
            `Sum of extracted weights: ${sum.toFixed(3)} KG.`,
          ];
          if (result.quantityKg.trim()) lines.push(`Challan total KG: ${result.quantityKg}.`);
          if (manual > 0) {
            lines.push(`${extracted} of ${expected} weights extracted; ${manual} require manual entry.`);
          }
          if (extra > 0) {
            lines.push(`${extra} weights were past the bill roll count and were not placed.`);
          }
          if (manual === 0 && result.quantityKg.trim()) {
            const reported = Number(result.quantityKg);
            if (Number.isFinite(reported) && Math.abs(sum - reported) > 0.001) {
              lines.push("Weight total does not match the challan KG. The weights were not adjusted.");
            }
          }
          if (result.slots.length < expected && result.unreadable.length === 0) {
            lines.push("Some printed rows were not returned, so these weights were placed from row 1. Check the sequence before saving.");
          }
          if (result.unreadable.length > 0) lines.push(...result.unreadable.slice(0, 3));
          note = lines.join(" ");
          return { ...prev, rolls: nextRolls };
        });
        setChallanNote(note);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not extract the challan.");
      } finally {
        setChallanBusy(false);
      }
    })();
  }

  function openCreate() {
    setError(null);
    setNotice(null);
    setBillWarnings([]);
    setChallanNote(null);
    setBillFile(null);
    setChallanFile(null);
    setRollOpen(false);
    setMode("create");
    setDraft(blankDraft(nextSrNo(rows.map((row) => row.srNo), todayIso())));
  }

  function openRow(row: GreyBillRecord, nextMode: "edit" | "view") {
    setError(null);
    setBillWarnings([]);
    setChallanNote(null);
    setBillFile(null);
    setChallanFile(null);
    setMode(nextMode);
    setDraft(cloneBill(row));
  }

  function patch(next: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchItem(id: string, next: Partial<DraftItem>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, ...next } : item,
        ),
      };
    });
  }

  function addItem() {
    const created = emptyItem();
    pendingLineFocus.current = created.id;
    setDraft((prev) =>
      prev ? { ...prev, items: [...prev.items, created] } : prev,
    );
  }

  function deleteItem(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const remaining = prev.items.filter((item) => item.id !== id);
      return {
        ...prev,
        items: remaining.length > 0 ? remaining : [emptyItem()],
      };
    });
  }

  function normalizeEmptyItem(id: string) {
    setDraft((prev) => {
      if (!prev || prev.items.length < 2) return prev;
      const item = prev.items.find((row) => row.id === id);
      if (!item || itemHasEntry(item)) return prev;
      return {
        ...prev,
        items: prev.items.filter((row) => row.id !== id),
      };
    });
  }

  function onNumericKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab" && event.key !== "Enter") return;
    if (!isValidNumericEntry(event.currentTarget.value)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onItemKey(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    onNumericKeyDown(event);
    if (event.defaultPrevented) return;
    if (event.key !== "Tab" && event.key !== "Enter") return;
    if (event.shiftKey || readOnly || !draft) return;
    const next = draft.items[index + 1];
    if (next) return;
    if (!itemHasEntry(draft.items[index])) return;
    event.preventDefault();
    addItem();
  }

  function onRollWeightKey(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    onNumericKeyDown(event);
    if (event.defaultPrevented) return;
    if (event.key !== "Tab" && event.key !== "Enter") return;
    if (event.shiftKey || readOnly || !draft) return;
    const next = draft.rolls[index + 1];
    if (next) {
      event.preventDefault();
      const el = weightRefs.current[next.id];
      el?.focus();
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
  }

  function closeRollDetails() {
    setRollOpen(false);
    window.setTimeout(() => {
      remarksRef.current?.focus();
    }, 0);
  }

  function openRollDetails() {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rolls: syncRollsToCount(prev.rolls, requiredRollCount(prev.items)).map((roll) => ({
          ...roll,
          weight: roll.weight.trim() ? formatWeightKg(roll.weight) : "",
        })),
      };
    });
    setRollOpen(true);
  }

  function removeRoll(id: string) {
    if (!draft) return;
    const remaining = draft.rolls.filter((roll) => roll.id !== id);
    patch({ rolls: remaining.length > 0 ? remaining : [emptyRoll()] });
  }

  function validate(entry: Draft, status: "DRAFT" | "SAVED") {
    if (!entry.billDate) return "Enter a date of issue.";
    if (status !== "SAVED") return null;
    if (!entry.billNo.trim() || !entry.challanNo.trim() || !entry.knitterId.trim()) {
      return "Enter bill no., challan no. and knitter.";
    }
    return null;
  }

  async function persist(status: "DRAFT" | "SAVED") {
    if (!draft || savingRef.current) return false;
    const message = validate(draft, status);
    if (message) {
      setError(message);
      return false;
    }
    savingRef.current = true;
    setError(null);
    try {
      const input = { ...billInput(draft), status };
      const creating = mode === "create" || !rows.some((row) => row.id === draft.id);
      const saved = creating
        ? await createGreyBill(input)
        : await updateGreyBill(draft.id, input);
      if (status === "SAVED") {
        await ensureMillInwardFromGreyBill(saved.id);
      }
      let next = saved;
      const missing: string[] = [];
      if (billFile) {
        try {
          next = mergeDocument(
            next,
            await attachGreyBillDocument(saved.id, documentForm(billFile, "BILL")),
          );
          setBillFile(null);
        } catch (err) {
          missing.push(
            err instanceof Error ? `Bill file: ${err.message}` : "Bill file was not stored.",
          );
        }
      }
      if (challanFile) {
        try {
          next = mergeDocument(
            next,
            await attachGreyBillDocument(
              saved.id,
              documentForm(challanFile, "CHALLAN"),
            ),
          );
          setChallanFile(null);
        } catch (err) {
          missing.push(
            err instanceof Error
              ? `Challan file: ${err.message}`
              : "Challan file was not stored.",
          );
        }
      }
      setRows((prev) =>
        creating
          ? [next, ...prev.filter((row) => row.id !== next.id)]
          : prev.map((row) => (row.id === next.id ? next : row)),
      );
      if (missing.length > 0) {
        setMode("edit");
        setDraft(next);
        setError(
          `Grey purchase saved, but ${missing.join(" ")} Save again to retry the missing file.`,
        );
        return false;
      }
      setNotice(
        status === "SAVED"
          ? "Grey bill saved. Pending mill inward created if it did not already exist."
          : "Draft saved.",
      );
      closeModal();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the grey bill.");
      return false;
    } finally {
      savingRef.current = false;
    }
  }

  function saveDraftBill() {
    if (!draft || readOnly || savingRef.current) return false;
    void persist("DRAFT");
    return true;
  }

  async function confirmDeleteBill() {
    if (!pendingDelete || savingRef.current) return;
    savingRef.current = true;
    setError(null);
    try {
      const id = pendingDelete.id;
      await deleteGreyBill(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setPendingDelete(null);
      setNotice("Grey bill deleted.");
      if (draft?.id === id) closeModal();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Could not delete the grey bill.",
      );
      setPendingDelete(null);
    } finally {
      savingRef.current = false;
    }
  }

  const unsaved = useUnsavedClose({
    active: (mode === "create" || mode === "edit") && draft != null,
    current: draft,
    onDiscard: closeModal,
    onSaveDraft: saveDraftBill,
  });

  const cellInput = `${inputClass} h-8 py-1`;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Grey Purchase"
        eyebrow="Procure"
        icon={FileText}
        actions={
          <button type="button" className={buttonClass} onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            New Grey Bill
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

      <MetricStrip className="grid-cols-3">
        <Metric label="Grey Bills" value={rows.length} />
        <Metric
          label="Saved"
          value={rows.filter((row) => row.status === "SAVED").length}
        />
        <Metric
          label="Drafts"
          value={rows.filter((row) => row.status === "DRAFT").length}
        />
      </MetricStrip>

      <Panel
        title="Grey Bill Register"
        icon={FileText}
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search sr no, bill, challan, knitter, mill"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={FileText} text="No grey bills" />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register w-full table-fixed">
              <colgroup>
                <col className="w-[9.25rem]" />
                <col className="w-[8.5rem]" />
                <col className="w-[8.5rem]" />
                <col />
                <col />
                <col className="w-[8rem]" />
                <col className="w-[6.75rem]" />
                <col className="w-[8.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Bill No.</th>
                  <th>Challan No.</th>
                  <th>Knitter</th>
                  <th>Mill</th>
                  <th className="num">Net Amount</th>
                  <th>Status</th>
                  <th>View/Edit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold tabular-nums"
                      title={row.srNo}
                    >
                      {row.srNo}
                    </td>
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      title={row.billNo || undefined}
                    >
                      {row.billNo || "—"}
                    </td>
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      title={row.challanNo || undefined}
                    >
                      {row.challanNo || "—"}
                    </td>
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      title={row.knitterName || undefined}
                    >
                      {row.knitterName || "—"}
                    </td>
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      title={row.millName || undefined}
                    >
                      {row.millName || "—"}
                    </td>
                    <td className="num overflow-hidden whitespace-nowrap">
                      {rupee(row.netAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="overflow-hidden">
                      <span
                        className={`${statusBadge(row.status)} max-w-full truncate`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="overflow-hidden">
                      <div className="flex flex-col items-center gap-1">
                      <div className="flex flex-nowrap items-center justify-center gap-1">
                        <button
                          type="button"
                          className={buttonTinyClass}
                          onClick={() => openRow(row, "edit")}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={buttonTinyClass}
                          aria-label="Delete grey bill"
                          onClick={() => setPendingDelete(row)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <DocumentActions documents={row.documents} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {draft && mode ? (
        <Overlay
          title={mode === "create" ? "GP Entry" : `GP Entry ${draft.srNo}`}
          onClose={unsaved.requestClose}
          trapFocus={!rollOpen}
          frameWidthClass="w-[63.75vw] max-w-[61.2rem] max-h-[calc(100vh-4rem)] overflow-hidden"
        >
          <div ref={billTrapRef} className="space-y-2 overflow-hidden px-4 py-2.5">
            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <DocumentActions documents={draft.documents} />
              <input
                ref={billFileRef}
                className="hidden"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadBill(file);
                }}
              />
              <button
                type="button"
                className={buttonGhostClass}
                disabled={readOnly || billBusy}
                onClick={() => billFileRef.current?.click()}
              >
                {billBusy ? "INTELIXA" : "Upload Bill"}
              </button>
            </div>
            {billFile || challanFile ? (
              <p className="text-[12px] text-(--muted)">
                {billFile ? `Bill file ready to save: ${billFile.name}. ` : ""}
                {challanFile ? `Challan file ready to save: ${challanFile.name}.` : ""}
              </p>
            ) : null}
            {billWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {billWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-4 gap-2">
              <Field label="Sr. No.">
                <input className={inputClass} value={draft.srNo} readOnly />
              </Field>
              <Field label="Date">
                <input
                  className={inputClass}
                  type="date"
                  autoComplete="off"
                  value={draft.billDate}
                  disabled={readOnly}
                  onChange={(e) => patch({ billDate: e.target.value })}
                />
              </Field>
              <Field label="Bill No.">
                <input
                  className={inputClass}
                  autoComplete="off"
                  value={draft.billNo}
                  disabled={readOnly}
                  onChange={(e) => {
                    const billNo = e.target.value;
                    if (
                      draft.challanNo === "" ||
                      draft.challanNo === draft.billNo
                    ) {
                      patch({ billNo, challanNo: billNo });
                    } else {
                      patch({ billNo });
                    }
                  }}
                />
              </Field>
              <Field label="Challan No.">
                <input
                  className={inputClass}
                  value={draft.challanNo}
                  disabled={readOnly}
                  onChange={(e) => patch({ challanNo: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Knitter Name">
                <SearchableSelect
                  value={draft.knitterId}
                  options={knitterOptions}
                  disabled={readOnly}
                  placeholder="Search knitter"
                  onChange={(id) =>
                    patch({
                      knitterId: id,
                      knitterName: optionLabel(knitterOptions, id),
                    })
                  }
                />
                {draft.knitterName && !draft.knitterId ? (
                  <p className="mt-1 text-[11px] text-(--muted)">Extracted knitter: {draft.knitterName}</p>
                ) : null}
              </Field>
              <Field label="Mill Name">
                <SearchableSelect
                  value={draft.millId}
                  options={millOptions}
                  disabled={readOnly}
                  placeholder="Search mill"
                  onChange={(id) =>
                    patch({
                      millId: id,
                      millName: optionLabel(millOptions, id),
                    })
                  }
                />
                {draft.millName && !draft.millId ? (
                  <p className="mt-1 text-[11px] text-(--muted)">Extracted mill: {draft.millName}</p>
                ) : null}
              </Field>
              <Field label="Agent Name">
                <input
                  className={inputClass}
                  value={draft.agent}
                  disabled={readOnly}
                  onChange={(e) => patch({ agent: e.target.value })}
                />
              </Field>
            </div>

            <TableWrap>
              <div
                ref={itemGridScrollRef}
                className="max-h-[11.5rem] overflow-y-auto"
              >
              <table className="erp-table">
                <thead className="sticky top-0 z-[1] bg-(--panel)">
                  <tr>
                    <th className="w-10">SR</th>
                    <th>Item Name</th>
                    <th className="num">Roll/Taka</th>
                    <th className="num">Quantity</th>
                    <th>Unit</th>
                    <th className="num">Rate</th>
                    <th className="num">Amount</th>
                    {!readOnly ? <th className="w-9" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item, index) => (
                    <tr
                      key={item.id}
                      data-line-id={item.id}
                      onBlur={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) {
                          return;
                        }
                        normalizeEmptyItem(item.id);
                      }}
                    >
                      <td className="text-center tabular-nums">{index + 1}</td>
                      <td>
                        <SearchableSelect
                          value={item.itemId}
                          options={itemOptions}
                          disabled={readOnly}
                          placeholder="Search item"
                          onChange={(id) =>
                            patchItem(item.id, {
                              itemId: id,
                              itemName: optionLabel(itemOptions, id),
                            })
                          }
                        />
                        {item.itemName && !item.itemId ? (
                          <p className="mt-1 text-[11px] text-(--muted)">Extracted item: {item.itemName}</p>
                        ) : null}
                      </td>
                      <td>
                        <input
                          className={`${cellInput} text-right`}
                          inputMode="decimal"
                          value={item.rolls}
                          disabled={readOnly}
                          onChange={(e) =>
                            patchItem(item.id, { rolls: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className={numericInputClass(
                            item.qty,
                            `${cellInput} text-right`,
                          )}
                          inputMode="decimal"
                          value={item.qty}
                          disabled={readOnly}
                          onChange={(e) =>
                            patchItem(item.id, { qty: e.target.value })
                          }
                          onBlur={(e) => {
                            if (!isValidNumericEntry(e.target.value)) return;
                            patchItem(item.id, {
                              qty: formatEnteredDecimal(e.target.value),
                            });
                          }}
                          onKeyDown={onNumericKeyDown}
                        />
                      </td>
                      <td className="text-(--muted)">KG</td>
                      <td>
                        <input
                          className={numericInputClass(
                            item.rate,
                            `${cellInput} text-right`,
                          )}
                          inputMode="decimal"
                          value={item.rate}
                          disabled={readOnly}
                          data-skip-modal-tab={
                            !readOnly &&
                            index === draft.items.length - 1 &&
                            itemHasEntry(item)
                              ? true
                              : undefined
                          }
                          onChange={(e) =>
                            patchItem(item.id, { rate: e.target.value })
                          }
                          onBlur={(e) => {
                            if (!isValidNumericEntry(e.target.value)) return;
                            patchItem(item.id, {
                              rate: formatEnteredDecimal(e.target.value),
                            });
                          }}
                          onKeyDown={(e) => onItemKey(index, e)}
                        />
                      </td>
                      <td className="num">
                        {formatRupeeAmount(num(item.qty) * num(item.rate))}
                      </td>
                      {!readOnly ? (
                        <td>
                          <button
                            type="button"
                            className={buttonTinyClass}
                            tabIndex={-1}
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </TableWrap>
            {!readOnly ? (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={buttonGhostClass} onClick={addItem}>
                  <Plus className="h-3 w-3" />
                  Add Item
                </button>
                <button
                  type="button"
                  className={buttonGhostClass}
                  onClick={openRollDetails}
                >
                  <Plus className="h-3 w-3" />
                  Add Taka / Roll Details
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={buttonGhostClass}
                onClick={openRollDetails}
              >
                <Plus className="h-3 w-3" />
                Add Taka / Roll Details
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Remarks">
                <textarea
                  ref={remarksRef}
                  className={inputClass}
                  rows={5}
                  value={draft.remarks}
                  disabled={readOnly}
                  onChange={(e) => patch({ remarks: e.target.value })}
                />
              </Field>
              <div className="space-y-1 rounded-md border border-(--line) bg-(--panel-alt) px-2.5 py-1.5">
                <Field label="Freight Rate ₹/KG">
                  <input
                    className={numericInputClass(
                      draft.freightRate,
                      `${inputClass} text-right`,
                    )}
                    inputMode="decimal"
                    value={draft.freightRate}
                    disabled={readOnly}
                    onChange={(e) => patch({ freightRate: e.target.value })}
                    onBlur={(e) => {
                      if (!isValidNumericEntry(e.target.value)) return;
                      patch({
                        freightRate: formatEnteredDecimal(e.target.value),
                      });
                    }}
                    onKeyDown={onNumericKeyDown}
                  />
                </Field>
                <div className="space-y-0.5 text-[12.5px] tabular-nums">
                  <div className="flex justify-between">
                    <span>Goods Subtotal</span>
                    <span>{live ? formatRupeeAmount(live.goodsAmount) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Freight</span>
                    <span>{live ? formatRupeeAmount(live.freightAmount) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxable Subtotal</span>
                    <span>{live ? formatRupeeAmount(live.taxableAmount) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST 2.500%</span>
                    <span>{live ? formatRupeeAmount(live.sgstAmount) : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST 2.500%</span>
                    <span>{live ? formatRupeeAmount(live.cgstAmount) : ""}</span>
                  </div>
                  <div className="flex justify-between border-t border-(--line) pt-1 text-[14px] font-semibold">
                    <span>Net Bill Amount</span>
                    <span>{live ? formatRupeeAmount(live.netAmount) : ""}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="-mx-4 flex justify-end gap-1.5 border-t border-(--line) px-4 pt-2.5">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                {readOnly ? "Close" : "Cancel"}
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void persist("SAVED")}
                >
                  Save Grey Purchase
                </button>
              ) : null}
            </div>
            {unsaved.dialog}
          </div>
        </Overlay>
      ) : null}

      {draft && rollOpen ? (
        <Overlay
          title="Roll / Taka"
          onClose={closeRollDetails}
          trapFocus
          frameWidthClass="w-[min(100vw-2rem,454px)] max-h-[calc(100vh-2rem)] overflow-hidden"
        >
          <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 overflow-auto px-4 pt-2.5">
          {!readOnly ? (
            <GreyChallanUploadButton busy={challanBusy} onFile={uploadChallan} />
          ) : null}
          {challanNote ? (
            <p className="mb-2 text-[12px] text-amber-900">{challanNote}</p>
          ) : null}
          <table className="erp-table">
            <colgroup>
              <col className="w-16" />
              <col />
              {!readOnly ? <col className="w-10" /> : null}
            </colgroup>
            <thead>
              <tr>
                <th className="w-16">Roll</th>
                <th>Weight KG</th>
                {!readOnly ? <th className="w-10" /> : null}
              </tr>
            </thead>
          </table>
          <div className="max-h-[15.75rem] overflow-y-auto">
          <table className="erp-table">
            <colgroup>
              <col className="w-16" />
              <col />
              {!readOnly ? <col className="w-10" /> : null}
            </colgroup>
            <tbody>
              {draft.rolls.map((roll, index) => (
                <tr key={roll.id}>
                  <td className="font-semibold tabular-nums">{index + 1}</td>
                  <td>
                    <input
                      ref={(el) => {
                        weightRefs.current[roll.id] = el;
                      }}
                      className={numericInputClass(
                        roll.weight,
                        `${inputClass} text-right`,
                      )}
                      value={roll.weight}
                      disabled={readOnly}
                      inputMode="decimal"
                      onChange={(e) =>
                        patch({
                          rolls: draft.rolls.map((row) =>
                            row.id === roll.id
                              ? { ...row, weight: e.target.value }
                              : row,
                          ),
                        })
                      }
                      onBlur={(e) => {
                        if (!isValidNumericEntry(e.target.value)) return;
                        const nextWeight = e.target.value.trim() ? formatWeightKg(e.target.value) : "";
                        if (nextWeight === roll.weight) return;
                        patch({
                          rolls: draft.rolls.map((row) =>
                            row.id === roll.id
                              ? { ...row, weight: nextWeight }
                              : row,
                          ),
                        });
                      }}
                      onFocus={(e) =>
                        e.currentTarget.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        })
                      }
                      onKeyDown={(e) => onRollWeightKey(index, e)}
                    />
                  </td>
                  {!readOnly ? (
                    <td>
                      <button
                        type="button"
                        className={buttonTinyClass}
                        tabIndex={-1}
                        onClick={() => removeRoll(roll.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </div>
          <div className="flex shrink-0 justify-between border-t border-(--line) bg-(--panel) px-4 py-2 text-[12px] font-semibold">
            <span>{rollStats(draft.rolls).totalRolls}</span>
            <span>
              {formatKg(rollStats(draft.rolls).totalWeight)} KG
            </span>
          </div>
          <div className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
            <button
              type="button"
              className={buttonClass}
              onClick={closeRollDetails}
            >
              Done
            </button>
          </div>
          </div>
        </Overlay>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-(--line) bg-(--panel) p-4 shadow-(--shadow-sm)"
            role="dialog"
            aria-labelledby="delete-grey-bill-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-grey-bill-title"
              className="text-[15px] font-semibold text-(--ink)"
            >
              Delete Grey Bill
            </h2>
            <p className="mt-1.5 text-[13px] text-(--muted)">
              Delete Grey Bill {pendingDelete.srNo}? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-1.5">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={() => setPendingDelete(null)}
              >
                No
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void confirmDeleteBill()}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
