"use client";

import { useMemo, useRef, useState } from "react";
import { Factory, Plus, Send, Trash2, X } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
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
import { lookupColorCode } from "@/server/actions/color-codes";
import {
  createMillProgram,
  updateMillProgram,
  type MillProgramInput,
  type MillProgramRecord,
  type MillProgramSource,
  type MillProgramStatus,
} from "@/server/actions/mill-program-entries";

type Line = { id: string; rolls: string; codeNo: string; colour: string };

type Program = {
  id: string;
  srNo: string;
  date: string;
  dateOfIssue: string | null;
  millId: string;
  mill: string;
  item: string;
  knitter: string;
  challanNo: string;
  inwardId: string;
  inwardSrNo: string;
  typeOfFinish: string;
  gsm: string;
  width: string;
  lines: Line[];
  programmedRolls: number;
  remainingRolls: number;
  originalRolls: number;
  status: MillProgramStatus;
  sentAt: string | null;
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

function formatDisplayDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function emptyLine(): Line {
  return { id: crypto.randomUUID(), rolls: "", codeNo: "", colour: "" };
}

function nextSrNo(rows: Program[], isoDate: string) {
  const stamp = dateStamp(isoDate);
  const used = rows
    .filter((row) => row.srNo.endsWith(`-${stamp}`))
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function programLineRolls(lines: Line[]) {
  return lines.reduce((sum, line) => sum + num(line.rolls), 0);
}

function allocatedProgramRolls(
  programs: Program[],
  inwardId: string,
  excludeId?: string | null,
) {
  return programs
    .filter(
      (row) =>
        row.status !== "draft" &&
        row.inwardId === inwardId &&
        row.id !== excludeId,
    )
    .reduce((sum, row) => sum + row.programmedRolls, 0);
}

function isBlankLine(line: Line) {
  return !line.rolls.trim() && !line.codeNo.trim() && !line.colour.trim();
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parsePositiveRolls(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function blankProgram(srNo: string): Program {
  return {
    id: crypto.randomUUID(),
    srNo,
    date: todayIso(),
    dateOfIssue: null,
    millId: "",
    mill: "",
    item: "",
    knitter: "",
    challanNo: "",
    inwardId: "",
    inwardSrNo: "",
    typeOfFinish: "",
    gsm: "",
    width: "",
    lines: [emptyLine(), emptyLine(), emptyLine()],
    programmedRolls: 0,
    remainingRolls: 0,
    originalRolls: 0,
    status: "saved",
    sentAt: null,
  };
}

function toProgram(record: MillProgramRecord): Program {
  const lines = record.lines.map((line) => ({ ...line }));
  return {
    id: record.id,
    srNo: record.srNo,
    date: record.date,
    dateOfIssue: record.dateOfIssue || null,
    millId: record.millId,
    mill: record.millName,
    item: record.itemLabel,
    knitter: record.knitterName,
    challanNo: record.challanNo,
    inwardId: record.inwardId,
    inwardSrNo: record.inwardSrNo,
    typeOfFinish: record.typeOfFinish,
    gsm: record.gsm,
    width: record.width,
    lines: lines.length > 0 ? lines : [emptyLine()],
    programmedRolls: record.programmedRolls,
    remainingRolls: Math.max(0, record.originalRolls - record.programmedRolls),
    originalRolls: record.originalRolls,
    status: record.status,
    sentAt: record.sentAt,
  };
}

function toInput(program: Program, status: MillProgramStatus): MillProgramInput {
  return {
    programDate: program.date || todayIso(),
    millId: program.millId,
    millInwardEntryId: program.inwardId,
    itemLabel: program.item,
    typeOfFinish: program.typeOfFinish,
    gsm: program.gsm,
    width: program.width,
    status,
    lines: program.lines.map((line) => ({
      rolls: line.rolls,
      codeNo: line.codeNo,
      colour: line.colour,
    })),
  };
}

export function MillProgramDesk({
  programs,
  sources,
}: {
  programs: MillProgramRecord[];
  sources: MillProgramSource[];
}) {
  const [rows, setRows] = useState<Program[]>(() => programs.map(toProgram));
  const [tab, setTab] = useState<"programs" | "grey">("programs");
  const [draft, setDraft] = useState<Program | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const colorLookupRef = useRef(
    new Map<string, { token: number; pendingKey: string | null; settledKey: string | null }>(),
  );

  const mills = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of sources) {
      if (row.millId && !seen.has(row.millId)) seen.set(row.millId, row.mill);
    }
    if (draft?.millId && draft.mill && !seen.has(draft.millId)) {
      seen.set(draft.millId, draft.mill);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [draft?.mill, draft?.millId, sources]);

  const availableRows = useMemo(
    () =>
      sources.map((inward) => {
        const original = inward.rollCount;
        const programmed = allocatedProgramRolls(rows, inward.id);
        return {
          inward,
          original,
          programmed,
          remaining: original - programmed,
        };
      }),
    [rows, sources],
  );

  const totals = useMemo(() => {
    const available = availableRows.reduce((sum, row) => sum + row.original, 0);
    const programmed = availableRows.reduce(
      (sum, row) => sum + row.programmed,
      0,
    );
    return {
      available,
      programmed,
      remaining: available - programmed,
      programs: rows.length,
    };
  }, [availableRows, rows.length]);

  const selectedInward = draft
    ? sources.find((row) => row.id === draft.inwardId) ?? null
    : null;

  const itemOptions = useMemo(() => {
    if (!draft?.millId) return [];
    const names = [
      ...new Set(
        sources
          .filter((row) => row.millId === draft.millId)
          .map((row) => row.item)
          .filter(Boolean),
      ),
    ];
    if (draft.item && !names.includes(draft.item)) names.push(draft.item);
    return names.sort();
  }, [draft?.item, draft?.millId, sources]);

  const inwardOptions = useMemo(() => {
    if (!draft?.millId || !draft.item) return [];
    const matched = availableRows.filter(
      (row) =>
        row.inward.millId === draft.millId && row.inward.item === draft.item,
    );
    if (
      draft.inwardId &&
      !matched.some((row) => row.inward.id === draft.inwardId)
    ) {
      const source = sources.find((row) => row.id === draft.inwardId);
      if (source) {
        const programmed = allocatedProgramRolls(rows, source.id);
        matched.unshift({
          inward: source,
          original: source.rollCount,
          programmed,
          remaining: source.rollCount - programmed,
        });
      }
    }
    return matched;
  }, [availableRows, draft?.inwardId, draft?.item, draft?.millId, rows, sources]);

  const availableForDraft = useMemo(() => {
    if (!draft?.inwardId) return 0;
    const original = selectedInward ? selectedInward.rollCount : draft.originalRolls;
    return original - allocatedProgramRolls(rows, draft.inwardId, draft.id);
  }, [draft, rows, selectedInward]);

  const programmedForDraft = draft ? programLineRolls(draft.lines) : 0;
  const remainingForDraft = availableForDraft - programmedForDraft;
  const overLimit = Boolean(draft?.inwardId) && programmedForDraft > availableForDraft;

  function patch(partial: Partial<Program>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function applySource(inward: MillProgramSource) {
    patch({
      inwardId: inward.id,
      inwardSrNo: inward.srNo,
      millId: inward.millId,
      mill: inward.mill,
      item: inward.item,
      knitter: inward.knitter,
      challanNo: inward.challanNo,
      dateOfIssue: inward.dateOfIssue,
      originalRolls: inward.rollCount,
    });
  }

  function openCreate() {
    setDraft(blankProgram(nextSrNo(rows, todayIso())));
    setMode("create");
    setError(null);
  }

  function openEdit(row: Program) {
    setDraft({
      ...row,
      lines: row.lines.map((line) => ({ ...line })),
    });
    setMode("edit");
    setError(null);
  }

  function closeModal() {
    colorLookupRef.current.clear();
    setDraft(null);
    setMode(null);
    setError(null);
  }

  function changeMill(millId: string) {
    const mill = sources.find((row) => row.millId === millId);
    patch({
      millId,
      mill: mill?.mill ?? "",
      item: "",
      inwardId: "",
      inwardSrNo: "",
      knitter: "",
      challanNo: "",
      dateOfIssue: null,
      originalRolls: 0,
    });
  }

  function changeItem(item: string) {
    patch({
      item,
      inwardId: "",
      inwardSrNo: "",
      knitter: "",
      challanNo: "",
      dateOfIssue: null,
      originalRolls: 0,
    });
  }

  function setLine(id: string, partial: Partial<Line>) {
    if (!draft) return;
    patch({
      lines: draft.lines.map((line) =>
        line.id === id ? { ...line, ...partial } : line,
      ),
    });
  }

  function addLine() {
    if (!draft) return;
    patch({ lines: [...draft.lines, emptyLine()] });
  }

  function removeLine(id: string) {
    if (!draft) return;
    colorLookupRef.current.delete(id);
    const next = draft.lines.filter((line) => line.id !== id);
    patch({ lines: next.length > 0 ? next : [emptyLine()] });
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
      return;
    }
    if (current.pendingKey === key || current.settledKey === key) return;
    const token = current.token + 1;
    colorLookupRef.current.set(lineId, {
      token,
      pendingKey: key,
      settledKey: null,
    });
    void lookupColorCode(key)
      .then((result) => {
        const latest = colorLookupRef.current.get(lineId);
        if (!latest || latest.token !== token) return;
        colorLookupRef.current.set(lineId, {
          token,
          pendingKey: null,
          settledKey: key,
        });
        if (result.status === "not_found") {
          setDraft((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              lines: prev.lines.map((line) =>
                line.id === lineId && line.codeNo.trim() === key
                  ? { ...line, colour: "" }
                  : line,
              ),
            };
          });
          setError(`Color code "${key}" was not found.`);
          return;
        }
        if (result.status !== "found") return;
        setDraft((prev) => {
          if (!prev) return prev;
          const line = prev.lines.find((row) => row.id === lineId);
          if (!line || line.codeNo.trim() !== key || line.colour === result.colorName) {
            return prev;
          }
          return {
            ...prev,
            lines: prev.lines.map((row) =>
              row.id === lineId ? { ...row, colour: result.colorName } : row,
            ),
          };
        });
        setError((prev) =>
          prev?.startsWith("Color code ") && prev.endsWith(" was not found.")
            ? null
            : prev,
        );
      })
      .catch((err: unknown) => {
        const latest = colorLookupRef.current.get(lineId);
        if (!latest || latest.token !== token) return;
        colorLookupRef.current.set(lineId, {
          token,
          pendingKey: null,
          settledKey: null,
        });
        setError(
          err instanceof Error ? err.message : "Could not look up the color code.",
        );
      });
  }

  function validateDraft(current: Program) {
    if (!current.millId.trim() || !current.item.trim()) {
      return "Select mill and item.";
    }
    if (!current.inwardId) {
      return "Select a Mill Inward source.";
    }
    if (
      !current.typeOfFinish.trim() ||
      !current.gsm.trim() ||
      !current.width.trim()
    ) {
      return "Enter type of finish, GSM and width.";
    }
    const filled = current.lines.filter((line) => !isBlankLine(line));
    if (filled.length === 0) {
      return "Enter at least one program row.";
    }
    for (const line of filled) {
      if (parsePositiveRolls(line.rolls) === null) {
        return "Each program row must have a whole number of rolls greater than zero.";
      }
      if (!line.codeNo.trim() || !line.colour.trim()) {
        return "Enter code no. and colour on every program row.";
      }
    }
    const programmed = programLineRolls(filled);
    const source = sources.find((row) => row.id === current.inwardId);
    const original = source ? source.rollCount : current.originalRolls;
    const available =
      original - allocatedProgramRolls(rows, current.inwardId, current.id);
    if (programmed > available) {
      return "Programmed rolls exceed available rolls for this Mill Inward.";
    }
    return null;
  }

  function writeProgram(status: MillProgramStatus, notice: (srNo: string) => string) {
    if (!draft || !mode || savingRef.current) return false;
    const creating = mode === "create";
    const currentId = draft.id;
    savingRef.current = true;
    setError(null);
    const run = creating
      ? createMillProgram(toInput(draft, status))
      : updateMillProgram(currentId, toInput(draft, status));
    void run
      .then((record) => {
        const saved = toProgram(record);
        setRows((prev) =>
          creating
            ? [saved, ...prev]
            : prev.map((row) => (row.id === currentId ? saved : row)),
        );
        closeModal();
        setNotice(notice(saved.srNo));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the mill program.");
      })
      .finally(() => {
        savingRef.current = false;
      });
    return true;
  }

  function saveProgram() {
    if (!draft || !mode || savingRef.current) return;
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    const status = draft.status === "draft" ? "saved" : draft.status;
    const creating = mode === "create";
    writeProgram(status, (srNo) => (creating ? `${srNo} saved.` : `${srNo} updated.`));
  }

  function saveProgramDraft() {
    if (!draft || !mode || savingRef.current) return false;
    writeProgram("draft", (srNo) => `Draft ${srNo} saved.`);
    return true;
  }

  const unsaved = useUnsavedClose({
    active: mode != null && draft != null,
    current: draft,
    onDiscard: closeModal,
    onSaveDraft: saveProgramDraft,
  });

  function sendProgram() {
    if (!draft || !mode || draft.status === "sent" || savingRef.current) return;
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    writeProgram("sent", () => "Mill Program sent successfully.");
  }

  return (
    <div className="mp-page">
      <div className="mp-stage">
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
        <Metric label="Available Rolls" value={totals.available} />
        <Metric
          label="Programmed Rolls"
          value={totals.programmed}
          tone={totals.programmed ? "accent" : "neutral"}
        />
        <Metric
          label="Remaining Rolls"
          value={totals.remaining}
          tone={totals.remaining ? "warn" : "neutral"}
        />
        <Metric label="Total Programs" value={totals.programs} />
      </MetricStrip>

      {/* Two stacked registers meant scrolling past the first to reach the
          second. One table now, switched by the block above it, and the
          selected block joins the table so the pairing is visible. The
          Available Grey count stays readable whichever table is showing. */}
      <div className="mp-switch">
        <button
          type="button"
          className="mp-tab"
          data-kind="programs"
          aria-pressed={tab === "programs"}
          onClick={() => setTab("programs")}
        >
          <span className="mp-tab-label">Mill Programs</span>
          <span className="mp-tab-count tabular-nums">{rows.length}</span>
        </button>
        <button
          type="button"
          className="mp-tab"
          data-kind="grey"
          aria-pressed={tab === "grey"}
          onClick={() => setTab("grey")}
        >
          <span className="mp-tab-label">Available Grey</span>
          <span className="mp-tab-count tabular-nums">{totals.remaining}</span>
        </button>
        <button
          type="button"
          className={`${buttonClass} mp-new`}
          onClick={openCreate}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Mill Program
        </button>
      </div>

      {tab === "programs" ? (
      <Panel flush className="mp-panel mp-primary">
        {rows.length === 0 ? (
          <div className="mp-empty">
            <EmptyState
              icon={Factory}
              text="No mill programs yet. Create a program against available grey."
            />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register mp-reg w-full table-fixed">
              <colgroup>
                <col className="w-[6.5rem]" />
                <col className="w-[5.5rem]" />
                <col />
                <col />
                <col />
                <col className="w-[5.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[7rem]" />
                <col className="w-[9.5rem]" />
                <col className="w-[4.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Date</th>
                  <th>Mill</th>
                  <th>Item</th>
                  <th>Knitter</th>
                  <th className="num">Total Rolls</th>
                  <th className="num">Programmed Rolls</th>
                  <th>Type of Finish</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open mill program ${row.srNo}`}
                    className="cursor-pointer hover:bg-(--panel-sunken)"
                    onClick={() => openEdit(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEdit(row);
                      }
                    }}
                  >
                    <td className="font-semibold tabular-nums">{row.srNo}</td>
                    <td className="tabular-nums">
                      {formatDisplayDate(row.date)}
                    </td>
                    <td>{row.mill}</td>
                    <td>{row.item}</td>
                    <td>{row.knitter || "—"}</td>
                    <td className="num tabular-nums">{row.originalRolls}</td>
                    <td className="num tabular-nums">{row.programmedRolls}</td>
                    <td>{row.typeOfFinish}</td>
                    <td>
                      <span
                        data-status={row.status}
                        className={statusBadge(
                          row.status === "sent"
                            ? "SENT_TO_MILL"
                            : row.status === "draft"
                              ? "DRAFT"
                              : "DRAFT",
                        )}
                      >
                        {row.status === "sent"
                          ? "SENT"
                          : row.status === "draft"
                            ? "DRAFT"
                            : "SAVED"}
                      </span>
                      {row.status === "sent" && row.sentAt ? (
                        <span className="mp-sent-at text-[10px] text-(--muted) tabular-nums">
                          {new Date(row.sentAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${buttonTinyClass} mp-open`}
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
      ) : (
      <Panel flush className="mp-panel mp-secondary">
        {availableRows.length === 0 ? (
          <div className="mp-empty">
            <EmptyState text="No mill inward rolls available to program." />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register mp-reg w-full table-fixed">
              <colgroup>
                <col />
                <col />
                <col className="w-[7.5rem]" />
                <col className="w-[7rem]" />
                <col className="w-[8.5rem]" />
                <col className="w-[8.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Mill</th>
                  <th>Item</th>
                  <th>Mill Inward</th>
                  <th className="num">Original Rolls</th>
                  <th className="num">Programmed Rolls</th>
                  <th className="num">Remaining Rolls</th>
                </tr>
              </thead>
              <tbody>
                {availableRows.map((row) => (
                  <tr key={row.inward.id}>
                    <td>{row.inward.mill}</td>
                    <td>{row.inward.item}</td>
                    <td className="font-semibold tabular-nums">
                      {row.inward.srNo}
                    </td>
                    <td className="num tabular-nums">{row.original}</td>
                    <td className="num tabular-nums">{row.programmed}</td>
                    <td className="num tabular-nums">{row.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
      )}

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          flushBody
          portal
          lockScroll
          overlayClassName="mp-sheet-overlay"
          frameWidthClass="mp-sheet"
          closeClassName="gb-sheet-close"
          title={
            mode === "create"
              ? `New Mill Program ${draft.srNo}`
              : `Mill Program ${draft.srNo}`
          }
          onClose={unsaved.requestClose}
        >
          <div className="mp-entry">
            <div className="mp-entry-main">
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}

            <FieldGroup label="Source">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Mill Name">
                  <select
                    className={inputClass}
                    value={draft.millId}
                    disabled={mode === "edit"}
                    onChange={(e) => changeMill(e.target.value)}
                  >
                    <option value="">Select mill</option>
                    {mills.map(([millId, millName]) => (
                      <option key={millId} value={millId}>
                        {millName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Item Name">
                  <select
                    className={inputClass}
                    value={draft.item}
                    disabled={mode === "edit" || !draft.millId}
                    onChange={(e) => changeItem(e.target.value)}
                  >
                    <option value="">
                      {draft.millId ? "Select item" : "Select mill first"}
                    </option>
                    {itemOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {draft.millId && draft.item ? (
                <div>
                  {inwardOptions.length > 0 && (
                    <TableWrap maxHeight={false} className="mp-picker">
                      <table className="erp-table mp-picker-table">
                        <thead>
                          <tr>
                            <th className="w-8" />
                            <th>Sr. No.</th>
                            <th>Date of Issue</th>
                            <th className="num">Available</th>
                            <th>Item</th>
                            <th>Knitter</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inwardOptions.map((row) => {
                            const available =
                              row.inward.id === draft.inwardId
                                ? availableForDraft
                                : row.remaining;
                            return (
                              <tr
                                key={row.inward.id}
                                className={
                                  draft.inwardId === row.inward.id
                                    ? "bg-(--panel-sunken)"
                                    : mode === "create"
                                      ? "cursor-pointer hover:bg-(--panel-sunken)"
                                      : ""
                                }
                                onClick={() => {
                                  if (mode === "create") applySource(row.inward);
                                }}
                              >
                                <td>
                                  <input
                                    type="radio"
                                    name="mill-inward-source"
                                    checked={draft.inwardId === row.inward.id}
                                    disabled={mode === "edit"}
                                    onChange={() => applySource(row.inward)}
                                  />
                                </td>
                                <td className="font-semibold tabular-nums">
                                  {row.inward.srNo}
                                </td>
                                <td className="tabular-nums">
                                  {formatDisplayDate(row.inward.dateOfIssue)}
                                </td>
                                <td className="num tabular-nums">{available}</td>
                                <td>{row.inward.item}</td>
                                <td>{row.inward.knitter || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TableWrap>
                  )}
                </div>
              ) : null}

              {draft.inwardId ? (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="No. of Rolls">
                    <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                      {draft.originalRolls}
                    </p>
                  </Field>
                  <Field label="Item Name">
                    <p className="py-1.5 text-[12.5px]">{draft.item}</p>
                  </Field>
                  <Field label="Knitter Name">
                    <p className="py-1.5 text-[12.5px]">
                      {draft.knitter || "—"}
                    </p>
                  </Field>
                  <Field label="Knitter's Challan No.">
                    <p className="py-1.5 text-[12.5px]">
                      {draft.challanNo || "—"}
                    </p>
                  </Field>
                </div>
              ) : null}
            </FieldGroup>

            <FieldGroup label="Program details">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Type of Finish">
                  <input
                    className={inputClass}
                    value={draft.typeOfFinish}
                    onChange={(e) => patch({ typeOfFinish: e.target.value })}
                  />
                </Field>
                <Field label="GSM">
                  <input
                    className={inputClass}
                    value={draft.gsm}
                    inputMode="decimal"
                    onChange={(e) => patch({ gsm: e.target.value })}
                  />
                </Field>
                <Field label="Width">
                  <input
                    className={inputClass}
                    value={draft.width}
                    onChange={(e) => patch({ width: e.target.value })}
                  />
                </Field>
              </div>
            </FieldGroup>

            <div>
              <p className="mb-1 text-[12px] font-medium text-(--muted)">
                Program grid
              </p>
              <table className="erp-table mp-line-table w-full table-fixed">
                <colgroup>
                  <col className="w-[3.25rem]" />
                  <col className="w-[7rem]" />
                  <col className="w-[9rem]" />
                  <col />
                  <col className="w-[2.9rem]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="w-12">No.</th>
                    <th>No. of Rolls</th>
                    <th>Code No.</th>
                    <th>Colour</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td className="font-semibold tabular-nums">{index + 1}</td>
                      <td>
                        <input
                          className={`${inputClass} text-right`}
                          value={line.rolls}
                          inputMode="numeric"
                          onChange={(e) =>
                            setLine(line.id, { rolls: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className={inputClass}
                          value={line.codeNo}
                          onChange={(e) => {
                            const value = e.target.value;
                            const nextKey = value.trim();
                            const state = colorLookupRef.current.get(line.id);
                            if (state && nextKey !== (state.pendingKey ?? state.settledKey)) {
                              colorLookupRef.current.set(line.id, {
                                token: state.token + 1,
                                pendingKey: null,
                                settledKey: null,
                              });
                            }
                            setLine(line.id, {
                              codeNo: value,
                              ...(nextKey === line.codeNo.trim()
                                ? {}
                                : { colour: "" }),
                            });
                          }}
                          onBlur={(e) => lookupLineColor(line.id, e.currentTarget.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={inputClass}
                          value={line.colour}
                          onChange={(e) =>
                            setLine(line.id, { colour: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={buttonTinyClass}
                          title="Remove row"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  className={buttonGhostClass}
                  onClick={addLine}
                >
                  <Plus className="h-3 w-3" />
                  Add row
                </button>
                <div className="space-x-3 text-[12px] font-semibold tabular-nums">
                  <span>Programmed Rolls: {programmedForDraft}</span>
                  <span>Available Rolls: {availableForDraft}</span>
                  <span>Remaining Rolls: {remainingForDraft}</span>
                </div>
              </div>
              {overLimit ? (
                <p className="mt-2 text-[11px] text-(--danger)">
                  Programmed rolls exceed available rolls for this Mill Inward.
                  Reduce the allocation before saving.
                </p>
              ) : null}
            </div>
            </div>

            <div className="mp-foot">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonGhostClass}
                onClick={saveProgramDraft}
              >
                Save Draft
              </button>
              <button
                type="button"
                className={buttonGhostClass}
                disabled={overLimit}
                onClick={saveProgram}
              >
                {mode === "create" ? "Save Mill Program" : "Save Changes"}
              </button>
              {draft.status === "draft" ? null : (
              <button
                type="button"
                className={`${buttonClass} mp-send`}
                disabled={overLimit || draft.status === "sent"}
                onClick={sendProgram}
              >
                <Send className="h-3 w-3" />
                {draft.status === "sent" ? "Sent" : "Send Mill Program"}
              </button>
              )}
            </div>
          </div>
        </Overlay>
      ) : null}
      </div>
    </div>
  );
}
