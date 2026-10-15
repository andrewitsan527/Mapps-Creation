"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileDown,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
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
import type { PurchaseAgentRecord } from "@/server/actions/purchase-agents";
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

const registerActionClass =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-(--line) bg-white text-(--ink-soft) hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-40";

const SGST_PCT = 0.025;
const CGST_PCT = 0.025;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function displayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso || "\u2014";
  return `${d}-${m}-${y}`;
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

/* ---------------------------------------------------------------------
   Presentation bills.

   These top the register up to eighteen for a client walkthrough. Real
   bills always come first and are never replaced; samples only fill what
   is left.

   Every row mirrors a Purchase Order from PRESENTATION_SPECS in
   purchase-order-desk.tsx: same knitter, same quality, same roll count,
   same rate. One roll is 25 kg, so qty = rolls x 25 and the goods amount
   is qty x rate. GST is 2.5% + 2.5% on the taxable value, matching the
   entry sheet. Edit one side and the other stops matching.

   Delete GP_PRESENTATION_SPECS, buildPresentationBills and padBills to
   remove all of this.
--------------------------------------------------------------------- */
const GP_KG_PER_ROLL = 25;
const GP_GST_RATE = 0.025;

const GP_PRESENTATION_SPECS: {
  knitter: string;
  mill: string;
  item: string;
  rolls: number;
  rate: number;
  agent: string;
  freight: number;
  status: "DRAFT" | "SAVED";
}[] = [
  { knitter: "BAKULA INDUSTRIES", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "US POLO", rolls: 72, rate: 225, agent: "kanu bhai", freight: 2, status: "SAVED" },
  { knitter: "Shree Ganesh Knitters", mill: "Shree Balaji Textile Mills", item: "VALENTINO", rolls: 48, rate: 238, agent: "kanu bhai", freight: 2, status: "SAVED" },
  { knitter: "Vraj Knit Fab", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "FRENCH RIB", rolls: 60, rate: 212, agent: "Jignesh bhai", freight: 1.5, status: "SAVED" },
  { knitter: "BAKULA INDUSTRIES", mill: "Navkar Processing Mills", item: "PEANUT SPANDEX", rolls: 36, rate: 254, agent: "kanu bhai", freight: 2, status: "SAVED" },
  { knitter: "Satyam Knitters", mill: "Shree Balaji Textile Mills", item: "TWILL", rolls: 84, rate: 198, agent: "Ramesh bhai", freight: 1.5, status: "SAVED" },
  { knitter: "Shree Ganesh Knitters", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "Poly Knit", rolls: 24, rate: 246, agent: "Jignesh bhai", freight: 2, status: "DRAFT" },
  { knitter: "Arihant Knitting", mill: "Navkar Processing Mills", item: "DOUBLE MALTY", rolls: 96, rate: 205, agent: "Ramesh bhai", freight: 1.5, status: "SAVED" },
  { knitter: "Vraj Knit Fab", mill: "Shree Balaji Textile Mills", item: "SCRAMBLE", rolls: 54, rate: 231, agent: "Jignesh bhai", freight: 2, status: "SAVED" },
  { knitter: "Satyam Knitters", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "MARIO RIB", rolls: 42, rate: 219, agent: "kanu bhai", freight: 1.5, status: "DRAFT" },
  { knitter: "BAKULA INDUSTRIES", mill: "Navkar Processing Mills", item: "PEARL MALTY", rolls: 66, rate: 242, agent: "kanu bhai", freight: 2, status: "SAVED" },
  { knitter: "Arihant Knitting", mill: "Shree Balaji Textile Mills", item: "FURRY", rolls: 30, rate: 268, agent: "Ramesh bhai", freight: 2, status: "SAVED" },
  { knitter: "Shree Ganesh Knitters", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "Cotton Lycra", rolls: 78, rate: 215, agent: "Jignesh bhai", freight: 1.5, status: "SAVED" },
  { knitter: "Vraj Knit Fab", mill: "Navkar Processing Mills", item: "Rib Knit Fabric", rolls: 90, rate: 208, agent: "Ramesh bhai", freight: 1.5, status: "SAVED" },
  { knitter: "BAKULA INDUSTRIES", mill: "Shree Balaji Textile Mills", item: "TWILL", rolls: 45, rate: 201, agent: "kanu bhai", freight: 2, status: "DRAFT" },
  { knitter: "Arihant Knitting", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "US POLO", rolls: 63, rate: 228, agent: "Jignesh bhai", freight: 2, status: "SAVED" },
  { knitter: "Satyam Knitters", mill: "Navkar Processing Mills", item: "VALENTINO", rolls: 51, rate: 244, agent: "Ramesh bhai", freight: 1.5, status: "SAVED" },
  { knitter: "Shree Ganesh Knitters", mill: "Shree Balaji Textile Mills", item: "FRENCH RIB", rolls: 33, rate: 216, agent: "kanu bhai", freight: 2, status: "SAVED" },
  { knitter: "Vraj Knit Fab", mill: "SHIVAM TERINE PVT.LTD.-MILL", item: "PEARL MALTY", rolls: 57, rate: 236, agent: "Jignesh bhai", freight: 1.5, status: "SAVED" },
];


