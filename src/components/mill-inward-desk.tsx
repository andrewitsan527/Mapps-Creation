"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Plus, Trash2, X } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
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
import type { ItemRecord } from "@/server/actions/items";
import type { KnitterRecord } from "@/server/actions/knitters";
import type { MillRecord } from "@/server/actions/mills";
import {
  createMillInwardEntry,
  sendMillInwardEntry,
  updateMillInwardEntry,
  updateMillInwardQcReturn,
  type MillInwardInput,
  type MillInwardRecord,
} from "@/server/actions/mill-inward-entries";

type Roll = { id: string; weight: string };
type InwardItem = {
  id: string;
  itemId: string;
  name: string;
  rolls: string;
  qty: string;
};
type ReturnLine = { id: string; rolls: string; codeNo: string; colour: string; finishedKg: string };

type Inward = {
  id: string;
  srNo: string;
  date: string;
  dateOfIssue: string | null;
  knitterId: string;
  knitter: string;
  millId: string;
  mill: string;
  itemId: string;
  item: string;
  quantity: string;
  remarks: string;
  rolls: Roll[];
  items: InwardItem[];
  status: "pending" | "completed" | "PENDING" | "SENT";
  sentOn: string | null;
  sourceType: "GREY_PURCHASE" | "MANUAL" | "QC_RETURN";
  sourceId: string | null;
  type?: "NORMAL" | "QC_RETURN";
  qcSrNo?: string;
  finishedWorkSrNo?: string;
  programSrNo?: string;
  knitterChallanNo?: string;
  challanNo?: string;
  code?: string;
  colour?: string;
  failedRolls?: number;
  failedKg?: string;
  grade?: string;
  defectType?: string;
  sendNote?: string;
  sentAt?: string | null;
  returnLines?: ReturnLine[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function nextSrNo(rows: Inward[], isoDate: string) {
  const stamp = dateStamp(isoDate);
  const used = rows
    .filter((row) => row.srNo.endsWith(`-${stamp}`))
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
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

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function emptyRoll(): Roll {
  return { id: crypto.randomUUID(), weight: "" };
}

function rollStats(rolls: Roll[]) {
  const filled = rolls.filter((roll) => roll.weight.trim() !== "");
  const totalWeight = filled.reduce((sum, roll) => sum + num(roll.weight), 0);
  return { totalRolls: filled.length, totalWeight };
}

function displayQty(row: Inward) {
  const rolls = rollStats(row.rolls);
  return rolls.totalWeight > 0 ? rolls.totalWeight : num(row.quantity);
}

function isQcReturn(row: Inward) {
  return row.type === "QC_RETURN" || row.sourceType === "QC_RETURN";
}

function rowRolls(row: Inward) {
  if (isQcReturn(row)) return row.failedRolls ?? 0;
  return rollStats(row.rolls).totalRolls;
}

function rowKg(row: Inward) {
  if (isQcReturn(row)) return num(row.failedKg || row.quantity);
  return displayQty(row);
}

function sourceLabel(row: Inward) {
  if (isQcReturn(row)) return row.qcSrNo ? `QC ${row.qcSrNo}` : "QC";
  if (row.sourceType === "GREY_PURCHASE") return "Grey Purchase";
  return "Manual";
}

function cloneInward(row: Inward): Inward {
  return {
    ...row,
    rolls: row.rolls.map((roll) => ({ ...roll })),
    items: (row.items ?? []).map((item) => ({ ...item })),
    returnLines: row.returnLines?.map((line) => ({ ...line })),
  };
}

function blankInward(srNo: string): Inward {
  return {
    id: crypto.randomUUID(),
    srNo,
    date: todayIso(),
    dateOfIssue: null,
    knitterId: "",
    knitter: "",
    millId: "",
    mill: "",
    itemId: "",
    item: "",
    quantity: "",
    remarks: "",
    rolls: [emptyRoll()],
    items: [],
    status: "pending",
    sentOn: null,
    sourceType: "MANUAL",
    sourceId: null,
  };
}

function toInward(record: MillInwardRecord): Inward {
  const items = record.items.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    name: item.itemName,
    rolls: item.rolls,
    qty: item.qty,
  }));
  const rolls = record.rolls.map((roll) => ({
    id: roll.id,
    weight: roll.weight,
  }));
  const base: Inward = {
    id: record.id,
    srNo: record.srNo,
    date: record.inwardDate,
    dateOfIssue: record.dateOfIssue || null,
    knitterId: record.knitterId,
    knitter: record.knitterName,
    millId: record.millId,
    mill: record.millName,
    itemId: items.length === 1 ? items[0].itemId : "",
    item: record.itemLabel,
    quantity: record.quantity,
    remarks: record.remarks,
    rolls: rolls.length > 0 ? rolls : [emptyRoll()],
    items,
    status: record.status,
    sentOn: record.sentOn || null,
    sourceType: record.sourceType === "QC_RETURN" ? "MANUAL" : record.sourceType,
    sourceId: record.greyBillId || null,
    type: "NORMAL",
  };
  if (record.sourceType === "QC_RETURN" && record.qcReturn) {
    const qc = record.qcReturn;
    return {
      ...base,
      item: qc.itemName || record.itemLabel,
      quantity: qc.failedKg || record.quantity,
      sourceType: "QC_RETURN",
      type: "QC_RETURN",
      sendNote: record.sendNote,
      qcSrNo: qc.qcSrNo,
      finishedWorkSrNo: qc.finishedWorkSrNo,
      programSrNo: qc.programSrNo,
      knitterChallanNo: qc.knitterChallanNo,
      challanNo: qc.challanNo,
      code: qc.code,
      colour: qc.colour,
      failedRolls: qc.failedRolls,
      failedKg: qc.failedKg,
      grade: qc.grade,
      defectType: qc.defectType,
      returnLines: qc.lines,
    };
  }
  return base;
}

