"use client";

import { useMemo, useRef, useState } from "react";
import { BadgeCheck, Plus, Search, Trash2 } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
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
  createQualityCheck,
  updateQualityCheck,
  type QualityCheckDefect,
  type QualityCheckGrade,
  type QualityCheckInput,
  type QualityCheckLineRecord,
  type QualityCheckProgram,
  type QualityCheckRecord,
  type QualityCheckResult,
  type QualityCheckWork,
} from "@/server/actions/quality-checks";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDisplayDate(iso: string | null | undefined) {
  if (!iso) return "—";
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

function emptyLine(): LocalQcLine {
  return { id: crypto.randomUUID(), rolls: "", codeNo: "", colour: "" };
}

function isBlankLine(line: LocalQcLine) {
  return !line.rolls.trim() && !line.codeNo.trim() && !line.colour.trim();
}

function parsePositiveRolls(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function nextSrNo(rows: LocalQc[], isoDate: string) {
  return nextDatedSrNo(
    rows.map((row) => row.srNo),
    isoDate,
  );
}

type Draft = {
  id: string;
  srNo: string;
  date: string;
  search: string;
  finishedWorkId: string;
  programId: string;
  knitterChallanNo: string;
  lines: LocalQcLine[];
  result: LocalQcResult;
  grade: LocalQcGrade | "";
  defectType: LocalQcDefect | "";
  remarks: string;
  createdAt: string;
};

function blankDraft(srNo: string): Draft {
  return {
    id: crypto.randomUUID(),
    srNo,
    date: todayIso(),
    search: "",
    finishedWorkId: "",
    programId: "",
    knitterChallanNo: "",
  const greyKg = Number.isFinite(grey) ? grey : 0;
  const finishedKg = Number.isFinite(finished) ? finished : 0;
  const shortageKg = greyKg - finishedKg;
  return {
    greyKg,
    finishedKg,
    shortageKg,
    shortagePct: greyKg > 0 ? (shortageKg / greyKg) * 100 : 0,
    defectType: "",
    remarks: "",
    createdAt: new Date().toISOString(),
  };
}


export function QualityCheckDesk() {
  const [works, setWorks] = useState<LocalFinishedWork[]>([]);
  const [programs, setPrograms] = useState<LocalMillProgram[]>([]);
  const [rows, setRows] = useState<LocalQc[]>([]);
  lines: QualityCheckLineRecord[];
  result: QualityCheckResult;
  grade: QualityCheckGrade | "";
  defectType: QualityCheckDefect | "";
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    setWorks(loadRecords<LocalFinishedWork>(STORAGE_KEYS.FINISHED_WORK) ?? []);
    setPrograms(loadRecords<LocalMillProgram>(STORAGE_KEYS.MILL_PROGRAM) ?? []);
    setRows(loadRecords<LocalQc>(STORAGE_KEYS.QC) ?? []);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (storageReady) saveRecords(STORAGE_KEYS.QC, rows);
  }, [rows, storageReady]);

  const pendingWorks = useMemo(
    () =>
      works.filter(
        (work) => !rows.some((qc) => qc.finishedWorkId === work.id),
      ),
    [rows, works],
  );

  const remainingRolls = useMemo(
      programs.reduce((sum, program) => {
        const left = Math.max(
          0,
          program.programmedRolls - allocatedRolls(rows, program.id),
        );
        return sum + left;
      }, 0),
    [programs, rows],
  );

  const selectedWork = draft
    ? works.find((row) => row.id === draft.finishedWorkId) ?? null
    : null;
  const selectedProgram = draft
    ? programs.find((row) => row.id === draft.programId) ?? null
    : null;
  const workCalc = selectedWork ? workTotals(selectedWork) : null;

  const programmedRolls = selectedProgram?.programmedRolls ?? 0;
  const previousQc = draft?.programId
    ? allocatedRolls(rows, draft.programId, draft.id)
    : 0;
  const availableRolls = Math.max(0, programmedRolls - previousQc);
  const qcRolls = draft ? lineRolls(draft.lines) : 0;
  const remainingForDraft = availableRolls - qcRolls;
  const overLimit = Boolean(draft?.programId) && qcRolls > availableRolls;
  const readOnly = mode === "view";

  function patch(partial: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function applyFinishedWork(work: QualityCheckWork) {
    const program = programFor(work);
    setLookupError(
      program
        ? null
        : "Finished work found, but no matching Mill Program.",
    );
    const next: Partial<Draft> = {
      search: work.knitterChallanNo,
      finishedWorkId: work.id,
      programId: program?.id ?? "",
      knitterChallanNo: work.knitterChallanNo,
    };
    if (program && mode === "create") {
      next.lines = program.lines.map((line) => ({
        id: crypto.randomUUID(),
        rolls: "",
        codeNo: line.codeNo,
        colour: line.colour,
      }));
    }
    patch(next);
  }

  function searchChallan(raw?: string) {
    const query = (raw ?? draft?.search ?? "").trim().toLowerCase();
    if (!query) {
      setLookupError("Enter Knitter Challan No.");
      return;
    }
    const work = works.find(
      (row) => row.knitterChallanNo.trim().toLowerCase() === query,
    );
    if (!work) {
      setLookupError("No Finished Work found for this Knitter Challan No.");
      patch({
        finishedWorkId: "",
        programId: "",
        knitterChallanNo: "",
      });
      return;
    }
    applyFinishedWork(work);
  }

  function openCreate(work?: QualityCheckWork) {
    const next = blankDraft(nextSrNo(rows, todayIso()));
    setDraft(next);
    setMode("create");
    setError(null);
    setLookupError(null);
    if (work) {
      const program = programFor(work);
      setDraft({
        ...next,
        search: work.knitterChallanNo,
        finishedWorkId: work.id,
        knitterChallanNo: work.knitterChallanNo,
        programId: program?.id ?? "",
        lines: program
          ? program.lines.map((line) => ({
              id: crypto.randomUUID(),
              rolls: "",
              codeNo: line.codeNo,
              colour: line.colour,
            }))
          : next.lines,
      });
    }
  }

  function openRecord(row: QualityCheckRecord, nextMode: "edit" | "view") {
    const work = works.find((item) => item.id === row.finishedWorkId);
    setDraft({
      id: row.id,
      srNo: row.srNo,
      date: row.date,
      search: row.knitterChallanNo,
      finishedWorkId: row.finishedWorkId,
      programId: row.programId,
      knitterChallanNo: row.knitterChallanNo,
      lines: row.lines.map((line) => ({ ...line })),
      result: row.result,
      grade: row.grade,
      defectType: row.defectType,
      remarks: row.remarks,
      createdAt: row.createdAt,
    });
    setMode(nextMode);
    setError(null);
    setLookupError(
      work ? null : "Finished Work record was not found.",
    );
  }

  function closeModal() {
    setDraft(null);
    setMode(null);
    setError(null);
    setLookupError(null);
  }

  const unsaved = useUnsavedClose({
    active: (mode === "create" || mode === "edit") && draft != null,
    current: draft,
    onDiscard: closeModal,
  });

  function setLine(id: string, partial: Partial<QualityCheckLineRecord>) {
    if (!draft) return;
    patch({
      lines: draft.lines.map((line) =>
        line.id === id ? { ...line, ...partial } : line,
      ),
    });
  }

  function setResult(result: QualityCheckResult) {
    if (result === "pass") {
      patch({
        result,
        grade: draft?.grade === "REJECT" || !draft?.grade ? "A" : draft.grade,
        defectType: "",
      });
      return;
    }
    patch({ result, grade: "REJECT" });
  }

  function validate(current: Draft) {
    if (!current.knitterChallanNo.trim() && !current.search.trim()) {
      return "Knitter Challan No. is required.";
    }
    if (!current.finishedWorkId) {
      return "Select a valid Finished Work record.";
    }
    if (!current.programId) {
      return "No matching Mill Program for this challan.";
    }
    const filled = current.lines.filter((line) => !isBlankLine(line));
    if (filled.length === 0) {
      return "Enter at least one QC received row.";
    }
    for (const line of filled) {
      if (parsePositiveRolls(line.rolls) === null) {
        return "Each QC row must have a whole number of rolls greater than zero.";
      }
      if (!line.codeNo.trim() || !line.colour.trim()) {
        return "Enter code no. and colour on every QC row.";
      }
    }
    const programmed =
      programs.find((row) => row.id === current.programId)?.programmedRolls ??
      0;
    const available =
      programmed - allocatedRolls(rows, current.programId, current.id);
    const received = lineRolls(filled);
      remarks: draft.remarks,
      createdAt:
        mode === "create" ? new Date().toISOString() : draft.createdAt,
    };
    let failNote = "";
    if (saved.result === "fail") {
      const outcome = createQcReturnFromFail({
        qc: saved,
        work: works.find((row) => row.id === saved.finishedWorkId) ?? null,
        program:
          programs.find((row) => row.id === saved.programId) ?? null,
      });
      if (!outcome.ok) {
    if (!draft || !mode || mode === "view" || savingRef.current) return;
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    const snapshot = draft;
    const creating = mode === "create";
    const input: QualityCheckInput = {
      qcDate: snapshot.date,
      finishedWorkId: snapshot.finishedWorkId,
      lines: snapshot.lines
        .filter((line) => !isBlankLine(line))
        .map((line) => ({
          rolls: line.rolls,
          codeNo: line.codeNo,
          colour: line.colour,
        })),
    if (received > available) {
      return "QC'd rolls exceed remaining programmed rolls for this Mill Program.";
    }
    return null;
  }

  function saveQc() {
            : prev.map((row) => (row.id === saved.id ? saved : row)),
        );
        const failNote = result.fail
          ? result.fail.created
            ? ` QC Return ${result.fail.srNo} is pending in Mill Inward.`
            : " QC Return already exists in Mill Inward."
          : "";
        closeModal();
        setNotice(
          saved.result === "pass"
            ? `${saved.srNo} passed.`
            : `${saved.srNo} failed.${failNote}`,
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the QC.");
      })
      .finally(() => {
        savingRef.current = false;
      });
          value={pendingWorks.length}
          tone={pendingWorks.length ? "warn" : "neutral"}
        />
        <Metric
          label="QC Passed"
          value={rows.filter((row) => row.result === "pass").length}
          tone="accent"
        />
        <Metric
          label="QC Failed"
          value={rows.filter((row) => row.result === "fail").length}
          tone={rows.some((row) => row.result === "fail") ? "warn" : "neutral"}
        />
        <Metric label="Remaining Rolls" value={remainingRolls} />
      </MetricStrip>

      <Panel title="Pending finished work" flush>
        {pendingWorks.length === 0 ? (
          <div className="p-2.5">
            <EmptyState
              icon={BadgeCheck}
              text="No finished work waiting for QC."
            />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Date of Issue</th>
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Quality Check"
        eyebrow="Produce"
        icon={BadgeCheck}
        actions={
          <button className={buttonClass} type="button" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" />
            New QC
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
        <Metric
          label="Pending QC"
                  <th>Knitter Challan No.</th>
                  <th>Mill</th>
                  <th>Item</th>
                  <th className="num">No. of Rolls</th>
                  <th className="num">Finished KG</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingWorks.map((work) => {
                  const calc = finishedWorkCalc(work);
                  const program = findProgramForFinishedWork(programs, work);
                  return (
                    <tr
                      key={work.id}
                      className="cursor-pointer hover:bg-(--panel-sunken)"
                      onClick={() => openCreate(work)}
                    >
                      <td className="font-semibold tabular-nums">{work.srNo}</td>
                      <td className="tabular-nums">
                        {formatDisplayDate(program?.dateOfIssue || work.date)}
                      </td>
                      <td>{work.knitterChallanNo || "—"}</td>
                      <td>{work.mill}</td>
                      <td>{work.item}</td>
                      <td className="num tabular-nums">{work.rolls}</td>
                      <td className="num tabular-nums">
                        {formatKg(calc.finishedKg)}
                      </td>
                      <td>
                        <span className={statusBadge("PENDING_QC")}>
                          PENDING
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={buttonTinyClass}
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreate(work);
                          }}
                        >
                          Inspect
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

      <Panel title="QC records" flush>
        {rows.length === 0 ? (
          <div className="p-2.5">
            <EmptyState text="No QC entries yet." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>QC Sr. No.</th>
                  <th>Knitter Challan No.</th>
                  <th>Mill</th>
                  <th>Item</th>
                  <th className="num">QC Rolls</th>
                  <th>Result</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const work = works.find((item) => item.id === row.finishedWorkId);
                  const program = programs.find((item) => item.id === row.programId);
                  return (
                    <tr key={row.id}>
                      <td className="font-semibold tabular-nums">{row.srNo}</td>
                      <td>{row.knitterChallanNo || "—"}</td>
                      <td>{work?.mill || program?.mill || "—"}</td>
                      <td>{work?.item || program?.item || "—"}</td>
                      <td className="num tabular-nums">{row.qcRolls}</td>
                      <td>
                        <span
                          className={
                            row.result === "pass"
                              ? "badge badge-ok"
                              : "badge badge-danger"
                          }
                        >
                          {row.result === "pass" ? "PASS" : "FAIL"}
                        </span>
                      </td>
                      <td>{row.grade || "—"}</td>
                      <td>
                        <span
                          className={statusBadge(
                            row.result === "pass" ? "PASSED" : "FAILED",
                          )}
                        >
                          {row.result === "pass" ? "PASSED" : "FAILED"}
                        </span>
                      </td>
                      <td className="space-x-1">
                        <button
                          type="button"
                          className={buttonTinyClass}
                          onClick={() => openRecord(row, "view")}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={buttonTinyClass}
                          onClick={() => openRecord(row, "edit")}
                        >
                          Edit
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

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          title={
            mode === "create"
              ? `New QC ${draft.srNo}`
              : `QC ${draft.srNo}`
          }
          onClose={unsaved.requestClose}
        >
          <div className="space-y-2 px-4 py-2.5">
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}

            <FieldGroup label="Lookup">
              <div className="flex items-end gap-2">
                <Field label="Search Knitter Challan No." className="flex-1">
                  <input
                    className={inputClass}
                    value={draft.search}
                    disabled={readOnly}
                    onChange={(e) => patch({ search: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchChallan();
                      }
                    }}
                  />
                </Field>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={readOnly}
                  onClick={() => searchChallan()}
                >
                  <Search className="h-3.5 w-3.5" />
                  Find
                </button>
              </div>
              {lookupError ? (
                <p className="text-[11px] text-(--danger)">{lookupError}</p>
              ) : null}
            </FieldGroup>

            {selectedProgram ? (
              <FieldGroup label="Mill Program">
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Program Sr. No.">
                    <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                      {selectedProgram.srNo}
                    </p>
                  </Field>
                  <Field label="Program Date">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {formatDisplayDate(selectedProgram.date)}
                    </p>
                  </Field>
                  <Field label="Mill Name">
                    <p className="py-1.5 text-[12.5px]">{selectedProgram.mill}</p>
                  </Field>
                  <Field label="Knitter Name">
                    <p className="py-1.5 text-[12.5px]">
                      {selectedProgram.knitter || "—"}
                    </p>
                  </Field>
                  <Field label="Knitter Challan No.">
                    <p className="py-1.5 text-[12.5px]">
                      {draft.knitterChallanNo || selectedProgram.challanNo || "—"}
                    </p>
                  </Field>
                  <Field label="Item Name">
                    <p className="py-1.5 text-[12.5px]">{selectedProgram.item}</p>
                  </Field>
                  <Field label="Type of Finish">
                    <p className="py-1.5 text-[12.5px]">
                      {selectedProgram.typeOfFinish || "—"}
                    </p>
                  </Field>
                  <Field label="GSM">
                    <p className="py-1.5 text-[12.5px]">{selectedProgram.gsm || "—"}</p>
                  </Field>
                  <Field label="Width">
                    <p className="py-1.5 text-[12.5px]">
                      {selectedProgram.width || "—"}
                    </p>
                  </Field>
                </div>

                <div className="mt-2">
                  <p className="mb-1 text-[12px] font-medium text-(--muted)">
                    Program allocation
                  </p>
                  <p className="mb-1 text-[12px] font-semibold tabular-nums">
                    Programmed Rolls: {selectedProgram.programmedRolls}
                  </p>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th className="w-12">No.</th>
                        <th className="num">Rolls</th>
                        <th>Code No.</th>
                        <th>Colour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProgram.lines.map((line, index) => (
                        <tr key={line.id}>
                          <td className="tabular-nums">{index + 1}</td>
                          <td className="num tabular-nums">{line.rolls}</td>
                          <td>{line.codeNo}</td>
                          <td>{line.colour}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FieldGroup>
            ) : null}

            {selectedWork && workCalc ? (
              <FieldGroup label="Finished Work">
                <div className="grid grid-cols-4 gap-2">
                  <Field label="Finished Work Sr. No.">
                    <p className="py-1.5 text-[12.5px] font-semibold tabular-nums">
                      {selectedWork.srNo}
                    </p>
                  </Field>
                  <Field label="Date of Issue">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {formatDisplayDate(
                        selectedProgram?.dateOfIssue || selectedWork.date,
                      )}
                    </p>
                  </Field>
                  <Field label="GP No.">
                    <p className="py-1.5 text-[12.5px]">{selectedWork.gpNo}</p>
                  </Field>
                  <Field label="Mill Name">
                    <p className="py-1.5 text-[12.5px]">{selectedWork.mill}</p>
                  </Field>
                  <Field label="Knitter Challan No.">
                    <p className="py-1.5 text-[12.5px]">
                      {selectedWork.knitterChallanNo || "—"}
                    </p>
                  </Field>
                  <Field label="Challan No.">
                    <p className="py-1.5 text-[12.5px]">
                      {selectedWork.challanNo || "—"}
                    </p>
                  </Field>
                  <Field label="Lot No.">
                    <p className="py-1.5 text-[12.5px]">{selectedWork.lotNo}</p>
                  </Field>
                  <Field label="Item Name">
                    <p className="py-1.5 text-[12.5px]">{selectedWork.item}</p>
                  </Field>
                  <Field label="No. of Rolls">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {selectedWork.rolls}
                    </p>
                  </Field>
                  <Field label="Grey KG">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {formatKg(workCalc.greyKg)}
                    </p>
                  </Field>
                  <Field label="Finished KG">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {formatKg(workCalc.finishedKg)}
                    </p>
                  </Field>
                  <Field label="Shortage KG">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {formatKg(Math.max(0, workCalc.shortageKg))}
                    </p>
                  </Field>
                  <Field label="Shortage %">
                    <p className="py-1.5 text-[12.5px] tabular-nums">
                      {formatPct(Math.max(0, workCalc.shortagePct))}%
                    </p>
                  </Field>
                </div>
              </FieldGroup>
            ) : null}

            {draft.finishedWorkId ? (
              <div>
                <p className="mb-1 text-[12px] font-medium text-(--muted)">
                  QC Received
                </p>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th className="w-12">No.</th>
                      <th>No. of Rolls</th>
                      <th>Code No.</th>
                      <th>Colour</th>
                      {!readOnly ? <th className="w-10" /> : null}
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
                            disabled={readOnly}
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
                            disabled={readOnly}
                            onChange={(e) =>
                              setLine(line.id, { codeNo: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className={inputClass}
                            value={line.colour}
                            disabled={readOnly}
                            onChange={(e) =>
                              setLine(line.id, { colour: e.target.value })
                            }
                          />
                        </td>
                        {!readOnly ? (
                          <td>
                            <button
                              type="button"
                              className={buttonTinyClass}
                              title="Remove row"
                              onClick={() =>
                                patch({
                                  lines:
                                    draft.lines.filter((row) => row.id !== line.id)
                                      .length > 0
                                      ? draft.lines.filter(
                                          (row) => row.id !== line.id,
                                        )
                                      : [emptyLine()],
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex items-center justify-between">
                  {!readOnly ? (
                    <button
                      type="button"
                      className={buttonGhostClass}
                      onClick={() =>
                        patch({ lines: [...draft.lines, emptyLine()] })
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Add row
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="space-x-3 text-[12px] font-semibold tabular-nums">
                    <span>Programmed Rolls: {programmedRolls}</span>
                    <span>QC'd Rolls: {qcRolls}</span>
                    <span>Remaining Rolls: {remainingForDraft}</span>
                  </div>
                </div>
                {overLimit ? (
                  <p className="mt-2 text-[11px] text-(--danger)">
                    QC'd rolls exceed remaining programmed rolls for this Mill
                    Program.
                  </p>
                ) : null}
              </div>
            ) : null}

            <FieldGroup label="QC Result">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={
                    draft.result === "pass" ? buttonClass : buttonGhostClass
                  }
                  disabled={readOnly}
                  onClick={() => setResult("pass")}
                >
                  PASS
                </button>
                <button
                  type="button"
                  className={
                    draft.result === "fail" ? buttonClass : buttonGhostClass
                  }
                  disabled={readOnly}
                  onClick={() => setResult("fail")}
                >
                  FAIL
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Grade">
                  <select
                    className={inputClass}
                    value={draft.grade}
                    disabled={readOnly || draft.result === "fail"}
                    onChange={(e) =>
                      patch({ grade: e.target.value as QualityCheckGrade })
                    }
                  >
                    {draft.result === "fail" ? (
                      <option value="REJECT">REJECT</option>
                    ) : (
                      <>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </>
                    )}
                  </select>
                </Field>
                <Field label="Defect Type">
                  <select
                    className={`${inputClass} ${
                      draft.result === "pass" ? "opacity-50" : ""
                    }`}
                    value={draft.defectType}
                    disabled={readOnly || draft.result === "pass"}
                    onChange={(e) =>
                      patch({
                        defectType: e.target.value as QualityCheckDefect,
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  className={buttonClass}
                  disabled={overLimit}
                  onClick={saveQc}
                >
                  Save QC
                </button>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
