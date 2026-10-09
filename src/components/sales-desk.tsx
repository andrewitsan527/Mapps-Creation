"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Plus, Search, Trash2 } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { SearchableSelect } from "@/components/searchable-select";
import { statusBadge } from "@/lib/format";
import { formatMoney } from "@/lib/utils";
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
  createSaleBill,
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

const CGST_PCT = 2.5;
const SGST_PCT = 2.5;

const MOCK_COLOURS = [
  { id: "Black", label: "Black" },
  { id: "White", label: "White" },
  { id: "Navy", label: "Navy" },
  { id: "Grey", label: "Grey" },
];

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

function optionLabel(
  options: { id: string; label: string }[],
  id: string,
) {
  return options.find((opt) => opt.id === id)?.label ?? "";
}

function emptyRoll(): LocalSaleRoll {
  return { id: crypto.randomUUID(), weight: "" };
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
      line.rolls.some((roll) => roll.weight.trim()),
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
  const [rows, setRows] = useState<LocalSaleBill[]>(records);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "DRAFT">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draft, setDraft] = useState<LocalSaleBill | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rollLineId, setRollLineId] = useState<string | null>(null);
  const [rollDraft, setRollDraft] = useState<LocalSaleRoll[]>([]);
  const weightRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const billTrapRef = useRef<HTMLDivElement>(null);
  const rollTrapRef = useRef<HTMLDivElement>(null);
  const pendingLineFocus = useRef<string | null>(null);
  const returnFocusLineId = useRef<string | null>(null);
  const savingRef = useRef(false);
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
  }

  function openBill(row: LocalSaleBill, nextMode: "edit" | "view") {
    setDraft(cloneBill(row));
    setMode(nextMode);
    setError(null);
    setRollLineId(null);
  }

  function closeModal() {
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

  function deleteLine(id: string) {
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

  function openRolls(line: LocalSaleLine) {
    returnFocusLineId.current = line.id;
    if (readOnly) {
      setRollDraft(syncRolls(line.rolls, num(line.noOfRolls)));
      setRollLineId(line.id);
      return;
    }
    const rolls = syncRolls(line.rolls, num(line.noOfRolls));
    patchLine(line.id, {
      rolls,
      weightKg: String(lineWeight({ ...line, rolls }) || ""),
    });
    setRollDraft(rolls.map((roll) => ({ ...roll })));
    setRollLineId(line.id);
  }

  function saveRolls() {
    if (!rollLineId) return;
    const rolls = rollDraft.map((roll) => ({ ...roll }));
    const weight = rolls.reduce((sum, roll) => {
      const w = Number(roll.weight);
      return Number.isFinite(w) && w > 0 ? sum + w : sum;
    }, 0);
    patchLine(rollLineId, {
      rolls,
      weightKg: weight ? String(weight) : "",
    });
    setRollLineId(null);
    restoreRowFocus();
  }

  function cancelRolls() {
    setRollLineId(null);
    setRollDraft([]);
    restoreRowFocus();
  }

  function onRollWeightKey(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = rollDraft[index + 1];
    if (next) weightRefs.current[next.id]?.focus();
  }

  function validate(entry: LocalSaleBill) {
    if (!entry.customerId) return "Select customer name.";
    if (!entry.billDate) return "Enter bill date.";
    const named = entry.lines.filter((line) => line.itemId || line.itemName);
    if (named.length === 0) return "Add at least one item.";
    for (const line of named) {
      if (!line.itemId) return "Select a valid item.";
      if (num(line.noOfRolls) <= 0) {
        return `Enter no. of rolls for ${line.itemName || "item"}.`;
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

  const rollLine = draft?.lines.find((line) => line.id === rollLineId) ?? null;
  const rollWeightTotal = rollDraft.reduce((sum, roll) => {
    const w = Number(roll.weight);
    return Number.isFinite(w) && w > 0 ? sum + w : sum;
  }, 0);

  const cellInput = `${inputClass} h-8 py-1`;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Sales"
        eyebrow="Sell"
        icon={CreditCard}
        description="Create sales bills and review the sales register."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create Sales Bill
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

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
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
        title="Sales register"
        flush
        action={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
              <input
                className={`${inputClass} w-56`}
                aria-label="Search"
                placeholder="Bill no. / customer / agent"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <input
              className={`${inputClass} w-[9.5rem]`}
              type="date"
              aria-label="From"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              className={`${inputClass} w-[9.5rem]`}
              type="date"
              aria-label="To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <select
              className={`${inputClass} w-[8.5rem]`}
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
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={CreditCard} text="No sales bills yet." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register table-fixed">
              <colgroup>
                <col className="w-[7.5rem]" />
                <col className="w-[6.5rem]" />
                <col />
                <col className="w-[8rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[7.5rem]" />
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap font-medium">
                      {row.billNo}
                    </td>
                    <td className="whitespace-nowrap">{row.billDate}</td>
                    <td>
                      <div className="erp-clip" title={row.customerName || undefined}>
                        {row.customerName || "—"}
                      </div>
                    </td>
                    <td>
                      <div className="erp-clip" title={row.agentName || undefined}>
                        {row.agentName || "—"}
                      </div>
                    </td>
                    <td className="num tabular-nums">
                      {row.lines.filter((line) => line.itemName).length || "—"}
                    </td>
                    <td className="num tabular-nums">{row.totalRolls}</td>
                    <td className="num tabular-nums">
                      {formatKg(num(row.totalWeightKg))}
                    </td>
                    <td className="num font-semibold">
                      {formatMoney(num(row.netAmount))}
                    </td>
                    <td>
                      <span className={statusBadge(row.status)}>{row.status}</span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={buttonTinyClass}
                          onClick={() => openBill(row, "view")}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={buttonTinyClass}
                          onClick={() => openBill(row, "edit")}
                        >
                          {row.status === "DRAFT" ? "Open Draft" : "Edit"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {billGuard.dialog}
      {rollGuard.dialog}
      {draft && mode && live ? (
        <div ref={billTrapRef}>
          <Overlay
            wide
            flushBody
            cornerClose
            title=""
            closeTabIndex={-1}
            onClose={billGuard.requestClose}
          >
            <div
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
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 pt-2 pr-9 pb-1.5 [&_input]:h-8 [&_input]:py-1">
                {error ? (
                  <p className="shrink-0 rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                    {error}
                  </p>
                ) : null}

                <section className="shrink-0 border-b border-(--line) pb-1.5">
                  <p className="band-label mb-1">Bill information</p>
                  <div className="grid grid-cols-5 gap-x-2 gap-y-1">
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
                  <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                    <Field label="Customer Name" className="col-span-2">
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

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                    <table className="erp-table table-fixed">
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
                          <th>Colour Code</th>
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
                                  })
                                }
                              />
                            </td>
                            <td>
                              <SearchableSelect
                                value={line.colourCode}
                                options={MOCK_COLOURS}
                                disabled={readOnly}
                                placeholder="Colour"
                                onChange={(id) =>
                                  patchLine(line.id, { colourCode: id })
                                }
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
                  <div className="grid grid-cols-4 gap-x-2 gap-y-1">
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
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-(--line) bg-(--panel-alt) px-2.5 py-1.5 text-[12px]">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">Gross Amount</span>
                        <span className="tabular-nums font-medium">
                          {billMoney(live.grossAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">
                          Discount {formatPct(draft.discount)}%
                        </span>
                        <span className="tabular-nums font-medium">
                          {billMoney(live.discountAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">Freight Amount</span>
                        <span className="tabular-nums font-medium">
                          {billMoney(live.freightAmount)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between border-t border-(--line) pt-1">
                        <span className="font-medium">Taxable Amount</span>
                        <span className="tabular-nums font-medium">
                          {billMoney(live.taxableAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-md border border-(--line) bg-(--panel-alt) px-2.5 py-1.5 text-[12px]">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">CGST (2.5%)</span>
                        <span className="tabular-nums">
                          {billMoney(live.cgstAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-(--muted)">SGST (2.5%)</span>
                        <span className="tabular-nums">
                          {billMoney(live.sgstAmount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between border-t border-(--line) pt-1.5">
                        <span className="font-semibold">Net Amount</span>
                        <span className="text-[16px] font-semibold tabular-nums text-(--ink)">
                          {billMoney(live.netAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div
                data-bill-footer
                className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-3 py-2"
              >
                <button
                  type="button"
                  className={buttonGhostClass}
                  onClick={billGuard.requestClose}
                >
                  Cancel
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
        </div>
      ) : null}

      {rollLine ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[4vw] py-8"
          ref={rollTrapRef}
        >
          <div className="flex max-h-[calc(100vh-4rem)] w-[min(32rem,92vw)] flex-col overflow-hidden rounded-xl border border-(--line) bg-(--panel) shadow-(--shadow-sm)">
            <div className="flex shrink-0 items-center justify-between border-b border-(--line) px-4 py-2">
              <h2 className="text-[14px] font-semibold">Roll Details</h2>
              <button
                type="button"
                className={buttonTinyClass}
                onClick={rollGuard.requestClose}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-3 grid grid-cols-3 gap-2 rounded-md border border-(--line) bg-(--panel-alt) px-3 py-2 text-[12px]">
                <div>
                  <span className="text-[11px] text-(--muted)">Item Name</span>
                  <p className="truncate font-medium">
                    {rollLine.itemName || "—"}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[11px] text-(--muted)">
                    No. of Rolls
                  </span>
                  <p className="font-medium tabular-nums">{rollDraft.length}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-(--muted)">
                    Total Weight
                  </span>
                  <p className="font-semibold tabular-nums">
                    {formatKg(rollWeightTotal)} KG
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-(--line)">
                <table className="erp-table table-fixed">
                  <colgroup>
                    <col className="w-16" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="text-center">Roll</th>
                      <th className="num">Weight (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollDraft.map((roll, index) => (
                      <tr key={roll.id}>
                        <td className="text-center tabular-nums text-(--muted)">
                          {index + 1}
                        </td>
                        <td className="py-1">
                          <input
                            ref={(el) => {
                              weightRefs.current[roll.id] = el;
                            }}
                            className={`${inputClass} h-8 py-1 text-right`}
                            inputMode="decimal"
                            value={roll.weight}
                            disabled={readOnly}
                            onChange={(e) =>
                              setRollDraft((prev) =>
                                prev.map((row) =>
                                  row.id === roll.id
                                    ? { ...row, weight: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            onKeyDown={(e) => onRollWeightKey(index, e)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="border-t border-(--line) bg-(--panel-alt) text-center font-medium tabular-nums">
                        {rollDraft.length}
                      </td>
                      <td className="border-t border-(--line) bg-(--panel-alt) text-right font-semibold tabular-nums">
                        {formatKg(rollWeightTotal)} KG
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={rollGuard.requestClose}
              >
                Cancel
              </button>
              {!readOnly ? (
                <button type="button" className={buttonClass} onClick={saveRolls}>
                  Save
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