function toInput(row: Inward): MillInwardInput {
  const items = row.itemId.trim()
    ? [
        {
          itemId: row.itemId,
          rolls: row.items.find((item) => item.itemId === row.itemId)?.rolls ?? "",
          qty: row.items.find((item) => item.itemId === row.itemId)?.qty ?? "",
        },
      ]
    : row.items
        .filter((item) => item.itemId.trim())
        .map((item) => ({
          itemId: item.itemId,
          rolls: item.rolls,
          qty: item.qty,
        }));
  return {
    inwardDate: row.date || todayIso(),
    dateOfIssue: row.dateOfIssue ?? "",
    knitterId: row.knitterId,
    millId: row.millId,
    quantity: row.quantity,
    remarks: row.remarks,
    items,
    rolls: row.rolls
      .filter((roll) => roll.weight.trim() !== "")
      .map((roll) => ({ weight: roll.weight })),
  };
}


function RollTable({
  rolls,
  readOnly,
  onChange,
}: {
  rolls: Roll[];
  readOnly: boolean;
  onChange: (rolls: Roll[]) => void;
}) {
  const weightRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    weightRefs.current[id]?.focus();
    pendingFocus.current = null;
  }, [rolls.length]);

  function onWeightKey(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Tab" && event.key !== "Enter") return;
    if (event.shiftKey || readOnly) return;
    const next = rolls[index + 1];
    if (next) {
      event.preventDefault();
      weightRefs.current[next.id]?.focus();
      return;
    }
    if (!rolls[index]?.weight.trim()) return;
    event.preventDefault();
    const created = emptyRoll();
    pendingFocus.current = created.id;
    onChange([...rolls, created]);
  }

  function removeRoll(id: string) {
    const remaining = rolls.filter((roll) => roll.id !== id);
    onChange(remaining.length > 0 ? remaining : [emptyRoll()]);
  }

  return (
    <div className="space-y-2">
      <table className="erp-table mi-roll-table">
        <colgroup>
          <col className="w-[3.25rem]" />
          <col />
          {!readOnly ? <col className="w-[3rem]" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th className="w-16">Roll</th>
            <th>Weight (KG)</th>
            {!readOnly ? <th className="w-10" /> : null}
          </tr>
        </thead>
        <tbody>
          {rolls.map((roll, index) => (
            <tr key={roll.id}>
              <td className="font-semibold tabular-nums">{index + 1}</td>
              <td>
                <input
                  ref={(el) => {
                    weightRefs.current[roll.id] = el;
                  }}
                  className={`${inputClass} text-right`}
                  value={roll.weight}
                  disabled={readOnly}
                  inputMode="decimal"
                  onChange={(e) =>
                    onChange(
                      rolls.map((row) =>
                        row.id === roll.id
                          ? { ...row, weight: e.target.value }
                          : row,
                      ),
                    )
                  }
                  onKeyDown={(e) => onWeightKey(index, e)}
                />
              </td>
              {!readOnly ? (
                <td>
                  <button
                    type="button"
                    className={buttonTinyClass}
                    tabIndex={-1}
                    title="Remove roll"
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
      {!readOnly ? (
        <button
          type="button"
          className={buttonGhostClass}
          tabIndex={-1}
          onClick={() => onChange([...rolls, emptyRoll()])}
        >
          <Plus className="h-3 w-3" />
          Add Roll
        </button>
      ) : null}
    </div>
  );
}

export function MillInwardDesk({
  entries,
  knitters,
  mills,
  items,
}: {
  entries: MillInwardRecord[];
  knitters: KnitterRecord[];
  mills: MillRecord[];
  items: ItemRecord[];
}) {
  const [rows, setRows] = useState<Inward[]>(() => entries.map(toInward));
  const [mode, setMode] = useState<"pending" | "completed" | "create" | null>(
    null,
  );
  const [draft, setDraft] = useState<Inward | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "done">("pending");

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const pending = rows.filter(
    (row) =>
      row.status === "pending" ||
      (isQcReturn(row) && row.status === "PENDING"),
  );
  const completed = rows.filter((row) => row.status === "completed");
  const settled = rows.filter(
    (row) =>
      row.status === "completed" ||
      (isQcReturn(row) && row.status === "SENT"),
  );
  const todayCount = rows.filter((row) => row.date === todayIso()).length;
  const readOnly = mode === "completed";

  const draftStats = useMemo(
    () => (draft ? rollStats(draft.rolls) : null),
    [draft],
  );

  function showNotice(text: string) {
    setNotice(text);
  }

  function openPending(row: Inward) {
    setDraft(cloneInward(row));
    setMode("pending");
    setError(null);
  }

  function openCompleted(row: Inward) {
    setDraft(cloneInward(row));
    setMode("completed");
    setError(null);
  }

  function openCreate() {
    setDraft(blankInward(nextSrNo(rows, todayIso())));
    setMode("create");
    setError(null);
  }

  function closeModal() {
    setMode(null);
    setDraft(null);
    setError(null);
  }

  const unsaved = useUnsavedClose({
    active: (mode === "create" || mode === "pending") && draft != null,
    current: draft,
    onDiscard: closeModal,
  });

  function patch(partial: Partial<Inward>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function requireCore(draft: Inward, requireKnitter: boolean) {
    if (!draft.mill.trim() || !draft.item.trim()) {
      return "Enter mill and item.";
    }
    if (requireKnitter && !draft.knitter.trim()) {
      return "Enter knitter, mill and item.";
    }
    return null;
  }

  function saveChanges() {
    if (!draft || mode !== "pending" || savingRef.current) return;
    if (isQcReturn(draft)) {
      const snapshot = draft;
      savingRef.current = true;
      setError(null);
      void updateMillInwardQcReturn(snapshot.id, {
        remarks: snapshot.remarks,
        sendNote: snapshot.sendNote ?? "",
        send: false,
      })
        .then((record) => {
          const saved = toInward(record);
          setRows((prev) => prev.map((row) => (row.id === snapshot.id ? saved : row)));
          closeModal();
          showNotice(`Saved ${saved.srNo}.`);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not save the mill inward.");
        })
        .finally(() => {
          savingRef.current = false;
        });
      return;
    }
    const message = requireCore(
      draft,
      draft.sourceType === "GREY_PURCHASE",
    );
    if (message) {
      setError(message);
      return;
    }
    const snapshot = cloneInward(draft);
    savingRef.current = true;
    setError(null);
    void updateMillInwardEntry(snapshot.id, toInput(snapshot))
      .then((record) => {
        const saved = toInward(record);
        setRows((prev) => prev.map((row) => (row.id === snapshot.id ? saved : row)));
        closeModal();
        showNotice(`Saved ${saved.srNo}.`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the mill inward.");
      })
      .finally(() => {
        savingRef.current = false;
      });
  }

  function sendToMill() {
    if (!draft || mode !== "pending" || savingRef.current) return;
    if (isQcReturn(draft)) {
      const snapshot = draft;
      savingRef.current = true;
      setError(null);
      void updateMillInwardQcReturn(snapshot.id, {
        remarks: snapshot.remarks,
        sendNote: snapshot.sendNote ?? "",
        send: true,
      })
        .then((record) => {
          const saved = toInward(record);
          setRows((prev) => prev.map((row) => (row.id === snapshot.id ? saved : row)));
          closeModal();
          showNotice(`${saved.srNo} sent to mill.`);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not send the mill inward.");
        })
        .finally(() => {
          savingRef.current = false;
        });
      return;
    }
    const sendMessage = requireCore(
      draft,
      draft.sourceType === "GREY_PURCHASE",
    );
    if (sendMessage) {
      setError(sendMessage);
      return;
    }
    const snapshot = cloneInward(draft);
    savingRef.current = true;
    setError(null);
    void sendMillInwardEntry(snapshot.id, toInput(snapshot))
      .then((record) => {
        const saved = toInward(record);
        setRows((prev) => prev.map((row) => (row.id === snapshot.id ? saved : row)));
        closeModal();
        showNotice(`${saved.srNo} sent to mill.`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not send the mill inward.");
      })
      .finally(() => {
        savingRef.current = false;
      });
  }

  function createInward() {
    if (!draft || mode !== "create" || savingRef.current) return;
    const createMessage = requireCore(draft, false);
    if (createMessage) {
      setError(createMessage);
      return;
    }
    const snapshot = cloneInward({
      ...draft,
      dateOfIssue: null,
      knitterId: "",
      knitter: "",
      sourceType: "MANUAL",
      sourceId: null,
    });
    savingRef.current = true;
    setError(null);
    void createMillInwardEntry(toInput(snapshot))
      .then((record) => {
        const saved = toInward(record);
        setRows((prev) => [saved, ...prev]);
        closeModal();
        showNotice(`${saved.srNo} added to pending inward.`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the mill inward.");
      })
      .finally(() => {
        savingRef.current = false;
      });
  }

  return (
    <div className="mi-page">
      <div className="mi-stage">
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

      <MetricStrip className="aw-metrics grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Pending inward"
          value={pending.length}
          tone={pending.length ? "warn" : "neutral"}
        />
        <Metric label="Completed inward" value={completed.length} tone="accent" />
        <Metric label="Total inward" value={rows.length} />
        <Metric label="Today's inward" value={todayCount} hint={formatDisplayDate(todayIso())} />
      </MetricStrip>

      {/* Two stacked registers meant scrolling past the first to reach the
          second. One table now, switched by the block above it, and the
          selected block joins the table so the pairing is visible. */}
      <div className="mi-switch">
        <button
          type="button"
          className="mi-tab"
          data-kind="pending"
          aria-pressed={tab === "pending"}
          onClick={() => setTab("pending")}
        >
          <span className="mi-tab-label">Pending Inward</span>
          <span className="mi-tab-count tabular-nums">{pending.length}</span>
        </button>
        <button
          type="button"
          className="mi-tab"
          data-kind="done"
          aria-pressed={tab === "done"}
          onClick={() => setTab("done")}
        >
          <span className="mi-tab-label">Completed Inward</span>
          <span className="mi-tab-count tabular-nums">{settled.length}</span>
        </button>
        <button
          type="button"
          className={`${buttonClass} mi-new`}
          onClick={openCreate}
        >
          <Plus className="h-3.5 w-3.5" />
          New Mill Inward
        </button>
      </div>

      {tab === "pending" ? (
      <Panel flush className="mi-panel mi-pending">
        {pending.length === 0 ? (
          <div className="mi-empty">
            <EmptyState
              icon={ArrowDownToLine}
              text="No pending inward. New grey bills will appear here, or create a manual inward."
            />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register mi-reg w-full table-fixed">
              <colgroup>
                <col className="w-[5.75rem]" />
                <col className="w-[6rem]" />
                <col className="w-[5rem]" />
                <col />
                <col />
                <col />
                <col className="w-[3.25rem]" />
                <col className="w-[5.75rem]" />
                <col />
                {/* Sent On: empty while pending, but present so both tables
                    share one column layout and switching shifts nothing */}
                <col className="w-[5rem]" />
                <col className="w-[5rem]" />
                <col className="w-[3.75rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Mill</th>
                  <th>Knitter</th>
                  <th>Item</th>
                  <th className="num">Rolls</th>
                  <th className="num">KG</th>
                  <th>Source</th>
                  <th>Sent On</th>
                  <th>Status</th>
                  <th className="!text-center">View</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => {
                  const qcReturn = isQcReturn(row);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open inward ${row.srNo}`}
                      className="cursor-pointer hover:bg-(--panel-sunken)"
                      onClick={() => openPending(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openPending(row);
                        }
                      }}
                    >
                      <td className="font-semibold tabular-nums">{row.srNo}</td>
                      <td>
                        <span
                          className={statusBadge(qcReturn ? "RETURNED" : "NORMAL")}
                        >
                          {qcReturn ? "QC RETURN" : "NORMAL INWARD"}
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {formatDisplayDate(row.date)}
                      </td>
                      <td>{row.mill}</td>
                      <td>{row.knitter || "—"}</td>
                      <td>
                        <div className="erp-clip" title={row.item}>
                          {row.item}
                        </div>
                      </td>
                      <td className="num tabular-nums">{rowRolls(row)}</td>
                      <td className="num tabular-nums">
                        {formatKg(rowKg(row))} KG
                      </td>
                      <td>
                        <div className="erp-clip" title={sourceLabel(row)}>
                          {sourceLabel(row)}
                        </div>
                      </td>
                      <td className="text-(--muted)">&mdash;</td>
                      <td>
                        <span className={statusBadge("PENDING_QC")}>
                          {qcReturn ? "PENDING" : "Pending"}
                        </span>
                      </td>
                      <td className="!text-center">
                        <button
                          type="button"
                          className={`${buttonTinyClass} mi-view`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openPending(row);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
      ) : (
      <Panel flush className="mi-panel mi-done">
        {settled.length === 0 ? (
          <div className="mi-empty">
            <EmptyState text="No completed inward yet." />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register mi-reg w-full table-fixed">
              <colgroup>
                <col className="w-[5.75rem]" />
                <col className="w-[6rem]" />
                <col className="w-[5rem]" />
                <col />
                <col />
                <col />
                <col className="w-[3.25rem]" />
                <col className="w-[5.75rem]" />
                <col />
                <col className="w-[5rem]" />
                <col className="w-[5rem]" />
                <col className="w-[3.75rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Mill</th>
                  <th>Knitter</th>
                  <th>Item</th>
                  <th className="num">Rolls</th>
                  <th className="num">KG</th>
                  <th>Source</th>
                  <th>Sent On</th>
                  <th>Status</th>
                  <th className="!text-center">View</th>
                </tr>
              </thead>
              <tbody>
                {settled.map((row) => {
                  const qcReturn = isQcReturn(row);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open inward ${row.srNo}`}
                      className="cursor-pointer text-(--muted) hover:bg-(--panel-sunken) hover:text-(--ink)"
                      onClick={() => openCompleted(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openCompleted(row);
                        }
                      }}
                    >
                      <td className="font-semibold tabular-nums text-(--ink)">
                        {row.srNo}
                      </td>
                      <td>
                        <span
                          className={statusBadge(qcReturn ? "RETURNED" : "NORMAL")}
                        >
                          {qcReturn ? "QC RETURN" : "NORMAL INWARD"}
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {formatDisplayDate(row.date)}
                      </td>
                      <td>{row.mill}</td>
                      <td>{row.knitter || "—"}</td>
                      <td>
                        <div className="erp-clip" title={row.item}>
                          {row.item}
                        </div>
                      </td>
                      <td className="num tabular-nums">{rowRolls(row)}</td>
                      <td className="num tabular-nums">
                        {formatKg(rowKg(row))} KG
                      </td>
                      <td>
                        <div className="erp-clip" title={sourceLabel(row)}>
                          {sourceLabel(row)}
                        </div>
                      </td>
                      <td className="tabular-nums">
                        {row.sentOn ? formatDisplayDate(row.sentOn) : "—"}
                      </td>
                      <td>
                        {qcReturn ? (
                          <span className={statusBadge("SENT_TO_MILL")}>SENT</span>
                        ) : (
                          <span className={statusBadge("CLOSED")}>Completed</span>
                        )}
                      </td>
                      <td className="!text-center">
                        <button
                          type="button"
                          className={`${buttonTinyClass} mi-view`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openCompleted(row);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
      )}

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          title={
            isQcReturn(draft)
              ? `QC Return ${draft.srNo}`
              : mode === "create"
                ? "New Mill Inward"
                : mode === "completed"
                  ? `Inward ${draft.srNo}`
                  : `Pending inward ${draft.srNo}`
          }
          onClose={unsaved.requestClose}
          closeClassName="gb-sheet-close"
          flushBody
          portal
          trackViewport={isQcReturn(draft)}
          overlayClassName={
            isQcReturn(draft)
              ? "px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-10"
              : "mi-sheet-overlay"
          }
          frameWidthClass={
            isQcReturn(draft)
              ? "mi-qc-sheet h-[min(640px,100%)] max-h-full w-full min-h-0 max-w-[800px] self-stretch md:self-center"
              : "mi-sheet"
          }
        >
          <div className={isQcReturn(draft) ? "flex min-h-0 flex-1 flex-col" : "mi-entry"}>
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}

            {isQcReturn(draft) ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-3">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                  {(
                    [
                      ["Return Sr. No.", draft.srNo],
                      ["Date", formatDisplayDate(draft.date)],
                      ["QC Sr. No.", draft.qcSrNo ?? ""],
                      ["Finished Work Sr. No.", draft.finishedWorkSrNo ?? ""],
                      ["Program Sr. No.", draft.programSrNo ?? ""],
                      ["Knitter Challan No.", draft.knitterChallanNo ?? ""],
                      ["Challan No.", draft.challanNo ?? ""],
                      ["Mill", draft.mill],
                      ["Knitter", draft.knitter],
                      ["Item", draft.item],
                      ["Code", draft.code ?? ""],
                      ["Colour", draft.colour ?? ""],
                      ["Failed Rolls", String(draft.failedRolls ?? 0)],
                      [
                        "Failed KG",
                        draft.failedKg?.trim()
                          ? `${formatKg(num(draft.failedKg))} KG`
                          : "",
                      ],
                      ["Defect Type", draft.defectType ?? ""],
                    ] as const
                  ).map(([label, value]) => (
                    <Field key={label} label={label}>
                      <p className="py-1.5 text-[12.5px]">{value || "—"}</p>
                    </Field>
                  ))}
                </div>
                {draft.returnLines && draft.returnLines.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[12px] font-medium text-(--muted)">
                      Failed rolls
                    </p>
                    <table className="erp-table table-fixed">
                      <colgroup>
                        <col className="w-10" />
                        <col className="w-16" />
                        <col />
                        <col />
                        <col className="w-28" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th className="num">Rolls</th>
                          <th>Code</th>
                          <th>Colour</th>
                          <th className="num">Finished KG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.returnLines.map((line, index) => (
                          <tr key={line.id}>
                            <td className="tabular-nums">{index + 1}</td>
                            <td className="num tabular-nums">{line.rolls}</td>
                            <td className="truncate">{line.codeNo || "—"}</td>
                            <td className="truncate">{line.colour || "—"}</td>
                            <td className="num tabular-nums">
                              {line.finishedKg.trim() ? formatKg(num(line.finishedKg)) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <Field label="Remarks">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={draft.remarks}
                    disabled={readOnly}
                    onChange={(e) => patch({ remarks: e.target.value })}
                  />
                </Field>
                <Field label="Send note">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={draft.sendNote ?? ""}
                    disabled={readOnly}
                    onChange={(e) => patch({ sendNote: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}
            {!isQcReturn(draft) ? (
            <>
            <div className="mi-entry-fields grid grid-cols-1 gap-2 sm:grid-cols-2">
              {mode !== "create" ? (
                <Field label="Sr. No.">
                  <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                    {draft.srNo}
                  </p>
                </Field>
              ) : null}
              {draft.sourceType !== "GREY_PURCHASE" ? (
                <Field label="Date">
                  <input
                    className={inputClass}
                    type="date"
                    value={draft.date}
                    disabled={readOnly}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </Field>
              ) : null}
              {draft.sourceType === "GREY_PURCHASE" ? (
                <Field label="Date of Issue">
                  <input
                    className={inputClass}
                    type="date"
                    value={draft.dateOfIssue ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      patch({ dateOfIssue: e.target.value || null })
                    }
                  />
                </Field>
              ) : null}
              {draft.sourceType === "GREY_PURCHASE" ? (
                <Field label="Knitter Name">
                  <select
                    className={inputClass}
                    value={draft.knitterId}
                    disabled={readOnly}
                    onChange={(e) => {
                      const knitterId = e.target.value;
                      const knitter = knitters.find((row) => row.id === knitterId);
                      patch({ knitterId, knitter: knitter?.knitterName ?? "" });
                    }}
                  >
                    <option value="">Select</option>
                    {knitters.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.knitterName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Mill Name">
                <select
                  className={inputClass}
                  value={draft.millId}
                  disabled={readOnly}
                  onChange={(e) => {
                    const millId = e.target.value;
                    const mill = mills.find((row) => row.id === millId);
                    patch({ millId, mill: mill?.millName ?? "" });
                  }}
                >
                  <option value="">Select</option>
                  {mills.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.millName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Item Name" className="col-span-2">
                <select
                  className={inputClass}
                  value={draft.itemId}
                  disabled={readOnly}
                  onChange={(e) => {
                    const itemId = e.target.value;
                    const master = items.find((row) => row.id === itemId);
                    const name = master?.itemName ?? "";
                    patch({
                      itemId,
                      item: name,
                      items: itemId
                        ? [
                            {
                              id: draft.items.find((row) => row.itemId === itemId)?.id ?? crypto.randomUUID(),
                              itemId,
                              name,
                              rolls: draft.items.find((row) => row.itemId === itemId)?.rolls ?? "",
                              qty: draft.items.find((row) => row.itemId === itemId)?.qty ?? "",
                            },
                          ]
                        : draft.items,
                    });
                  }}
                >
                  {draft.items.length > 1 && !draft.itemId ? (
                    <option value="">{draft.item}</option>
                  ) : (
                    <option value="">Select</option>
                  )}
                  {items.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.itemName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity">
                <input
                  className={`${inputClass} text-right`}
                  value={draft.quantity}
                  disabled={readOnly}
                  inputMode="decimal"
                  onChange={(e) => patch({ quantity: e.target.value })}
                />
              </Field>
              <Field label="Total Weight">
                <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                  {formatKg(draftStats?.totalWeight ?? 0)} KG
                  <span className="ml-1 text-[11px] font-normal text-(--muted)">
                    · {draftStats?.totalRolls ?? 0} rolls
                  </span>
                </p>
              </Field>
            </div>

            <div className="mi-entry-rolls">
              <p className="mb-1 text-[12px] font-medium text-(--muted)">
                Roll / Taka
              </p>
              <RollTable
                rolls={draft.rolls}
                readOnly={readOnly}
                onChange={(rolls) => patch({ rolls })}
              />
            </div>

            {mode === "create" || draft.remarks || !readOnly ? (
              <Field label="Remark" className="mi-entry-remark">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={draft.remarks}
                  disabled={readOnly}
                  onChange={(e) => patch({ remarks: e.target.value })}
                />
              </Field>
            ) : null}
            </>
            ) : null}

            <div className={isQcReturn(draft) ? "flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5" : "mi-foot"}>
              <button
                type="button"
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                {readOnly ? "Close" : "Cancel"}
              </button>
              {mode === "pending" ? (
                <>
                  <button
                    type="button"
                    className={buttonGhostClass}
                    onClick={saveChanges}
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={sendToMill}
                  >
                    Send to Mill
                  </button>
                </>
              ) : null}
              {mode === "create" ? (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={createInward}
                >
                  Create Inward
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
