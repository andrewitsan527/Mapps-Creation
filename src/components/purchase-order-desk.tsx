"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { formatMoney, formatQty } from "@/lib/utils";
import { ErpModal as Overlay } from "@/components/erp-modal";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderRecord,
} from "@/server/actions/purchase-orders";
import { type KnitterRecord } from "@/server/actions/knitters";
import { useUnsavedClose } from "@/components/unsaved-changes";
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

const KG_PER_UNIT = 25;

type PurchaseOrderRow = {
  id: string;
  srNo: string;
  knitterId: string;
  knitter: string;
  quality: string;
  qtyUnits: number;
  rate: number;
  agent: string;
  remark: string;
  createdAt: string;
};

type Draft = {
  knitterId: string;
  quality: string;
  qtyUnits: string;
  rate: string;
  agent: string;
  remark: string;
};

const emptyDraft = (): Draft => ({
  knitterId: "",
  quality: "",
  qtyUnits: "",
  rate: "",
  agent: "",
  remark: "",
});

type DateFilter = "today" | "yesterday" | "custom";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateStamp(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${d.getFullYear()}`;
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

function shiftIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nextSrNo(rows: PurchaseOrderRow[], isoDate: string) {
  const stamp = dateStamp(isoDate);
  const used = rows
    .filter((row) => row.srNo.endsWith(`-${stamp}`))
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function actualKg(qtyUnits: number) {
  return qtyUnits * KG_PER_UNIT;
}

function parseDraft(draft: Draft) {
  const knitterId = draft.knitterId.trim();
  const quality = draft.quality.trim();
  const agent = draft.agent.trim();
  const remark = draft.remark.trim();
  const qtyUnits = Number(draft.qtyUnits);
  const rate = Number(draft.rate);
  if (!knitterId || !quality || !agent) return null;
  if (!Number.isFinite(qtyUnits) || qtyUnits <= 0) return null;
  if (!Number.isFinite(rate) || rate < 0) return null;
  return { knitterId, quality, agent, remark, qtyUnits, rate };
}

function OrderFields({
  srNo,
  draft,
  knitters,
  previewKg,
  readOnly,
  onChange,
}: {
  srNo: string;
  draft: Draft;
  knitters: KnitterRecord[];
  previewKg: number | null;
  readOnly: boolean;
  onChange: (next: Draft) => void;
}) {
  const set =
    (key: keyof Draft) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...draft, [key]: event.target.value });
    };

  const shown =
    "flex min-h-[31px] items-center rounded-md border border-(--line) bg-(--panel-sunken) px-2.5 text-[12.5px]";
  const row = "grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-x-3";
  const label = "text-[12px] font-medium text-(--muted)";

  return (
    <div className="space-y-2">
      <div className={row}>
        <span className={label}>SR. NO.</span>
        <p
          tabIndex={0}
          data-po-tab="1"
          className={`${shown} font-semibold tabular-nums`}
        >
          {srNo}
        </p>
      </div>
      <div className={row}>
        <span className={label}>Knitter</span>
        {readOnly ? (
          <p tabIndex={0} data-po-tab="2" className={shown}>
            {knitters.find((row) => row.id === draft.knitterId)?.knitterName || "—"}
          </p>
        ) : (
          <select
            tabIndex={0}
            data-po-tab="2"
            className={inputClass}
            value={draft.knitterId}
            onChange={(event) =>
              onChange({ ...draft, knitterId: event.target.value })
            }
          >
            <option value="">Select</option>
            {knitters.map((row) => (
              <option key={row.id} value={row.id}>
                {row.knitterName}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className={row}>
        <span className={label}>Quality</span>
        {readOnly ? (
          <p tabIndex={0} data-po-tab="3" className={shown}>
            {draft.quality || "—"}
          </p>
        ) : (
          <input
            tabIndex={0}
            data-po-tab="3"
            className={inputClass}
            value={draft.quality}
            onChange={set("quality")}
            placeholder="Valentino NE-4% Micro"
            autoComplete="off"
          />
        )}
      </div>
      <div className={row}>
        <span className={label}>Quantity</span>
        <div className="flex items-center gap-1.5">
          {readOnly ? (
            <p tabIndex={0} data-po-tab="4" className={`${shown} min-w-0 flex-1 tabular-nums`}>
              {draft.qtyUnits || "—"}
            </p>
          ) : (
            <input
              tabIndex={0}
              data-po-tab="4"
              className={`${inputClass} min-w-0 flex-1 text-right`}
              value={draft.qtyUnits}
              onChange={set("qtyUnits")}
              placeholder="24"
              inputMode="decimal"
              autoComplete="off"
            />
          )}
          <p className={`${shown} w-[5.25rem] shrink-0 justify-center font-semibold tabular-nums`}>
            {previewKg != null ? `${formatQty(previewKg)} KG` : "—"}
          </p>
        </div>
      </div>
      <div className={row}>
        <span className={label}>Rate</span>
        <div className="flex items-center gap-1.5">
          {readOnly ? (
            <p tabIndex={0} data-po-tab="5" className={`${shown} min-w-0 flex-1 justify-end tabular-nums`}>
              {draft.rate || "—"}
            </p>
          ) : (
            <input
              tabIndex={0}
              data-po-tab="5"
              className={`${inputClass} min-w-0 flex-1 text-right`}
              value={draft.rate}
              onChange={set("rate")}
              placeholder="170"
              inputMode="decimal"
              autoComplete="off"
            />
          )}
          <span className={`${shown} w-[5.25rem] shrink-0 justify-center text-(--muted)`}>
            ₹
          </span>
        </div>
      </div>
      <div className={row}>
        <span className={label}>Agent</span>
        {readOnly ? (
          <p tabIndex={0} data-po-tab="6" className={shown}>
            {draft.agent || "—"}
          </p>
        ) : (
          <input
            tabIndex={0}
            data-po-tab="6"
            className={inputClass}
            value={draft.agent}
            onChange={set("agent")}
            placeholder="Atul Jain"
            autoComplete="off"
          />
        )}
      </div>
      <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-start gap-x-3">
        <span className={`${label} pt-1.5`}>Remark</span>
        {readOnly ? (
          <p
            tabIndex={0}
            data-po-tab="7"
            className={`${shown} min-h-12 items-start whitespace-pre-wrap py-1.5`}
          >
            {draft.remark || "—"}
          </p>
        ) : (
          <textarea
            tabIndex={0}
            data-po-tab="7"
            rows={2}
            className={`${inputClass} resize-none`}
            value={draft.remark}
            onChange={(event) =>
              onChange({ ...draft, remark: event.target.value })
            }
            placeholder="Full dyeing guarantee"
            autoComplete="off"
          />
        )}
      </div>
    </div>
  );
}

function toRow(row: PurchaseOrderRecord): PurchaseOrderRow {
  return {
    id: row.id,
    srNo: row.srNo,
    knitterId: row.knitterId,
    knitter: row.knitterName,
    quality: row.quality,
    qtyUnits: row.qtyUnits,
    rate: row.rate,
    agent: row.agent,
    remark: row.remark,
    createdAt: row.createdAt,
  };
}

export function PurchaseOrderDesk({
  orders,
  knitters,
}: {
  orders: PurchaseOrderRecord[];
  knitters: KnitterRecord[];
}) {
  const [rows, setRows] = useState<PurchaseOrderRow[]>(() => orders.map(toRow));
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [mode, setMode] = useState<"create" | "edit" | "view" | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [customOpen, setCustomOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState(todayIso());
  const [pendingTo, setPendingTo] = useState(todayIso());
  const customRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(orders.map(toRow));
  }, [orders]);

  const nextSr = nextSrNo(rows, todayIso());
  const draftQty = Number(draft.qtyUnits);
  const draftKg =
    Number.isFinite(draftQty) && draftQty > 0 ? actualKg(draftQty) : null;
  const editQty = Number(editDraft.qtyUnits);
  const editKg =
    Number.isFinite(editQty) && editQty > 0 ? actualKg(editQty) : null;

  const filtered = useMemo(() => {
    const today = todayIso();
    const yesterday = shiftIso(today, -1);
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const inRange =
        dateFilter === "today"
          ? row.createdAt === today
          : dateFilter === "yesterday"
            ? row.createdAt === yesterday
            : row.createdAt >= customFrom && row.createdAt <= customTo;
      if (!inRange) return false;
      if (!q) return true;
      return (
        row.srNo.toLowerCase().includes(q) ||
        row.knitter.toLowerCase().includes(q) ||
        row.quality.toLowerCase().includes(q) ||
        row.agent.toLowerCase().includes(q)
      );
    });
  }, [rows, dateFilter, customFrom, customTo, search]);

  const totalKg = filtered.reduce((sum, row) => sum + actualKg(row.qtyUnits), 0);
  const totalQty = filtered.reduce((sum, row) => sum + row.qtyUnits, 0);

  function closeModal() {
    setMode(null);
    setEditingId(null);
    setDraft(emptyDraft());
    setEditDraft(emptyDraft());
    setError(null);
  }

  const formDraft = mode === "create" ? draft : editDraft;
  const formKg = mode === "create" ? draftKg : editKg;
  const formSr =
    mode === "create"
      ? nextSr
      : rows.find((row) => row.id === editingId)?.srNo ?? nextSr;

  const unsaved = useUnsavedClose({
    active: mode === "create" || mode === "edit",
    current: formDraft,
    onDiscard: closeModal,
  });

  function openCreate() {
    setDraft(emptyDraft());
    setEditingId(null);
    setEditDraft(emptyDraft());
    setError(null);
    setMode("create");
  }

  function openRecord(row: PurchaseOrderRow, nextMode: "edit" | "view") {
    setEditingId(row.id);
    setEditDraft({
      knitterId: row.knitterId,
      quality: row.quality,
      qtyUnits: String(row.qtyUnits),
      rate: String(row.rate),
      agent: row.agent,
      remark: row.remark,
    });
    setError(null);
    setMode(nextMode);
  }

  async function saveNew() {
    const parsed = parseDraft(draft);
    if (!parsed || saving) {
      if (!parsed) {
        setError("Enter knitter, quality, qty (25 kg units), rate and agent.");
      }
      return;
    }
    setSaving(true);
    try {
      const saved = toRow(await createPurchaseOrder(parsed));
      setRows((prev) => [saved, ...prev.filter((row) => row.id !== saved.id)]);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save purchase order.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editingId || saving) return;
    const parsed = parseDraft(editDraft);
    if (!parsed) {
      setError("Enter knitter, quality, qty (25 kg units), rate and agent.");
      return;
    }
    setSaving(true);
    try {
      const saved = toRow(await updatePurchaseOrder(editingId, parsed));
      setRows((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save purchase order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Purchase Order"
        eyebrow="Procure"
        icon={ClipboardList}
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create Purchase Order
          </button>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
        <Metric
          label={dateFilter === "today" ? "Orders today" : "Entries shown"}
          value={filtered.length}
        />
        <Metric label="Total Qty" value={formatQty(totalQty)} />
        <Metric
          label="Actual KG"
          value={`${formatQty(totalKg)} KG`}
          hint={`${KG_PER_UNIT} kg per unit`}
        />
        <Metric label="Next Sr. No." value={nextSr} hint="Today" />
      </MetricStrip>

      <Panel
        title="Purchase Order Register"
        icon={ClipboardList}
        flush
        action={
          <div className="flex items-center gap-1.5">
            <div className="relative flex gap-1" ref={customRef}>
              <button
                type="button"
                className={dateFilter === "today" ? buttonClass : buttonGhostClass}
                onClick={() => {
                  setDateFilter("today");
                  setCustomOpen(false);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className={
                  dateFilter === "yesterday" ? buttonClass : buttonGhostClass
                }
                onClick={() => {
                  setDateFilter("yesterday");
                  setCustomOpen(false);
                }}
              >
                Yesterday
              </button>
              <button
                type="button"
                className={dateFilter === "custom" ? buttonClass : buttonGhostClass}
                onClick={() => {
                  setPendingFrom(customFrom);
                  setPendingTo(customTo);
                  setCustomOpen((open) => !open);
                }}
              >
                {dateFilter === "custom"
                  ? `${formatDisplayDate(customFrom)} – ${formatDisplayDate(customTo)}`
                  : "Custom"}
              </button>
              {customOpen ? (
                <div className="absolute top-full right-0 z-20 mt-1 w-56 rounded-md border border-(--line) bg-white p-2.5 shadow-(--shadow-sm)">
                  <p className="mb-2 text-[12px] font-semibold text-(--ink)">
                    Custom date
                  </p>
                  <Field label="From" className="mb-2">
                    <input
                      className={inputClass}
                      type="date"
                      value={pendingFrom}
                      onChange={(e) => setPendingFrom(e.target.value)}
                    />
                  </Field>
                  <Field label="To" className="mb-2.5">
                    <input
                      className={inputClass}
                      type="date"
                      value={pendingTo}
                      onChange={(e) => setPendingTo(e.target.value)}
                    />
                  </Field>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className={buttonGhostClass}
                      onClick={() => setCustomOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => {
                        const from =
                          pendingFrom <= pendingTo ? pendingFrom : pendingTo;
                        const to =
                          pendingFrom <= pendingTo ? pendingTo : pendingFrom;
                        setCustomFrom(from);
                        setCustomTo(to);
                        setDateFilter("custom");
                        setCustomOpen(false);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <input
              className={`${inputClass} w-56`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Sr. No., knitter, quality, agent"
            />
          </div>
        }
      >

        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState
              icon={ClipboardList}
              text="No purchase orders in this filter."
            />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register po-register w-full table-fixed">
              <colgroup>
                <col className="w-[7.25rem]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[4.5rem]" />
                <col className="w-[6.25rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[12%]" />
                <col className="w-[14rem]" />
                <col className="w-[6.75rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Knitter</th>
                  <th>Quality</th>
                  <th className="num">Qty</th>
                  <th className="num">Actual KG</th>
                  <th className="num">Rate</th>
                  <th>Agent</th>
                  <th>Remark</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap font-semibold tabular-nums">
                      {row.srNo}
                    </td>
                    <td className="max-w-0">
                      <div className="truncate" title={row.knitter}>
                        {row.knitter}
                      </div>
                    </td>
                    <td className="max-w-0">
                      <div className="truncate" title={row.quality}>
                        {row.quality}
                      </div>
                    </td>
                    <td className="num whitespace-nowrap tabular-nums">
                      {row.qtyUnits}
                    </td>
                    <td className="num whitespace-nowrap tabular-nums">
                      {formatQty(actualKg(row.qtyUnits))} KG
                    </td>
                    <td className="num whitespace-nowrap tabular-nums">
                      {formatMoney(row.rate)}
                    </td>
                    <td className="max-w-0">
                      <div className="truncate" title={row.agent}>
                        {row.agent}
                      </div>
                    </td>
                    <td className="max-w-0 text-(--muted)">
                      <div className="truncate" title={row.remark || undefined}>
                        {row.remark || "—"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex gap-1">
                        <button
                          className={buttonTinyClass}
                          type="button"
                          onClick={() => openRecord(row, "view")}
                        >
                          View
                        </button>
                        <button
                          className={buttonTinyClass}
                          type="button"
                          onClick={() => openRecord(row, "edit")}
                        >
                          Edit
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

      {unsaved.dialog}
      {mode ? (
        <Overlay
          form
          trapFocus
          closeTabIndex={-1}
          title={
            mode === "create"
              ? "Create Purchase Order"
              : mode === "edit"
                ? `Edit ${formSr}`
                : `Purchase Order ${formSr}`
          }
          onClose={unsaved.requestClose}
        >
          <div className="space-y-2 px-4 py-3">
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}
            <OrderFields
              srNo={formSr}
              draft={formDraft}
              knitters={knitters}
              previewKg={formKg}
              readOnly={mode === "view"}
              onChange={mode === "create" ? setDraft : setEditDraft}
            />
            <div className="-mx-4 mt-1 flex justify-end gap-1.5 border-t border-(--line) px-4 pt-2.5">
              <button
                type="button"
                tabIndex={-1}
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                {mode === "view" ? "Close" : "Cancel"}
              </button>
              {mode === "view" ? null : (
                <button
                  type="button"
                  tabIndex={0}
                  data-po-tab="8"
                  className={buttonClass}
                  disabled={saving}
                  onClick={() => void (mode === "create" ? saveNew() : saveEdit())}
                >
                  {mode === "create" ? "Save Purchase Order" : "Save"}
                </button>
              )}
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