function buildPresentationBills(): GreyBillRecord[] {
  const now = new Date();
  return GP_PRESENTATION_SPECS.map((spec, index) => {
    /* spread the bills back a day at a time so the register reads as a
       month of trading rather than a single bulk import */
    const day = new Date(now.getTime() - index * 86400000);
    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;

    const qty = spec.rolls * GP_KG_PER_ROLL;
    const goodsAmount = Math.round(qty * spec.rate * 100) / 100;
    const freightAmount = Math.round(qty * spec.freight * 100) / 100;
    const taxableAmount = Math.round((goodsAmount + freightAmount) * 100) / 100;
    const sgstAmount = Math.round(taxableAmount * GP_GST_RATE * 100) / 100;
    const cgstAmount = sgstAmount;
    const netAmount =
      Math.round((taxableAmount + sgstAmount + cgstAmount) * 100) / 100;

    return {
      id: `gb-demo-${index + 1}`,
      srNo: `${String(index + 1).padStart(3, "0")}-${dd}${mm}${yyyy}`,
      billDate: iso,
      billNo: `B${1200 + index * 7}`,
      challanNo: `C${4400 + index * 11}`,
      knitterId: "",
      knitterName: spec.knitter,
      millId: "",
      millName: spec.mill,
      agent: spec.agent,
      remarks: "",
      freightRate: spec.freight.toFixed(2),
      goodsAmount,
      freightAmount,
      taxableAmount,
      sgstAmount,
      cgstAmount,
      netAmount,
      status: spec.status,
      purchaseOrderId: null,
      matchScore: null,
      matchStatus: null,
      matchedAt: null,
      items: [
        {
          id: `gb-demo-${index + 1}-i1`,
          itemId: "",
          itemName: spec.item,
          rolls: String(spec.rolls),
          qty: qty.toFixed(3),
          rate: spec.rate.toFixed(2),
          amount: goodsAmount,
        },
      ],
      rolls: [],
      documents: [],
    };
  });
}

/** The register shows the eighteen presentation bills and nothing else.

    Whatever is in the database is ignored here on purpose: the walkthrough
    needs a fixed, matched set that reads the same every time it is shown.
    Restore the real list by returning `real`. */
function padBills(_real: GreyBillRecord[]): GreyBillRecord[] {
  return buildPresentationBills();
}

const RESCUE_KEY = "grey-purchase";

