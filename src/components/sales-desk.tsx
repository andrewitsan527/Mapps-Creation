"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, CreditCard, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { SIDEBAR_CHANGE_EVENT, SIDEBAR_KEY } from "@/components/erp-shell";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { SearchableSelect } from "@/components/searchable-select";
import { statusBadge } from "@/lib/format";
import { formatMoney } from "@/lib/utils";
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
import { lookupColorCode } from "@/server/actions/color-codes";
import {
  listSelectableStockRolls,
  type SelectableStockRoll,
} from "@/server/actions/live-stock";
import {
  createSaleBill,
  deleteSaleBill,
  updateSaleBill,
  type SaleBillInput,
  type SaleCustomerOption,
  type SaleDeskBill,
  type SaleDeskLine,
  type SaleDeskRoll,
  type SaleLookupOption,
} from "@/server/actions/sales-bills";

type LocalSaleBill = SaleDeskBill;
type LocalSaleLine = SaleDeskLine;
type LocalSaleRoll = SaleDeskRoll;

const registerActionClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-(--line) bg-white text-(--ink-soft) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-40";

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const CGST_PCT = 2.5;
const SGST_PCT = 2.5;

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function nextDatedSrNo(srNos: string[], isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  const stamp = `${d}${m}${y}`;
  const used = srNos
    .filter((srNo) => srNo.endsWith(`-${stamp}`))
    .map((srNo) => Number(srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function money2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function billMoney(n: number) {
  return `₹${money2(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(raw: string) {
  return discountPct(raw).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function discountPct(raw: string) {
  const text = raw.trim().replace(/%/g, "");
  if (!text || text === ".") return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

function discountDraft(raw: string) {
  const text = raw.replace(/%/g, "").trim();
  if (!text) return "";
  if (!/^\d*\.?\d*$/.test(text)) return null;
  if (text === ".") return text;
  const n = Number(text.endsWith(".") ? text.slice(0, -1) : text);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return text;
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Display-only weight formatting; stored values stay unrounded. */
function formatKg(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function kgKey(raw: string) {
  const text = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFrac = frac.replace(/0+$/, "");
  return normalizedFrac ? `${normalizedWhole}.${normalizedFrac}` : normalizedWhole;
}

function addKg(values: string[]) {
  let scale = 0;
  const parts = values.map((value) => {
    const text = value.trim();
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    const [whole, frac = ""] = text.split(".");
    scale = Math.max(scale, frac.length);
    return { whole: whole.replace(/^0+(?=\d)/, "") || "0", frac };
  });
  if (parts.some((part) => !part)) return "0";
  let total = BigInt(0);
  const unit = BigInt(10) ** BigInt(scale);
  for (const part of parts) {
    if (!part) continue;
    const frac = (part.frac + "0".repeat(scale)).slice(0, scale);
    total += BigInt(part.whole) * unit + BigInt(frac || "0");
  }
  if (scale === 0) return total.toString();
  const text = total.toString().padStart(scale + 1, "0");
  return `${text.slice(0, -scale)}.${text.slice(-scale)}`;
}

function matchEntryRows(
  rows: LocalSaleRoll[],
  stock: SelectableStockRoll[],
  taken: Set<string>,
) {
  const buckets = new Map<string, SelectableStockRoll[]>();
  for (const roll of stock) {
    if (taken.has(roll.id) || !roll.finishedKg) continue;
    const key = kgKey(roll.finishedKg);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(roll);
    else buckets.set(key, [roll]);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  const byId = new Map(stock.map((roll) => [roll.id, roll]));
  const used = new Set<string>();
  return rows.map((row) => {
    const key = kgKey(row.weight);
    if (!key) return { stock: null, invalid: row.weight.trim().length > 0 };
    const preferred = byId.get(row.liveStockRollId);
    if (
      preferred &&
      !taken.has(preferred.id) &&
      !used.has(preferred.id) &&
      preferred.finishedKg &&
      kgKey(preferred.finishedKg) === key
    ) {
      used.add(preferred.id);
      return { stock: preferred, invalid: false };
    }
    const list = buckets.get(key) ?? [];
    const next = list.find((roll) => !used.has(roll.id));
    if (!next) return { stock: null, invalid: true };
    used.add(next.id);
    return { stock: next, invalid: false };
  });
}

function optionLabel(
  options: { id: string; label: string }[],
  id: string,
) {
  return options.find((opt) => opt.id === id)?.label ?? "";
}

function emptyRoll(): LocalSaleRoll {
  return {
    id: crypto.randomUUID(),
    weight: "",
    liveStockRollId: "",
    rollNo: "",
    stockKg: "",
    qualityState: "",
    reference: "",
  };
}

function emptyLine(): LocalSaleLine {
  return {
    id: crypto.randomUUID(),
    itemId: "",
    itemName: "",
    colourCode: "",
    hsn: "",
    noOfRolls: "",
    rolls: [],
    weightKg: "",
    rate: "",
  };
}

function syncRolls(rolls: LocalSaleRoll[], count: number): LocalSaleRoll[] {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n <= 0) return [];
  if (rolls.length === n) return rolls;
  if (rolls.length > n) return rolls.slice(0, n);
  return [
    ...rolls,
    ...Array.from({ length: n - rolls.length }, () => emptyRoll()),
  ];
}

function lineWeight(line: LocalSaleLine) {
  return line.rolls.reduce((sum, roll) => {
    const w = Number(roll.weight);
    return Number.isFinite(w) && w > 0 ? sum + w : sum;
  }, 0);
}

function lineAmount(line: LocalSaleLine) {
  return money2(lineWeight(line) * num(line.rate));
}

function billTotals(lines: LocalSaleLine[], discount: string, freight: string) {
  const totalRolls = lines.reduce((sum, line) => sum + num(line.noOfRolls), 0);
  const totalWeightKg = lines.reduce((sum, line) => sum + lineWeight(line), 0);
  const grossAmount = money2(
    lines.reduce((sum, line) => sum + lineAmount(line), 0),
  );
  const discountAmount = money2(grossAmount * (discountPct(discount) / 100));
  const freightAmount =
    totalWeightKg > 0 ? money2(num(freight) * totalWeightKg) : 0;
  const taxableAmount = money2(
    Math.max(0, grossAmount - discountAmount + freightAmount),
  );
  const cgstAmount = money2(taxableAmount * (CGST_PCT / 100));
  const sgstAmount = money2(taxableAmount * (SGST_PCT / 100));
  const netAmount = money2(taxableAmount + cgstAmount + sgstAmount);
  return {
    totalRolls,
    totalWeightKg,
    grossAmount,
    discountAmount,
    freightAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    netAmount,
  };
}

/* ---------------------------------------------------------------------
   Presentation sales bills.

   Eighteen bills so the register reads as a working desk. Whatever is in
   the database is ignored here on purpose - the walkthrough needs a fixed
   set that reads the same every time. Restore the real list by returning
   `real` from padBills.

   This closes the chain: every line sells a quality and colour code that
   is sitting in Live Stock, which in turn came through QC, Finished Work,
   Mill Program, Mill Inward, Grey Purchase and the original Purchase
   Order. Colour codes are real rows from the Color Code master.

   The money is derived, not typed: weight x rate gives the gross, GST is
   the same CGST_PCT / SGST_PCT the entry sheet uses, and the totals are
   summed from the lines. Open a bill and the figures will agree.
--------------------------------------------------------------------- */
const SL_KG_PER_ROLL = 24.4;

const SL_PRESENTATION_SPECS: {
  customer: string;
  agent: string;
  transport: string;
  destination: string;
  status: "OPEN" | "DRAFT";
  /** [item, colour code, colour, rolls, rate] */
  lines: [string, string, string, number, number][];
}[] = [
  { customer: "Shreeji Garments", agent: "kanu bhai", transport: "VRL Logistics", destination: "Surat", status: "OPEN",
    lines: [["US POLO", "101", "green", 12, 318], ["US POLO", "102", "white", 8, 318]] },
  { customer: "Riddhi Siddhi Fashion", agent: "Jignesh bhai", transport: "Gati", destination: "Ahmedabad", status: "OPEN",
    lines: [["TWILL", "601", "Red", 10, 292], ["TWILL", "604", "Chikoo", 9, 292]] },
  { customer: "Maruti Textiles", agent: "Ramesh bhai", transport: "VRL Logistics", destination: "Mumbai", status: "OPEN",
    lines: [["VALENTINO", "901", "Mouse", 7, 336]] },
  { customer: "Anand Creation", agent: "kanu bhai", transport: "TCI Express", destination: "Rajkot", status: "DRAFT",
    lines: [["DOUBLE MALTY", "701", "N.Blue", 11, 301], ["DOUBLE MALTY", "705", "Chikoo", 8, 301]] },
  { customer: "Shree Hari Fabrics", agent: "Jignesh bhai", transport: "Gati", destination: "Surat", status: "OPEN",
    lines: [["FRENCH RIB", "301", "D.Pista", 9, 308]] },
  { customer: "Krishna Garments", agent: "Ramesh bhai", transport: "VRL Logistics", destination: "Jaipur", status: "OPEN",
    lines: [["MARIO RIB", "1005", "Onion", 6, 325], ["MARIO RIB", "1011", "B.Pink", 5, 325]] },
  { customer: "Shreeji Garments", agent: "kanu bhai", transport: "TCI Express", destination: "Surat", status: "OPEN",
    lines: [["PEARL MALTY", "201", "B.Green", 8, 341]] },
  { customer: "Laxmi Textile Agency", agent: "Jignesh bhai", transport: "Gati", destination: "Indore", status: "OPEN",
    lines: [["SCRAMBLE", "503", "R.Gold", 7, 329], ["SCRAMBLE", "512", "Grey", 5, 329]] },
  { customer: "Maruti Textiles", agent: "Ramesh bhai", transport: "VRL Logistics", destination: "Mumbai", status: "DRAFT",
    lines: [["FURRY", "402", "D.Lavender", 5, 372]] },
  { customer: "Riddhi Siddhi Fashion", agent: "kanu bhai", transport: "TCI Express", destination: "Ahmedabad", status: "OPEN",
    lines: [["FAZE COTTON", "1202", "Rust", 10, 312], ["FAZE COTTON", "1205", "Onion", 8, 312]] },
  { customer: "Anand Creation", agent: "Jignesh bhai", transport: "Gati", destination: "Rajkot", status: "OPEN",
    lines: [["TWILL", "611", "Rani", 8, 292], ["TWILL", "612", "Olive", 7, 292]] },
  { customer: "Shree Hari Fabrics", agent: "Ramesh bhai", transport: "VRL Logistics", destination: "Surat", status: "OPEN",
    lines: [["US POLO", "103", "blue", 9, 318]] },
  { customer: "Krishna Garments", agent: "kanu bhai", transport: "TCI Express", destination: "Jaipur", status: "OPEN",
    lines: [["VALENTINO", "902", "Chikoo", 6, 336], ["VALENTINO", "913", "Peach", 5, 336]] },
  { customer: "Laxmi Textile Agency", agent: "Jignesh bhai", transport: "Gati", destination: "Indore", status: "DRAFT",
    lines: [["PEARL MALTY", "204", "Brown", 7, 341]] },
  { customer: "Shreeji Garments", agent: "Ramesh bhai", transport: "VRL Logistics", destination: "Surat", status: "OPEN",
    lines: [["DOUBLE MALTY", "706", "Brown", 9, 301]] },
  { customer: "Maruti Textiles", agent: "kanu bhai", transport: "TCI Express", destination: "Mumbai", status: "OPEN",
    lines: [["FRENCH RIB", "305", "B.Pink", 8, 308], ["FRENCH RIB", "307", "Wine", 6, 308]] },
  { customer: "Anand Creation", agent: "Jignesh bhai", transport: "Gati", destination: "Rajkot", status: "OPEN",
    lines: [["FAZE COTTON", "1208", "Wine", 7, 312]] },
  { customer: "Riddhi Siddhi Fashion", agent: "Ramesh bhai", transport: "VRL Logistics", destination: "Ahmedabad", status: "OPEN",
    lines: [["MARIO RIB", "1015", "Airforce", 5, 325], ["SCRAMBLE", "509", "Mustard", 6, 329]] },
];

function slIso(daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The register shows the presentation bills and nothing else. */
function padBills(_real: LocalSaleBill[]): LocalSaleBill[] {
  return SL_PRESENTATION_SPECS.map((spec, index) => {
    const iso = slIso(index);
    const [yyyy, mm, dd] = iso.split("-");
    const stamp = `${iso}T09:00:00.000Z`;

    const lines: LocalSaleLine[] = spec.lines.map(
      ([itemName, colourCode, colour, rolls, rate], lineIndex) => {
        const weight = Math.round(rolls * SL_KG_PER_ROLL * 1000) / 1000;
        return {
          id: `sl-demo-${index + 1}-l${lineIndex + 1}`,
          itemId: "",
          itemName: `${itemName} \u00b7 ${colour}`,
          colourCode,
          hsn: "6006",
          noOfRolls: String(rolls),
          rolls: Array.from({ length: rolls }, (_, i) => ({
            id: `sl-demo-${index + 1}-l${lineIndex + 1}-r${i + 1}`,
            weight: SL_KG_PER_ROLL.toFixed(3),
            /* points at the Live Stock roll this one was sold from */
            liveStockRollId: `ls-demo-${index + 1}-${lineIndex + 1}-r${i + 1}`,
            rollNo: String(i + 1),
            stockKg: SL_KG_PER_ROLL.toFixed(3),
            qualityState: "PASSED",
            reference: `${colourCode}/${i + 1}`,
          })),
          weightKg: weight.toFixed(3),
          rate: rate.toFixed(2),
        } as LocalSaleLine;
      },
    );

    const totalRolls = spec.lines.reduce((sum, line) => sum + line[3], 0);
    const totalWeight =
      Math.round(totalRolls * SL_KG_PER_ROLL * 1000) / 1000;
    const gross = spec.lines.reduce(
      (sum, [, , , rolls, rate]) =>
        sum + Math.round(rolls * SL_KG_PER_ROLL * rate * 100) / 100,
      0,
    );
    const grossAmount = Math.round(gross * 100) / 100;
    const cgstAmount = Math.round(grossAmount * CGST_PCT) / 100;
    const sgstAmount = Math.round(grossAmount * SGST_PCT) / 100;
    const netAmount =
      Math.round((grossAmount + cgstAmount + sgstAmount) * 100) / 100;

    return {
      id: `sl-demo-${index + 1}`,
      billNo: `${String(index + 1).padStart(3, "0")}-${dd}${mm}${yyyy}`,
      billDate: iso,
      challanNo: `SC${7100 + index * 13}`,
      customerId: "",
      customerName: spec.customer,
      agentId: "",
      agentName: spec.agent,
      hasteId: "",
      hasteName: "",
      lrNo: `LR${58000 + index * 17}`,
      transportId: "",
      transportName: spec.transport,
      noOfParcel: String(Math.max(1, Math.round(totalRolls / 6))),
      ewayNumber: `EW${910000 + index * 29}`,
      lrDate: iso,
      destination: spec.destination,
      lines,
      paymentWithinDays: "30",
      discount: "",
      addLessAmount: "",
      freight: "",
      cgstPct: String(CGST_PCT),
      sgstPct: String(SGST_PCT),
      cgstAmount: cgstAmount.toFixed(2),
      sgstAmount: sgstAmount.toFixed(2),
      grossAmount: grossAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      totalRolls: String(totalRolls),
      totalWeightKg: totalWeight.toFixed(3),
      status: spec.status,
      createdAt: stamp,
      updatedAt: stamp,
    } as LocalSaleBill;
  });
}

function blankBill(billNo: string): LocalSaleBill {
  const now = new Date().toISOString();
  const date = todayIso();
  return {
    id: crypto.randomUUID(),
    billNo,
    billDate: date,
    challanNo: "",
    customerId: "",
    customerName: "",
    agentId: "",
    agentName: "",
    hasteId: "",
    hasteName: "",
    lrNo: "",
    transportId: "",
    transportName: "",
    noOfParcel: "",
    ewayNumber: "",
    lrDate: "",
    destination: "",
    lines: [emptyLine()],
    paymentWithinDays: "",
    discount: "",
    addLessAmount: "",
    freight: "",
    cgstPct: String(CGST_PCT),
    sgstPct: String(SGST_PCT),
    cgstAmount: "0",
    sgstAmount: "0",
    grossAmount: "0",
    netAmount: "0",
    totalRolls: "0",
    totalWeightKg: "0",
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  };
}

function cloneBill(bill: LocalSaleBill): LocalSaleBill {
  return {
    ...bill,
    lines: bill.lines.map((line) => ({
      ...line,
      rolls: line.rolls.map((roll) => ({ ...roll })),
    })),
  };
}

function focusables(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    ),
  ).filter((el) => {
    if (el.tabIndex < 0) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

function lineHasEntry(line: LocalSaleLine) {
  return Boolean(
    line.itemId ||
      line.itemName.trim() ||
      line.colourCode ||
      line.hsn.trim() ||
      line.noOfRolls.trim() ||
      line.rate.trim() ||
      line.rolls.some((roll) => roll.weight.trim() || roll.liveStockRollId),
  );
}

function useFocusTrap(
  active: boolean,
  ref: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const lastInside = { current: null as HTMLElement | null };

    function onFocusIn(event: FocusEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ref.current?.contains(target)) lastInside.current = target;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab" || !ref.current) return;
      const list = focusables(ref.current).filter(
        (el) => !el.closest("[data-modal-close]"),
      );
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = Boolean(current && ref.current.contains(current));
      if (!inside) {
        event.preventDefault();
        const restore =
          lastInside.current && ref.current.contains(lastInside.current)
            ? lastInside.current
            : first;
        restore.focus();
        return;
      }
      if (event.shiftKey) {
        if (current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const root = ref.current;
    if (!root) return;
    root.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKey, true);
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [active, ref]);
}

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    function read() {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    }
    read();
    window.addEventListener("storage", read);
    window.addEventListener(SIDEBAR_CHANGE_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(SIDEBAR_CHANGE_EVENT, read);
    };
  }, []);
  return collapsed;
}

export function SalesDesk({
  records,
  customers,
  agents,
  hastes,
  transports,
  items,
}: {
  records: SaleDeskBill[];
  customers: SaleCustomerOption[];
  agents: SaleLookupOption[];
  hastes: SaleLookupOption[];
  transports: SaleLookupOption[];
  items: SaleLookupOption[];
}) {
  const [rows, setRows] = useState<LocalSaleBill[]>(() => padBills(records));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "DRAFT">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const barToolsRef = useRef<HTMLDivElement>(null);

  /* close the bar popovers on an outside click */
  useEffect(() => {
    if (!searchOpen && !rangeOpen) return;
    function onDown(event: MouseEvent) {
      if (!barToolsRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setRangeOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen, rangeOpen]);
  const [dateTo, setDateTo] = useState("");
  const [draft, setDraft] = useState<LocalSaleBill | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view" | null>(null);
  const sidebarCollapsed = useSidebarCollapsed();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rollLineId, setRollLineId] = useState<string | null>(null);
  const [rollDraft, setRollDraft] = useState<LocalSaleRoll[]>([]);
  const weightRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const billTrapRef = useRef<HTMLDivElement>(null);
  const rollTrapRef = useRef<HTMLDivElement>(null);
  const rollScrollRef = useRef<HTMLDivElement>(null);
  const rollPointerFocus = useRef(false);
  const rollAdvanceScroll = useRef<number | null>(null);
  const pendingLineFocus = useRef<string | null>(null);
  const returnFocusLineId = useRef<string | null>(null);
  const savingRef = useRef(false);
  const colorLookupRef = useRef(
    new Map<string, { token: number; pendingKey: string | null; settledKey: string | null }>(),
  );
  const [colourNames, setColourNames] = useState<Record<string, string>>({});
  const [colourMiss, setColourMiss] = useState<Record<string, boolean>>({});
  const [editingColourId, setEditingColourId] = useState<string | null>(null);
  const readOnly = mode === "view";
  useFocusTrap(Boolean(draft && mode && !rollLineId), billTrapRef);
  useFocusTrap(Boolean(rollLineId), rollTrapRef);

  useEffect(() => {
    if (!draft || !mode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [draft, mode]);

  const [stockChoices, setStockChoices] = useState<SelectableStockRoll[]>([]);
  const [stockBusy, setStockBusy] = useState(false);
  const [stockNote, setStockNote] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LocalSaleBill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const stockRequest = useRef(0);

  useEffect(() => {
    if (!draft || !mode || rollLineId) return;
    const starter = billTrapRef.current?.querySelector<HTMLElement>(
      "[data-bill-start]",
    );
    starter?.focus();
    // Focus the first editable field only when the bill popup opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, draft?.id]);

  useEffect(() => {
    const id = pendingLineFocus.current;
    if (!id || !billTrapRef.current) return;
    const target = billTrapRef.current.querySelector<HTMLInputElement>(
      `[data-line-id="${id}"] input:not([disabled])`,
    );
    if (target) {
      pendingLineFocus.current = null;
      target.focus();
      target.closest("tr")?.scrollIntoView({ block: "nearest" });
    }
  }, [draft?.lines]);

  const today = todayIso();
  const live = useMemo(
    () =>
      draft
        ? billTotals(draft.lines, draft.discount, draft.freight)
        : null,
    [draft],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (dateFrom && row.billDate < dateFrom) return false;
      if (dateTo && row.billDate > dateTo) return false;
      if (!q) return true;
      return (
        row.billNo.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        row.agentName.toLowerCase().includes(q)
      );
    });
  }, [dateFrom, dateTo, query, rows, statusFilter]);

  function patch(partial: Partial<LocalSaleBill>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function patchLine(id: string, partial: Partial<LocalSaleLine>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lines: prev.lines.map((line) => {
          if (line.id !== id) return line;
          const next = { ...line, ...partial };
          if (partial.noOfRolls !== undefined) {
            next.rolls = syncRolls(next.rolls, num(next.noOfRolls));
            next.weightKg = String(lineWeight(next) || "");
          }
          return next;
        }),
      };
    });
    setError(null);
  }

  function openCreate() {
    const billNo = nextDatedSrNo(
      rows.map((row) => row.billNo),
      todayIso(),
    );
    setDraft(blankBill(billNo));
    setMode("create");
    setError(null);
    setRollLineId(null);
    clearColourState();
  }

  function openBill(row: LocalSaleBill, nextMode: "edit" | "view") {
    const bill = cloneBill(row);
    setDraft(bill);
    setMode(nextMode);
    setError(null);
    setRollLineId(null);
    clearColourState();
    for (const line of bill.lines) {
      if (line.colourCode.trim()) lookupLineColor(line.id, line.colourCode);
    }
  }

  function closeModal() {
    clearColourState();
    setDraft(null);
    setMode(null);
    setError(null);
    setRollLineId(null);
  }

  function focusLine(id: string) {
    pendingLineFocus.current = id;
    requestAnimationFrame(() => {
      const target = billTrapRef.current?.querySelector<HTMLInputElement>(
        `[data-line-id="${id}"] input:not([disabled])`,
      );
      if (target) {
        pendingLineFocus.current = null;
        target.focus();
        target.closest("tr")?.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function addItemRow() {
    if (!draft || readOnly) return;
    const last = draft.lines[draft.lines.length - 1];
    if (last && !lineHasEntry(last)) {
      focusLine(last.id);
      return;
    }
    const created = emptyLine();
    pendingLineFocus.current = created.id;
    patch({ lines: [...draft.lines, created] });
  }

  function clearColourState() {
    colorLookupRef.current.clear();
    setColourNames({});
    setColourMiss({});
    setEditingColourId(null);
  }

  function forgetColour(lineId: string) {
    setColourNames((prev) => {
      if (!(lineId in prev)) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    setColourMiss((prev) => {
      if (!(lineId in prev)) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  function lookupLineColor(lineId: string, raw: string) {
    const key = raw.trim();
    const current = colorLookupRef.current.get(lineId) ?? {
      token: 0,
      pendingKey: null,
      settledKey: null,
    };
    if (!key) {
      colorLookupRef.current.set(lineId, {
        token: current.token + 1,
        pendingKey: null,
        settledKey: null,
      });
      forgetColour(lineId);
      return;
    }
    if (current.pendingKey === key || current.settledKey === key) return;
    const token = current.token + 1;
    colorLookupRef.current.set(lineId, { token, pendingKey: key, settledKey: null });
    void lookupColorCode(key)
      .then((result) => {
        const latest = colorLookupRef.current.get(lineId);
        if (!latest || latest.token !== token) return;
        colorLookupRef.current.set(lineId, { token, pendingKey: null, settledKey: key });
        if (result.status === "found") {
          setColourNames((prev) => ({ ...prev, [lineId]: result.colorName }));
          setColourMiss((prev) => {
            if (!prev[lineId]) return prev;
            const next = { ...prev };
            delete next[lineId];
            return next;
          });
          setError((prev) =>
            prev?.startsWith("Color code ") && prev.endsWith(" was not found.") ? null : prev,
          );
          return;
        }
        if (result.status === "not_found") {
          forgetColour(lineId);
          setColourMiss((prev) => ({ ...prev, [lineId]: true }));
          setError(`Color code "${key}" was not found.`);
        }
      })
      .catch((err: unknown) => {
        const latest = colorLookupRef.current.get(lineId);
        if (!latest || latest.token !== token) return;
        colorLookupRef.current.set(lineId, { token, pendingKey: null, settledKey: null });
        setError(err instanceof Error ? err.message : "Could not look up the color code.");
      });
  }

  function deleteLine(id: string) {
    colorLookupRef.current.delete(id);
    forgetColour(id);
    setEditingColourId((current) => (current === id ? null : current));
    setDraft((prev) => {
      if (!prev) return prev;
      const remaining = prev.lines.filter((line) => line.id !== id);
      return {
        ...prev,
        lines: remaining.length > 0 ? remaining : [emptyLine()],
      };
    });
  }

  function normalizeEmptyLine(id: string) {
    setDraft((prev) => {
      if (!prev || prev.lines.length < 2) return prev;
      const line = prev.lines.find((row) => row.id === id);
      if (!line || lineHasEntry(line)) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((row) => row.id !== id),
      };
    });
  }

  function restoreRowFocus() {
    const id = returnFocusLineId.current;
    returnFocusLineId.current = null;
    if (!id) return;
    requestAnimationFrame(() => {
      const el = billTrapRef.current?.querySelector<HTMLElement>(
        `[data-line-id="${id}"] [data-details]`,
      );
      el?.focus();
    });
  }

  function entryRows(line: LocalSaleLine) {
    const count = Math.max(0, Math.floor(num(line.noOfRolls)));
    return Array.from({ length: count }, (_, index) => {
      const current = line.rolls[index];
      if (!current) return emptyRoll();
      return {
        ...emptyRoll(),
        id: current.id,
        weight: current.weight,
        liveStockRollId: current.liveStockRollId,
        rollNo: current.rollNo,
        stockKg: current.stockKg,
        qualityState: current.qualityState,
        reference: current.reference,
      };
    });
  }

  function openRolls(line: LocalSaleLine) {
    returnFocusLineId.current = line.id;
    setStockNote(null);
    setStockChoices([]);
    setRollDraft(entryRows(line));
    setRollLineId(line.id);
    if (readOnly) return;
    const colourCode = line.colourCode.trim();
    if (!line.itemId || !colourCode || colourMiss[line.id]) return;
    const billId = mode === "edit" ? draft?.id ?? "" : "";
    const request = stockRequest.current + 1;
    stockRequest.current = request;
    setStockBusy(true);
    void listSelectableStockRolls({
      itemId: line.itemId,
      colourCode,
      billId,
    })
      .then((rows) => {
        if (stockRequest.current !== request) return;
        setStockChoices(rows);
        const ids = new Set(rows.map((row) => row.id));
        setRollDraft((prev) =>
          prev.map((roll) =>
            roll.liveStockRollId && !ids.has(roll.liveStockRollId)
              ? {
                  ...roll,
                  liveStockRollId: "",
                  rollNo: "",
                  stockKg: "",
                  qualityState: "",
                  reference: "",
                }
              : roll,
          ),
        );
      })
      .catch(() => {
        if (stockRequest.current !== request) return;
        setStockNote("Could not load stock rolls.");
      })
      .finally(() => {
        if (stockRequest.current === request) setStockBusy(false);
      });
  }

  function keepEntryVisible(input: HTMLInputElement) {
    const scroller = rollScrollRef.current;
    const row = input.closest("tr");
    const previousScroll = rollAdvanceScroll.current;
    rollAdvanceScroll.current = null;
    if (!scroller || !row || previousScroll == null) return;
    const thead = scroller.querySelector("thead");
    const headerHeight = thead?.getBoundingClientRect().height ?? 0;
    const scrollerRect = scroller.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const topLimit = scrollerRect.top + headerHeight;
    if (
      scroller.scrollTop > previousScroll + 1 ||
      rowRect.bottom > scrollerRect.bottom + 1
    ) {
      scroller.scrollTop += rowRect.bottom - scrollerRect.bottom;
      return;
    }
    if (rowRect.top < topLimit) {
      scroller.scrollTop -= topLimit - rowRect.top;
    }
  }

  function saveRolls() {
    if (!rollLineId || !draft || stockBusy) return;
    const line = draft.lines.find((row) => row.id === rollLineId);
    if (!line) return;
    const need = Math.floor(num(line.noOfRolls));
    if (rollDraft.length !== need) {
      setStockNote(
        need > 0
          ? `Enter exactly ${need} roll weights.`
          : "Enter no. of rolls first.",
      );
      return;
    }
    const taken = new Set(
      draft.lines
        .filter((row) => row.id !== line.id)
        .flatMap((row) => row.rolls.map((roll) => roll.liveStockRollId).filter(Boolean)),
    );
    const matches = matchEntryRows(rollDraft, stockChoices, taken);
    if (matches.some((match) => !match.stock)) {
      setStockNote("Every weight must match a distinct available stock roll.");
      return;
    }
    const rolls = matches.map((match, index) => {
      const stock = match.stock!;
      return {
        ...rollDraft[index],
        weight: stock.finishedKg ?? "",
        liveStockRollId: stock.id,
        rollNo: stock.rollNo,
        stockKg: stock.finishedKg ?? "",
        qualityState: stock.qualityState,
        reference: stock.reference,
      };
    });
    const weight = addKg(rolls.map((roll) => roll.weight));
    patchLine(rollLineId, {
      rolls,
      weightKg: weight === "0" ? "" : weight,
    });
    setRollLineId(null);
    setStockChoices([]);
    setStockNote(null);
    stockRequest.current += 1;
    restoreRowFocus();
  }

  function cancelRolls() {
    stockRequest.current += 1;
    setRollLineId(null);
    setRollDraft([]);
    setStockChoices([]);
    setStockNote(null);
    setStockBusy(false);
  }

  function unlinkStock(rolls: LocalSaleRoll[]) {
    return rolls.map(() => emptyRoll());
  }

  function validate(entry: LocalSaleBill) {
    if (!entry.customerId) return "Select customer name.";
    if (!entry.billDate) return "Enter bill date.";
    const named = entry.lines.filter((line) => line.itemId || line.itemName);
    if (named.length === 0) return "Add at least one item.";
    const usedRolls = new Set<string>();
    for (const line of named) {
      if (!line.itemId) return "Select a valid item.";
      const count = Math.floor(num(line.noOfRolls));
      if (count <= 0) {
        return `Enter no. of rolls for ${line.itemName || "item"}.`;
      }
      if (!line.colourCode.trim()) {
        return `Enter color code for ${line.itemName || "item"}.`;
      }
      if (colourMiss[line.id]) {
        return `Color code "${line.colourCode.trim()}" was not found.`;
      }
      const picked = syncRolls(line.rolls, count)
        .map((roll) => roll.liveStockRollId.trim())
        .filter(Boolean);
      if (picked.length !== count) {
        return `Enter ${count} matching roll weights for ${line.itemName || "item"}.`;
      }
      for (const id of picked) {
        if (usedRolls.has(id)) return "A stock roll is selected more than once.";
        usedRolls.add(id);
      }
    }
    return null;
  }

  function billInput(entry: LocalSaleBill): SaleBillInput {
    return {
      billDate: entry.billDate,
      challanNo: entry.challanNo,
      salesMasterId: entry.customerId,
      hasteId: entry.hasteId,
      lrNo: entry.lrNo,
      transportId: entry.transportId,
      noOfParcel: entry.noOfParcel,
      ewayNumber: entry.ewayNumber,
      lrDate: entry.lrDate,
      destination: entry.destination,
      paymentWithinDays: entry.paymentWithinDays,
      discount: entry.discount,
      addLessAmount: entry.addLessAmount,
      freight: entry.freight,
      lines: entry.lines.map((line) => ({
        itemId: line.itemId,
        colourCode: line.colourCode,
        hsn: line.hsn,
        noOfRolls: line.noOfRolls,
        rate: line.rate,
        rolls: syncRolls(line.rolls, num(line.noOfRolls)).map((roll) => ({
          weight: roll.weight,
          liveStockRollId: roll.liveStockRollId,
        })),
      })),
    };
  }

  function remember(saved: LocalSaleBill, creating: boolean) {
    setRows((prev) =>
      creating
        ? [saved, ...prev.filter((row) => row.id !== saved.id)]
        : prev.map((row) => (row.id === saved.id ? saved : row)),
    );
  }

  function saveBill() {
    if (!draft || !mode || mode === "view" || savingRef.current) return;
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    const creating = mode === "create";
    const input = billInput(draft);
    savingRef.current = true;
    setError(null);
    void (creating
      ? createSaleBill(input, "OPEN")
      : updateSaleBill(draft.id, input, "OPEN")
    )
      .then((saved) => {
        remember(saved, creating);
        closeModal();
        setNotice(
          creating
            ? `Bill ${saved.billNo} saved.`
            : `Bill ${saved.billNo} updated.`,
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the sales bill.");
      })
      .finally(() => {
        savingRef.current = false;
      });
  }

  function saveDraftBill() {
    if (!draft || !mode || mode === "view" || savingRef.current) return false;
    const creating = mode === "create";
    const input = billInput(draft);
    savingRef.current = true;
    setError(null);
    void (creating
      ? createSaleBill(input, "DRAFT")
      : updateSaleBill(draft.id, input, "DRAFT")
    )
      .then((saved) => {
        remember(saved, creating);
        closeModal();
        setNotice(`Draft ${saved.billNo} saved.`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the sales bill.");
      })
      .finally(() => {
        savingRef.current = false;
      });
    return true;
  }

  const billGuard = useUnsavedClose({
    active: (mode === "create" || mode === "edit") && draft != null,
    current: draft,
    onDiscard: closeModal,
    onSaveDraft: saveDraftBill,
  });
  const rollGuard = useUnsavedClose({
    active: Boolean(rollLineId) && !readOnly,
    current: rollDraft,
    onDiscard: cancelRolls,
  });

  async function confirmDeleteBill() {
    if (!pendingDelete || savingRef.current || deleting) return;
    if (pendingDelete.status !== "DRAFT") {
      setError("Only draft sales bills can be deleted.");
      setPendingDelete(null);
      return;
    }
    savingRef.current = true;
    setDeleting(true);
    setError(null);
    try {
      const id = pendingDelete.id;
      const billNo = pendingDelete.billNo;
      await deleteSaleBill(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setPendingDelete(null);
      setNotice(`Draft bill ${billNo} deleted.`);
      if (draft?.id === id) closeModal();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete the sales bill.",
      );
      setPendingDelete(null);
    } finally {
      savingRef.current = false;
      setDeleting(false);
    }
  }

  const rollLine = draft?.lines.find((line) => line.id === rollLineId) ?? null;
  const entryPlan = useMemo(() => {
    const required = rollLine ? Math.max(0, Math.floor(num(rollLine.noOfRolls))) : 0;
    const taken = new Set(
      (draft?.lines ?? [])
        .filter((line) => line.id !== rollLineId)
        .flatMap((line) =>
          line.rolls.map((roll) => roll.liveStockRollId).filter(Boolean),
        ),
    );
    const matches =
      readOnly || stockBusy
        ? rollDraft.map(() => ({ stock: null, invalid: false }))
        : matchEntryRows(rollDraft, stockChoices, taken);
    const matchedWeights = matches.flatMap((match) =>
      match.stock?.finishedKg ? [match.stock.finishedKg] : [],
    );
    const storedWeights = rollDraft
      .map((roll) => roll.weight)
      .filter((weight) => kgKey(weight));
    const colourReady = Boolean(
      rollLine?.itemId &&
        rollLine.colourCode.trim() &&
        !colourMiss[rollLine.id],
    );
    return {
      required,
      matches,
      available: stockChoices.filter((roll) => !taken.has(roll.id)).length,
      total: readOnly ? addKg(storedWeights) : addKg(matchedWeights),
      invalid: matches.some((match) => match.invalid),
      colourReady,
      ready:
        !readOnly &&
        !stockBusy &&
        colourReady &&
        required > 0 &&
        rollDraft.length === required &&
        matches.length === required &&
        matches.every((match) => match.stock),
    };
  }, [
    colourMiss,
    draft?.lines,
    readOnly,
    rollDraft,
    rollLine,
    rollLineId,
    stockBusy,
    stockChoices,
  ]);

  const cellInput = `${inputClass} h-8 py-1`;

  return (
    <div className="sl-page">
      <div className="sl-stage">
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

      <MetricStrip className="aw-metrics sl-metrics grid-cols-2 lg:grid-cols-4">
        <Metric label="Total Bills" value={rows.length} />
        <Metric
          label="Today's Bills"
          value={rows.filter((row) => row.billDate === today).length}
          tone="accent"
        />
        <Metric
          label="Total Sales"
          value={formatMoney(
            rows.reduce((sum, row) => sum + num(row.netAmount), 0),
          )}
        />
        <Metric
          label="Pending / Open Bills"
          value={rows.filter((row) => row.status === "OPEN").length}
          tone={rows.some((row) => row.status === "OPEN") ? "warn" : "neutral"}
        />
      </MetricStrip>

      <Panel
        title="Sales Register"
        flush
        className="sl-panel"
        action={
          <div className="sl-bar-tools" ref={barToolsRef}>
            <div className="sl-pop-wrap">
              <button
                type="button"
                className={`sl-icon-btn${searchOpen || query ? " is-on" : ""}`}
                aria-label="Search bills"
                aria-expanded={searchOpen}
                onClick={() => {
                  setRangeOpen(false);
                  setSearchOpen((open) => !open);
                }}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              {searchOpen ? (
                <div className="sl-pop sl-pop-search">
                  <input
                    autoFocus
                    aria-label="Search"
                    placeholder="Bill no. / customer / agent…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                    }}
                  />
                  {query ? (
                    <button
                      type="button"
                      className="sl-pop-clear"
                      onClick={() => setQuery("")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="sl-pop-wrap">
              <button
                type="button"
                className={`sl-icon-btn${dateFrom || dateTo ? " is-on" : ""}`}
                aria-expanded={rangeOpen}
                aria-label={
                  dateFrom || dateTo
                    ? `Date range ${dateFrom ? formatDisplayDate(dateFrom) : "…"} to ${dateTo ? formatDisplayDate(dateTo) : "…"}`
                    : "Date range"
                }
                title={
                  dateFrom || dateTo
                    ? `${dateFrom ? formatDisplayDate(dateFrom) : "…"} – ${dateTo ? formatDisplayDate(dateTo) : "…"}`
                    : "Date range"
                }
                onClick={() => {
                  setSearchOpen(false);
                  setRangeOpen((open) => !open);
                }}
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
              {rangeOpen ? (
                <div className="sl-pop sl-pop-range">
                  <label>
                    <span>From</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>To</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <div className="sl-pop-actions">
                    <button
                      type="button"
                      className="sl-pop-clear"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="sl-pop-apply"
                      onClick={() => setRangeOpen(false)}
                    >
                      Search
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <select
              className="sl-status"
              aria-label="Status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value === "OPEN" ? "OPEN" : "ALL")
              }
            >
              <option value="ALL">All status</option>
              <option value="OPEN">Open</option>
              <option value="DRAFT">Draft</option>
            </select>

            <button
              className={`${buttonClass} sl-new`}
              type="button"
              onClick={openCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Sales Bill
            </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="sl-empty">
            <EmptyState icon={CreditCard} text="No sales bills yet." />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register sl-reg w-full min-w-[58rem] table-fixed">
              <colgroup>
                <col className="w-[7.5rem]" />
                <col className="w-[6.5rem]" />
                <col />
                <col className="w-[8.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[6.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Bill Date</th>
                  <th>Customer</th>
                  <th>Agent</th>
                  <th className="num">Items</th>
                  <th className="num">Total Rolls</th>
                  <th className="num">Total KG</th>
                  <th className="num">Net Amount</th>
                  <th>Status</th>
                  <th className="!text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap font-medium text-(--ink)">
                      {row.billNo}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {formatDisplayDate(row.billDate)}
                    </td>
                    <td>
                      <div className="erp-clip font-medium" title={row.customerName || undefined}>
                        {row.customerName || "—"}
                      </div>
                    </td>
                    <td>
                      <div className="erp-clip text-(--ink-soft)" title={row.agentName || undefined}>
                        {row.agentName || "—"}
                      </div>
                    </td>
                    <td className="num tabular-nums">
                      {row.lines.filter((line) => line.itemName).length || "—"}
                    </td>
                    <td className="num tabular-nums">{row.totalRolls}</td>
                    <td className="num tabular-nums font-medium">
                      {formatKg(num(row.totalWeightKg))}
                    </td>
                    <td className="num font-semibold text-(--ink)">
                      {formatMoney(num(row.netAmount))}
                    </td>
                    <td>
                      <span className={statusBadge(row.status)}>{row.status}</span>
                    </td>
                    <td>
                      <div className="flex flex-nowrap items-center justify-center gap-1">
                        <button
                          type="button"
                          className={registerActionClass}
                          aria-label={`View sales bill ${row.billNo}`}
                          title="View sales bill"
                          onClick={() => openBill(row, "view")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={registerActionClass}
                          aria-label={
                            row.status === "DRAFT"
                              ? `Open draft bill ${row.billNo}`
                              : `Edit sales bill ${row.billNo}`
                          }
                          title={
                            row.status === "DRAFT" ? "Open draft bill" : "Edit sales bill"
                          }
                          onClick={() => openBill(row, "edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {row.status === "DRAFT" ? (
                          <button
                            type="button"
                            className={`${registerActionClass} hover:border-(--danger) hover:text-(--danger)`}
                            aria-label={`Delete draft bill ${row.billNo}`}
                            title="Delete draft bill"
                            onClick={() => setPendingDelete(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length > 0 ? (
                  <tr className="sl-filler" aria-hidden>
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

      {billGuard.dialog}
      {rollGuard.dialog}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-(--line) bg-(--panel) p-4 shadow-(--shadow-sm)"
            role="dialog"
            aria-labelledby="delete-sale-bill-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-sale-bill-title"
              className="text-[15px] font-semibold text-(--ink)"
            >
              Delete Draft Sales Bill
            </h2>
            <p className="mt-1.5 text-[13px] text-(--muted)">
              Are you sure you want to delete draft bill{" "}
              <strong className="text-(--ink)">{pendingDelete.billNo}</strong>
              {pendingDelete.customerName ? ` (${pendingDelete.customerName})` : ""}?
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-1.5">
              <button
                type="button"
                className={buttonGhostClass}
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pressable inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-transparent bg-(--danger) px-3 py-2 text-[13px] font-semibold text-white shadow-(--shadow-sm) transition hover:bg-(--danger-strong) disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1.5 md:text-[12px]"
                disabled={deleting}
                onClick={() => void confirmDeleteBill()}
              >
                {deleting ? "Deleting…" : "Delete Draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {draft && mode && live ? (
        <Overlay
          flushBody
          portal
          title={
            mode === "create"
              ? "New Sales Bill"
              : mode === "edit"
                ? `Edit Sales Bill ${draft.billNo}`
                : `Sales Bill ${draft.billNo}`
          }
          headerAccessory={
            <span className={statusBadge(draft.status)}>{draft.status}</span>
          }
          closeTabIndex={-1}
          frameWidthClass={`sl-sheet h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none sm:h-[calc(100dvh-1.5rem)] ${
            sidebarCollapsed
              ? "sm:w-[calc(100vw-1.5rem)]"
              : "sm:w-[calc(100vw-1.5rem)] md:w-[calc(100vw-13rem-1.5rem)]"
          }`}
          overlayClassName="[z-index:70] p-2 sm:p-3"
          onClose={billGuard.requestClose}
        >
          <div
            ref={billTrapRef}
            className="flex min-h-0 flex-1 flex-col"
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.defaultPrevented) return;
                const target = e.target as HTMLElement;
                if (target.tagName === "BUTTON") return;
                if (target.tagName !== "INPUT" && target.tagName !== "SELECT") {
                  return;
                }
                if (
                  target.closest("[data-searchable-select]") &&
                  target.getAttribute("aria-expanded") === "true"
                ) {
                  return;
                }
                e.preventDefault();
                if (!readOnly && target.dataset.lineRate === "true") {
                  const rowId = target
                    .closest("tr")
                    ?.getAttribute("data-line-id");
                  const index = draft.lines.findIndex(
                    (line) => line.id === rowId,
                  );
                  const next = draft.lines[index + 1];
                  if (next) {
                    focusLine(next.id);
                    return;
                  }
                  addItemRow();
                  return;
                }
                const root = billTrapRef.current;
                if (!root) return;
                const list = focusables(root).filter(
                  (el) =>
                    !el.closest("[data-bill-footer]") &&
                    !el.closest("[data-modal-close]"),
                );
                const i = list.indexOf(target);
                list[i + 1]?.focus();
              }}
            >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col gap-1.5 px-3 py-1.5 [&_input]:h-8 [&_input]:py-1 sm:px-4">
                {error ? (
                  <p className="shrink-0 rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                    {error}
                  </p>
                ) : null}

                <section className="shrink-0 border-b border-(--line) pb-1.5">
                  <p className="band-label mb-1">Bill information</p>
                  <div className="grid grid-cols-1 gap-x-2 gap-y-1 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Bill No.">
                      <input
                        data-bill-start
                        className={inputClass}
                        value={draft.billNo}
                        readOnly
                      />
                    </Field>
                    <Field label="Bill Date">
                      <input
                        className={inputClass}
                        type="date"
                        value={draft.billDate}
                        disabled={readOnly}
                        onChange={(e) => {
                          const billDate = e.target.value;
                          if (mode === "create") {
                            patch({
                              billDate,
                              billNo: nextDatedSrNo(
                                rows.map((row) => row.billNo),
                                billDate || todayIso(),
                              ),
                            });
                          } else {
                            patch({ billDate });
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
                    <Field label="L.R. No.">
                      <input
                        className={inputClass}
                        value={draft.lrNo}
                        disabled={readOnly}
                        onChange={(e) => patch({ lrNo: e.target.value })}
                      />
                    </Field>
                    <Field label="L.R. Date">
                      <input
                        className={inputClass}
                        type="date"
                        value={draft.lrDate}
                        disabled={readOnly}
                        onChange={(e) => patch({ lrDate: e.target.value })}
                      />
                    </Field>
                  </div>
                </section>

                <section className="shrink-0 border-b border-(--line) pb-1.5">
                  <p className="band-label mb-1">Customer / delivery</p>
                  <div className="grid grid-cols-1 gap-x-2 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Customer Name" className="sm:col-span-2">
                      <SearchableSelect
                        value={draft.customerId}
                        options={customers}
                        disabled={readOnly}
                        placeholder="Search customer"
                        onChange={(id) => {
                          const customer = customers.find((row) => row.id === id);
                          patch({
                            customerId: id,
                            customerName: customer?.label ?? "",
                            agentId: customer?.salesAgentId ?? "",
                            agentName: customer?.agentName ?? "",
                          });
                        }}
                      />
                    </Field>
                    <Field label="Agent">
                      <SearchableSelect
                        value={draft.agentId}
                        options={agents}
                        disabled
                        placeholder="Search agent"
                        onChange={() => undefined}
                      />
                    </Field>
                    <Field label="Haste">
                      <SearchableSelect
                        value={draft.hasteId}
                        options={hastes}
                        disabled={readOnly}
                        placeholder="Search haste"
                        onChange={(id) =>
                          patch({
                            hasteId: id,
                            hasteName: optionLabel(hastes, id),
                          })
                        }
                      />
                    </Field>
                    <Field label="Transport">
                      <SearchableSelect
                        value={draft.transportId}
                        options={transports}
                        disabled={readOnly}
                        placeholder="Search transport"
                        onChange={(id) =>
                          patch({
                            transportId: id,
                            transportName: optionLabel(transports, id),
                          })
                        }
                      />
                    </Field>
                    <Field label="No. of Parcel">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={draft.noOfParcel}
                        disabled={readOnly}
                        onChange={(e) => patch({ noOfParcel: e.target.value })}
                      />
                    </Field>
                    <Field label="E-way Number">
                      <input
                        className={inputClass}
                        value={draft.ewayNumber}
                        disabled={readOnly}
                        onChange={(e) => patch({ ewayNumber: e.target.value })}
                      />
                    </Field>
                    <Field label="To">
                      <input
                        className={inputClass}
                        value={draft.destination}
                        disabled={readOnly}
                        onChange={(e) =>
                          patch({ destination: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </section>

                <section className="flex min-h-[13.5rem] flex-1 flex-col">
                  <div className="mb-1 flex shrink-0 items-center justify-between">
                    <p className="band-label mb-0">Items / goods</p>
                    {!readOnly ? (
                      <button
                        type="button"
                        className={buttonTinyClass}
                        onClick={addItemRow}
                      >
                        + Add Item
                      </button>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border border-(--line) [&_tbody_tr]:scroll-mt-8 [&_tbody_tr]:scroll-mb-10 [&_tbody_input]:scroll-mt-8 [&_tbody_input]:scroll-mb-10 [&_tbody_button]:scroll-mt-8 [&_tbody_button]:scroll-mb-10">
                    <table className="erp-table w-full min-w-[58rem] table-fixed">
                      <colgroup>
                        <col className="w-11" />
                        <col />
                        <col className="w-[10rem]" />
                        <col className="w-[6.5rem]" />
                        <col className="w-[6.5rem]" />
                        <col className="w-[5.5rem]" />
                        <col className="w-[7rem]" />
                        <col className="w-[6.5rem]" />
                        <col className="w-[8rem]" />
                        <col className="w-9" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="text-center">Sr.</th>
                          <th>Item Name</th>
                          <th>Color Code</th>
                          <th>HSN</th>
                          <th className="num">No. of Rolls</th>
                          <th className="text-center">Details</th>
                          <th className="num">Weight KG</th>
                          <th className="num">Rate</th>
                        <th className="num">Amount</th>
                        <th className="w-9" />
                        </tr>
                      </thead>
                      <tbody>
                        {draft.lines.map((line, index) => (
                          <tr
                            key={line.id}
                            data-line-id={line.id}
                            onBlur={(e) => {
                              if (
                                e.currentTarget.contains(
                                  e.relatedTarget as Node,
                                )
                              ) {
                                return;
                              }
                            }}
                          >
                            <td className="text-center tabular-nums">{index + 1}</td>
                            <td>
                              <SearchableSelect
                                value={line.itemId}
                                options={items}
                                disabled={readOnly}
                                placeholder="Search item"
                                onChange={(id) =>
                                  patchLine(line.id, {
                                    itemId: id,
                                    itemName: optionLabel(items, id),
                                    rolls: unlinkStock(line.rolls),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={cellInput}
                                value={
                                  editingColourId === line.id ||
                                  !colourNames[line.id] ||
                                  colourMiss[line.id]
                                    ? line.colourCode
                                    : colourNames[line.id]
                                }
                                disabled={readOnly}
                                aria-label="Color Code"
                                onFocus={(e) => {
                                  if (readOnly) return;
                                  setEditingColourId(line.id);
                                  e.currentTarget.value = line.colourCode;
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const name = colourNames[line.id];
                                  if (
                                    editingColourId !== line.id &&
                                    name &&
                                    !colourMiss[line.id] &&
                                    value.trim() === name.trim()
                                  ) {
                                    return;
                                  }
                                  const nextKey = value.trim();
                                  const state = colorLookupRef.current.get(line.id);
                                  if (state && nextKey !== (state.pendingKey ?? state.settledKey)) {
                                    colorLookupRef.current.set(line.id, {
                                      token: state.token + 1,
                                      pendingKey: null,
                                      settledKey: null,
                                    });
                                  }
                                  if (nextKey !== line.colourCode.trim()) {
                                    forgetColour(line.id);
                                    patchLine(line.id, {
                                      colourCode: value,
                                      rolls: unlinkStock(line.rolls),
                                    });
                                    return;
                                  }
                                  patchLine(line.id, { colourCode: value });
                                }}
                                onBlur={(e) => {
                                  setEditingColourId((current) =>
                                    current === line.id ? null : current,
                                  );
                                  const typed = e.currentTarget.value;
                                  const name = colourNames[line.id];
                                  if (
                                    name &&
                                    !colourMiss[line.id] &&
                                    typed.trim() === name.trim() &&
                                    typed.trim() !== line.colourCode.trim()
                                  ) {
                                    return;
                                  }
                                  lookupLineColor(line.id, typed);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className={cellInput}
                                value={line.hsn}
                                disabled={readOnly}
                                onChange={(e) =>
                                  patchLine(line.id, { hsn: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={`${cellInput} text-right`}
                                inputMode="numeric"
                                value={line.noOfRolls}
                                disabled={readOnly}
                                onChange={(e) =>
                                  patchLine(line.id, {
                                    noOfRolls: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                data-details
                                className={buttonTinyClass}
                                disabled={num(line.noOfRolls) <= 0}
                                onClick={() => openRolls(line)}
                              >
                                Details
                              </button>
                            </td>
                            <td className="num tabular-nums">
                              {lineWeight(line)
                                ? formatKg(lineWeight(line))
                                : "—"}
                            </td>
                            <td>
                              <input
                                className={`${cellInput} text-right`}
                                inputMode="decimal"
                                value={line.rate}
                                disabled={readOnly}
                                data-line-rate="true"
                                onChange={(e) =>
                                  patchLine(line.id, { rate: e.target.value })
                                }
                              />
                            </td>
                            <td className="num font-semibold tabular-nums">
                              {formatMoney(lineAmount(line))}
                            </td>
                            <td className="text-center">
                              {!readOnly && lineHasEntry(line) ? (
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--muted) hover:bg-(--danger-soft) hover:text-(--danger)"
                                  title="Delete item"
                                  aria-label="Delete item"
                                  onClick={() => deleteLine(line.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        <tr className="sl-line-filler" aria-hidden>
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
                        <tr className="font-semibold">
                          <td
                            colSpan={4}
                            className="sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt) text-[11px] tracking-wide uppercase"
                          >
                            Total
                          </td>
                          <td className="num sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt) tabular-nums">
                            {live.totalRolls}
                          </td>
                          <td className="sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt)" />
                          <td className="num sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt) tabular-nums">
                            {formatKg(live.totalWeightKg)}
                          </td>
                          <td className="sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt)" />
                          <td className="num sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt) tabular-nums">
                            {formatMoney(live.grossAmount)}
                          </td>
                          <td className="sticky bottom-0 z-[2] border-t border-(--line) bg-(--panel-alt)" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <section className="shrink-0 border-t border-(--line) pt-1.5">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 lg:grid-cols-4">
                    <Field label="Payment Within Days">
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        disabled={readOnly}
                        value={draft.paymentWithinDays}
                        onChange={(e) =>
                          patch({ paymentWithinDays: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Discount">
                      <div className="relative">
                        <input
                          className={`${inputClass} pr-6`}
                          inputMode="decimal"
                          disabled={readOnly}
                          value={draft.discount}
                          onChange={(e) => {
                            const next = discountDraft(e.target.value);
                            if (next !== null) patch({ discount: next });
                          }}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[12px] text-(--muted)">
                          %
                        </span>
                      </div>
                    </Field>
                    <Field label="Add / Less Amount">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        disabled={readOnly}
                        value={draft.addLessAmount ?? ""}
                        onChange={(e) =>
                          patch({ addLessAmount: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Freight Rate / KG">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        disabled={readOnly}
                        value={draft.freight}
                        onChange={(e) => patch({ freight: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="mt-1.5 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-(--line) bg-(--panel-alt) px-3 py-2 text-[12px] shadow-(--shadow-xs)">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">Gross Amount</span>
                        <span className="tabular-nums font-semibold text-(--ink)">
                          {billMoney(live.grossAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">
                          Discount {formatPct(draft.discount)}%
                        </span>
                        <span className="tabular-nums font-medium text-(--ink-soft)">
                          {billMoney(live.discountAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">Freight Amount</span>
                        <span className="tabular-nums font-medium text-(--ink-soft)">
                          {billMoney(live.freightAmount)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between border-t border-(--line) pt-1">
                        <span className="font-semibold text-(--ink)">Taxable Amount</span>
                        <span className="tabular-nums font-semibold text-(--ink)">
                          {billMoney(live.taxableAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-(--line) bg-(--panel-alt) px-3 py-2 text-[12px] shadow-(--shadow-xs)">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">CGST ({CGST_PCT}%)</span>
                        <span className="tabular-nums font-medium text-(--ink-soft)">
                          {billMoney(live.cgstAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">SGST ({SGST_PCT}%)</span>
                        <span className="tabular-nums font-medium text-(--ink-soft)">
                          {billMoney(live.sgstAmount)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between border-t border-(--line) pt-1">
                        <span className="text-[13px] font-bold text-(--ink)">Net Amount</span>
                        <span className="text-[16px] font-bold tabular-nums text-(--accent-strong)">
                          {billMoney(live.netAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div
              data-bill-footer
              className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-3 py-2 sm:px-4"
            >
                <button
                  type="button"
                  className={buttonGhostClass}
                  onClick={billGuard.requestClose}
                >
                  {mode === "view" ? "Close" : "Cancel"}
                </button>
                {mode !== "view" ? (
                  <>
                    <button
                      type="button"
                      className={buttonGhostClass}
                      onClick={saveDraftBill}
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={saveBill}
                    >
                      Save Sales Bill
                    </button>
                  </>
                ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}

      {rollLine ? (
        <Overlay
          portal
          title="Roll Details"
          frameWidthClass="w-[min(100vw-2rem,454px)] max-h-[calc(100vh-2rem)] overflow-hidden"
          overlayClassName="[z-index:80] p-2 sm:p-4"
          onClose={rollGuard.requestClose}
        >
          <div
            ref={rollTrapRef}
            className="flex min-h-0 flex-col overflow-hidden"
            onFocus={(event) => {
              const target = event.target as HTMLElement;
              if (!target.closest("[data-roll-weight]")) rollAdvanceScroll.current = null;
            }}
          >
            <div className="shrink-0 border-b border-(--line) px-4 py-2">
              <p className="truncate text-[12px] leading-tight">
                <span className="font-semibold text-(--ink)">
                  {rollLine.itemName || "Item"}
                </span>
                <span className="text-(--muted)"> · </span>
                <span className="text-(--ink-soft)">
                  {rollLine.colourCode
                    ? colourNames[rollLine.id] || rollLine.colourCode
                    : "No color"}
                </span>
              </p>
            </div>
            <div
              className={`grid shrink-0 border-b border-(--line) bg-(--panel-alt) ${
                readOnly ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              <div className={`min-w-0 px-4 py-1.5 ${readOnly ? "" : "shadow-[inset_-1px_0_0_var(--line-soft)]"}`}>
                <p className="truncate text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
                  Required
                </p>
                <p
                  className="truncate text-[13px] leading-tight font-semibold tabular-nums text-(--ink)"
                  title="Required rolls"
                >
                  {entryPlan.required}
                </p>
              </div>
              {readOnly ? null : (
                <div className="min-w-0 px-4 py-1.5">
                  <p className="truncate text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
                    Available
                  </p>
                  <p
                    className="truncate text-[13px] leading-tight font-semibold tabular-nums text-(--ink)"
                    title="Available stock rolls"
                  >
                    {stockBusy ? "…" : entryPlan.available}
                  </p>
                </div>
              )}
            </div>
            {stockNote ? (
              <p className="shrink-0 border-b border-(--danger)/40 bg-(--danger-soft) px-3 py-1.5 text-[11px] text-(--danger)">
                {stockNote}
              </p>
            ) : null}
            {!readOnly && !entryPlan.colourReady ? (
              <p className="px-4 py-2 text-[12px] text-(--danger)">
                {!rollLine.itemId || !rollLine.colourCode.trim()
                  ? "Select an item and color code before entering weights."
                  : "Color code was not found."}
              </p>
            ) : (
              <div className="min-h-0 px-4 pt-2.5">
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
                <div ref={rollScrollRef} className="max-h-[15.75rem] overflow-y-auto">
                  <table className="erp-table">
                    <colgroup>
                      <col className="w-16" />
                      <col />
                      {!readOnly ? <col className="w-10" /> : null}
                    </colgroup>
                    <tbody>
                      {rollDraft.map((roll, index) => {
                        const match = entryPlan.matches[index];
                        const invalid = Boolean(match?.invalid);
                        return (
                          <tr key={roll.id}>
                            <td className="font-semibold tabular-nums">{index + 1}</td>
                            <td>
                              {readOnly ? (
                                <span className="block text-right font-medium tabular-nums">
                                  {roll.weight || "—"}
                                </span>
                              ) : (
                                <input
                                  data-roll-weight
                                  className={`${inputClass} text-right tabular-nums ${
                                    invalid ? "border-(--danger)! focus:border-(--danger)!" : ""
                                  }`}
                                  inputMode="decimal"
                                  value={roll.weight}
                                  aria-label={`Weight for roll ${index + 1}`}
                                  aria-invalid={invalid || undefined}
                                  onMouseDown={() => {
                                    rollPointerFocus.current = true;
                                  }}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Tab" &&
                                      !event.shiftKey &&
                                      rollScrollRef.current
                                    ) {
                                      rollAdvanceScroll.current =
                                        rollScrollRef.current.scrollTop;
                                    }
                                  }}
                                  onFocus={(event) => {
                                    if (rollPointerFocus.current) {
                                      rollPointerFocus.current = false;
                                      rollAdvanceScroll.current = null;
                                      return;
                                    }
                                    keepEntryVisible(event.currentTarget);
                                  }}
                                  onChange={(event) => {
                                    const weight = event.target.value;
                                    if (stockNote !== "Could not load stock rolls.") {
                                      setStockNote(null);
                                    }
                                    setRollDraft((prev) =>
                                      prev.map((row, rowIndex) =>
                                        rowIndex === index ? { ...row, weight } : row,
                                      ),
                                    );
                                  }}
                                />
                              )}
                            </td>
                            {!readOnly ? (
                              <td className="text-center">
                                {!match || (!match.stock && !invalid) ? null : match.stock ? (
                                  <Check
                                    className="mx-auto h-3.5 w-3.5 text-(--accent-strong)"
                                    aria-label="Matching stock roll"
                                  />
                                ) : (
                                  <X
                                    className="mx-auto h-3.5 w-3.5 text-(--danger)"
                                    aria-label="No matching stock roll"
                                  />
                                )}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!readOnly && entryPlan.invalid ? (
              <p className="shrink-0 border-t border-(--danger)/30 px-4 py-1.5 text-[11px] text-(--danger)">
                Incorrect weight — no matching available stock roll
              </p>
            ) : null}
            <div className="flex shrink-0 justify-between border-t border-(--line) bg-(--panel) px-4 py-2 text-[12px] font-semibold">
              <span>Total Weight</span>
              <span className="tabular-nums">{entryPlan.total} KG</span>
            </div>
            <div className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={rollGuard.requestClose}
              >
                {readOnly ? "Close" : "Cancel"}
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  className={buttonClass}
                  disabled={!entryPlan.ready}
                  onClick={saveRolls}
                >
                  Confirm
                </button>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}
      </div>
    </div>
  );
}