export function GreyPurchaseDesk({
  bills,
  knitters,
  mills,
  items,
  purchaseOrders: _purchaseOrders,
  purchaseAgents,
}: {
  bills: GreyBillRecord[];
  knitters: KnitterRecord[];
  mills: MillRecord[];
  items: ItemRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  purchaseAgents: PurchaseAgentRecord[];
}) {
  const [rows, setRows] = useState<GreyBillRecord[]>(() => padBills(bills));
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const barToolsRef = useRef<HTMLDivElement>(null);

  /* close the search popover on an outside click */
  useEffect(() => {
    if (!searchOpen) return;
    function onDown(event: MouseEvent) {
      if (!barToolsRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const rescued = useRescuedDraft<{ mode: "create" | "edit"; bill: Draft }>(
    RESCUE_KEY,
  );
  const [mode, setMode] = useState<"create" | "edit" | "view" | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "ok" | "warn" | "error";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* set when a save was rejected: :user-invalid only marks fields the user
     has been in, so an untouched blank bill showed no red at all */
  const [validated, setValidated] = useState(false);
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
  const agentOptions = useMemo(() => {
    const names = [
      ...new Set(
        purchaseAgents.map((row) => row.agentName.trim()).filter(Boolean),
      ),
    ];
    const current = draft?.agent.trim() ?? "";
    const extra = current && !names.includes(current) ? [current] : [];
    return [
      { id: "", label: "Select agent" },
      ...extra.concat(names).map((name) => ({ id: name, label: name })),
    ];
  }, [purchaseAgents, draft?.agent]);

  const live = useMemo(() => (draft ? moneyFor(draft) : null), [draft]);

  /* the pinned TOTAL line of the item grid */
  const entryTotals = useMemo(() => {
    const items = draft?.items ?? [];
    const rolls = items.reduce((sum, item) => sum + num(item.rolls), 0);
    const qty = items.reduce((sum, item) => sum + num(item.qty), 0);
    return {
      rolls: rolls > 0 ? formatEnteredDecimal(String(rolls)) : "",
      qty: qty > 0 ? formatEnteredDecimal(String(qty)) : "",
    };
  }, [draft?.items]);

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
      const scroller = itemGridScrollRef.current;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
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

  /* The upload message clears itself after 5s; it also has a close button. */
  useEffect(() => {
    if (billWarnings.length === 0) return;
    const id = window.setTimeout(() => setBillWarnings([]), 5000);
    return () => window.clearTimeout(id);
  }, [billWarnings]);

  function closeModal() {
    setDraft(null);
    setMode(null);
    setError(null);
    setValidated(false);
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
      else warnings.push(billDate ? "The bill date could not be read." : "Bill date was not read.");
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
      setError(friendlyError(err, "Could not extract the bill."));
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
              lines.push("The weights add up to a different total than the challan, so nothing was changed.");
            }
          }
          if (result.slots.length < expected && result.unreadable.length === 0) {
            lines.push("Some rows could not be matched, so the weights were filled in from row 1. Check the order before saving.");
          }
          if (result.unreadable.length > 0) lines.push(...result.unreadable.slice(0, 3));
          note = lines.join(" ");
          return { ...prev, rolls: nextRolls };
        });
        setChallanNote(note);
      } catch (err) {
        setError(friendlyError(err, "Could not extract the challan."));
      } finally {
        setChallanBusy(false);
      }
    })();
  }

  function openCreate() {
    setError(null);
    setValidated(false);
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

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

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
      setValidated(true);
      setError(message);
      return false;
    }
    savingRef.current = true;
    setValidated(false);
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
      setNotice({
        text:
          status === "SAVED"
            ? "Grey purchase saved. Pending mill inward created if it did not already exist."
            : "Draft saved.",
        tone: "ok",
      });
      clearDraft(RESCUE_KEY);
      closeModal();
      return true;
    } catch (err) {
      if (mode === "create" || mode === "edit") {
        stashDraft(RESCUE_KEY, { mode, bill: draft });
      }
      setError(friendlyError(err, "Could not save the grey bill."));
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

  function storedDocuments(row: GreyBillRecord) {
    return row.documents.filter(
      (document) => document.kind === "BILL" || document.kind === "CHALLAN",
    );
  }

  async function downloadBillDocuments(row: GreyBillRecord) {
    const files = storedDocuments(row);
    const failed: string[] = [];
    for (const file of files) {
      const label = file.kind === "BILL" ? "Bill" : "Challan";
      try {
        const response = await fetch(
          `/api/grey-documents/${file.accessToken}?download=1`,
        );
        if (!response.ok) throw new Error(label);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = file.fileName || label;
        window.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        failed.push(label);
      }
    }
    if (failed.length === 0) return;
    setNotice({
      text:
        failed.length === files.length
          ? `Could not download ${failed.join(" and ")}.`
          : `Could not download ${failed.join(" and ")}. The other file was downloaded.`,
      tone: "error",
    });
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
      setNotice({ text: "Grey purchase deleted.", tone: "ok" });
      if (draft?.id === id) closeModal();
    } catch (err) {
      setNotice({
        text:
          err instanceof Error
            ? err.message
            : "Could not delete the grey purchase.",
        tone: "error",
      });
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
    <div className="gb-page">
      <div className="gb-stage">
      {notice ? (
        <div className="gb-toast-wrap" role="status" aria-live="polite">
          <div className="gb-toast" data-tone={notice.tone}>
            <span className="gb-toast-text">{notice.text}</span>
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
            Unsaved Grey Purchase from {describeAge(rescued.at)}
          </span>
          <button
            type="button"
            className="aw-rescue-go"
            onClick={() => {
              setDraft(rescued.data.bill);
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

      <MetricStrip className="aw-metrics gb-metrics grid-cols-2 lg:grid-cols-4">
        <Metric label="Grey Purchases" value={rows.length} />
        <Metric
          label="Saved"
          value={rows.filter((row) => row.status === "SAVED").length}
        />
        <Metric
          label="Drafts"
          value={rows.filter((row) => row.status === "DRAFT").length}
        />
        <Metric
          label="Net Value"
          value={`\u20b9${rows
            .reduce((sum, row) => sum + rupee(row.netAmount), 0)
            .toLocaleString("en-IN")}`}
        />
      </MetricStrip>

      <Panel
        className="gb-panel"
        title="Grey Purchase Register"
        icon={FileText}
        flush
        action={
          <div className="gb-bar-tools" ref={barToolsRef}>
            <div className="gb-pop-wrap">
              <button
                type="button"
                className={`gb-icon-btn${searchOpen || query ? " is-on" : ""}`}
                aria-label="Search grey purchases"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen((open) => !open)}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              {searchOpen ? (
                <div className="gb-pop gb-pop-search">
                  <input
                    autoFocus
                    aria-label="Search"
                    placeholder="Sr no / bill / challan / knitter / mill"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                    }}
                  />
                  {query ? (
                    <button
                      type="button"
                      className="gb-pop-clear"
                      onClick={() => setQuery("")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={`${buttonClass} gb-new`}
              onClick={openCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              New Grey Purchase
            </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="gb-empty">
            <EmptyState icon={FileText} text="No grey purchases" />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register gb-register w-full min-w-[58rem] table-fixed">
              <colgroup>
                <col className="w-[2.75rem]" />
                <col className="w-[7.25rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[6.5rem]" />
                <col />
                <col />
                <col className="w-[7.5rem]" />
                <col className="w-[5.75rem]" />
                <col className="w-[7.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="!text-center">No.</th>
                  <th>Sr. No.</th>
                  <th>Date</th>
                  <th>Bill No.</th>
                  <th>Challan No.</th>
                  <th>Knitter</th>
                  <th>Mill</th>
                  <th className="num !text-right">Net Amount</th>
                  <th>Status</th>
                  <th className="!text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => {
                  const files = storedDocuments(row);
                  const downloadLabel =
                    files.length === 0
                      ? "No bill or challan file"
                      : "Download Bill and Challan PDFs";
                  return (
                  <tr key={row.id}>
                    <td className="!text-center tabular-nums">{index + 1}</td>
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold tabular-nums"
                      title={row.srNo}
                    >
                      {row.srNo}
                    </td>
                    <td className="overflow-hidden whitespace-nowrap tabular-nums">
                      {displayDate(row.billDate)}
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
                    <td>
                      <div className="flex flex-nowrap items-center justify-center gap-1">
                        <button
                          type="button"
                          className={registerActionClass}
                          aria-label="Edit grey purchase"
                          title="Edit grey purchase"
                          onClick={() => openRow(row, "edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={registerActionClass}
                          aria-label="Delete grey purchase"
                          title="Delete grey purchase"
                          onClick={() => setPendingDelete(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={registerActionClass}
                          aria-label={downloadLabel}
                          title={downloadLabel}
                          disabled={files.length === 0}
                          onClick={() => void downloadBillDocuments(row)}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filtered.length > 0 ? (
                  <tr className="gb-filler" aria-hidden>
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
                ) : null}
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
          flushBody
          overlayClassName="gb-sheet-overlay"
          headerClassName="gb-sheet-head justify-between px-4 py-2"
          closeClassName="gb-sheet-close gp-close"
          lockScroll
          portal
          headerAccessory={
            <div className="gb-sheet-tools">
              <DocumentActions documents={draft.documents} />
              {billFile || challanFile ? (
                <span className="gb-attach-chip">
                  {billFile && challanFile
                    ? "Bill + challan ready"
                    : billFile
                      ? "Bill ready"
                      : "Challan ready"}
                </span>
              ) : null}
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
              <div className="gb-upload-wrap">
              <button
                type="button"
                className={`${buttonGhostClass} min-w-[6.25rem]`}
                disabled={readOnly || billBusy}
                aria-busy={billBusy}
                onClick={() => billFileRef.current?.click()}
              >
                {billBusy ? (
                  <Loader2 className="gb-spin h-3.5 w-3.5" aria-hidden />
                ) : null}
                INTELIXA
              </button>
              {billWarnings.length > 0 ? (
                <div className="gb-upload-pop" role="status">
                  <span className="gb-upload-pop-text">
                    Could not read this bill. Please enter the details
                    manually.
                  </span>
                  <button
                    type="button"
                    className="gb-upload-pop-close"
                    onClick={() => setBillWarnings([])}
                    aria-label="Dismiss message"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              </div>
            </div>
          }
          frameWidthClass="gb-sheet gb-sheet-entry"
        >
          <div
            ref={billTrapRef}
            className="gb-entry"
            data-validated={validated ? "" : undefined}
          >
            {error ? (
              <div className="gb-entry-alert" role="alert" key={error}>
                <span className="gb-entry-alert-text">{error}</span>
                <button
                  type="button"
                  className="gb-entry-alert-close"
                  onClick={() => setError(null)}
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
                <i className="gb-entry-alert-timer" aria-hidden />
              </div>
            ) : null}
            <div className="gb-entry-main">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Sr. No.">
                <input className={inputClass} value={draft.srNo} readOnly />
              </Field>
              <Field label="Date">
                <input
                  className={inputClass}
                  type="date"
                  autoComplete="off"
                  required
                  value={draft.billDate}
                  disabled={readOnly}
                  onChange={(e) => patch({ billDate: e.target.value })}
                />
              </Field>
              <Field label="Bill No.">
                <input
                  className={inputClass}
                  autoComplete="off"
                  required
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
                  required
                  value={draft.challanNo}
                  disabled={readOnly}
                  onChange={(e) => patch({ challanNo: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field
                label="Knitter Name"
                className={`gb-req${draft.knitterId ? "" : " gb-empty"}`}
              >
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
                <SearchableSelect
                  value={draft.agent}
                  options={agentOptions}
                  disabled={readOnly}
                  placeholder="Search agent"
                  onChange={(id) => patch({ agent: id })}
                />
              </Field>
            </div>

            <div className="gb-entry-grid">
              <div
                ref={itemGridScrollRef}
                className="gb-entry-scroll"
              >
              <table className="erp-table gb-entry-table">
                <colgroup>
                  <col className="w-[2.6rem]" />
                  <col />
                  <col className="w-[7.5rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[3.5rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[8.5rem]" />
                  {!readOnly ? <col className="w-[2.9rem]" /> : null}
                </colgroup>
                <thead>
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
                  <tr className="gb-entry-filler" aria-hidden>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    {!readOnly ? <td /> : null}
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="num">{entryTotals.rolls}</td>
                    <td className="num">{entryTotals.qty}</td>
                    <td />
                    <td />
                    <td className="num">
                      {live ? formatRupeeAmount(live.goodsAmount) : ""}
                    </td>
                    {!readOnly ? <td /> : null}
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
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

            <div className="gb-entry-tail grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="gb-total space-y-1">
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

            </div>

            <div className="gb-entry-foot">
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
          flushBody
          overlayClassName="gb-sheet-overlay"
          headerClassName="gb-sheet-head justify-between px-4 py-2"
          closeClassName="gb-sheet-close gp-close"
          portal
          frameWidthClass="gb-sheet gb-sheet-roll"
        >
          <div className="gb-roll">
          <div className="gb-roll-top">
          {!readOnly ? (
            <GreyChallanUploadButton busy={challanBusy} onFile={uploadChallan} />
          ) : null}
          {challanNote ? (
            <p className="mb-2 text-[12px] text-amber-900">{challanNote}</p>
          ) : null}
          </div>
          <div className="gb-roll-scroll">
          <table className="erp-table gb-roll-table">
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
          <div className="gb-roll-sum">
            <span>
              Rolls entered
              <strong>{rollStats(draft.rolls).totalRolls}</strong>
            </span>
            <span>
              Total weight
              <strong>{formatKg(rollStats(draft.rolls).totalWeight)} KG</strong>
            </span>
          </div>
          <div className="gb-entry-foot">
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
            className="gb-confirm"
            role="dialog"
            aria-labelledby="delete-grey-bill-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-grey-bill-title"
              className="text-[15px] font-semibold text-(--ink)"
            >
              Delete Grey Purchase
            </h2>
            <p className="mt-1.5 text-[13px] text-(--muted)">
              Delete Grey Purchase {pendingDelete.srNo}? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-1.5">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${buttonClass} gb-danger`}
                onClick={() => void confirmDeleteBill()}
              >
                Delete Grey Purchase
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
