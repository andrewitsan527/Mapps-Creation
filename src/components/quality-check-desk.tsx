"use client";

import { useMemo, useRef, useState } from "react";
import { BadgeCheck, Plus, Search } from "lucide-react";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { ErpModal as Overlay } from "@/components/erp-modal";
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
  saveQualityCheck,
  type QcPhysicalRoll,
  type QualityCheckDefect,
  type QualityCheckGrade,
  type QualityCheckProgram,
  type QualityCheckRecord,
  type QualityCheckWork,
  type RollDecision,
  type WithoutQcGroup,
} from "@/server/actions/quality-checks";

type RollRow = QcPhysicalRoll & { decision: RollDecision };

type Session = {
  workId: string;
  date: string;
  rolls: RollRow[];
  grade: QualityCheckGrade | "";
  defectType: QualityCheckDefect | "";
  remarks: string;
  weight: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso || "—";
  return `${d}/${m}/${y}`;
}

function sameWeight(stored: string, query: string) {
  const wanted = Number(query);
  const actual = Number(stored);
  if (!Number.isFinite(wanted) || !Number.isFinite(actual)) return false;
  return Math.round(wanted * 1000) === Math.round(actual * 1000);
}

export function QualityCheckDesk({
  works,
  programs,
  records,
  withoutQc,
}: {
  works: QualityCheckWork[];
  programs: QualityCheckProgram[];
  records: QualityCheckRecord[];
  withoutQc: WithoutQcGroup[];
}) {
  const [rows, setRows] = useState(records);
  const [session, setSession] = useState<Session | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const work = session ? works.find((row) => row.id === session.workId) ?? null : null;
  const program = work ? programs.find((row) => row.id === work.programId) ?? null : null;
  const visible = useMemo(() => {
    if (!session) return [];
    const query = session.weight.trim();
    if (!query) return session.rolls;
    return session.rolls.filter((roll) => sameWeight(roll.finishedKg, query));
  }, [session]);
  const passCount = session?.rolls.filter((roll) => roll.decision === "pass").length ?? 0;
  const failCount = session?.rolls.filter((roll) => roll.decision === "fail").length ?? 0;
  const withoutCount = session?.rolls.filter((roll) => roll.stockState === "without_qc").length ?? 0;

  function openWork(target: QualityCheckWork, onlyIds?: string[]) {
    const allowed = onlyIds ? new Set(onlyIds) : null;
    const source = target.physicalRolls.filter((roll) => !allowed || allowed.has(roll.id));
    const decisions = new Map(
      (target.draft?.decisions ?? []).map((row) => [row.finishedWorkEntryRollId, row.decision]),
    );
    const storedGrade = target.draft?.grade;
    const grade: QualityCheckGrade =
      storedGrade === "A" || storedGrade === "B" || storedGrade === "C" ? storedGrade : "A";
    setSession({
      workId: target.id,
      date: target.draft?.date || todayIso(),
      grade,
      defectType: (target.draft?.defectType as QualityCheckDefect) || "",
      remarks: target.draft?.remarks ?? "",
      weight: "",
      rolls: source.map((roll) => ({
        ...roll,
        decision: decisions.get(roll.id) === "fail" ? "fail" : "pass",
      })),
    });
    setError(null);
    setLookupError(programFor(target) ? null : "Finished work found, but no matching Mill Program.");
  }

  function programFor(target: QualityCheckWork) {
    return programs.find((row) => row.id === target.programId) ?? null;
  }

  function searchChallan() {
    const query = search.trim().toLowerCase();
    if (!query) {
      setLookupError("Enter Knitter Challan No.");
      return;
    }
    const found = works.find((row) => row.knitterChallanNo.trim().toLowerCase() === query);
    if (!found) {
      setLookupError("No Finished Work found for this Knitter Challan No.");
      return;
    }
    openWork(found);
  }

  function patchRoll(id: string, decision: RollDecision) {
    setSession((prev) =>
      prev
        ? { ...prev, rolls: prev.rolls.map((roll) => (roll.id === id ? { ...roll, decision } : roll)) }
        : prev,
    );
  }

  async function persist(mode: "draft" | "submit" | "without_qc") {
    if (!session || savingRef.current) return false;
    if (!work?.programId) {
      setError("No matching Mill Program for this challan.");
      return false;
    }
    savingRef.current = true;
    setError(null);
    try {
      const result = await saveQualityCheck({
        qcDate: session.date,
        finishedWorkId: session.workId,
        grade: session.grade,
        defectType: session.defectType,
        remarks: session.remarks,
        mode,
        rolls: session.rolls.map((roll) => ({
          finishedWorkEntryRollId: roll.id,
          decision: roll.decision,
        })),
      });
      setRows((prev) => [result.record, ...prev.filter((row) => row.id !== result.record.id)]);
      setSession(null);
      setNotice(
        mode === "draft"
          ? `${result.record.srNo} draft saved.`
          : result.fail?.created
            ? `${result.record.srNo} submitted. QC return ${result.fail.srNo} created.`
            : `${result.record.srNo} submitted.`,
      );
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the QC.");
      return false;
    } finally {
      savingRef.current = false;
    }
  }

  const unsaved = useUnsavedClose({
    active: session != null,
    current: session,
    onDiscard: () => setSession(null),
    onSaveDraft: () => {
      void persist("draft");
    },
  });

  return (
    <div className="space-y-3">
      <PageHeader title="Quality Check" eyebrow="Produce" icon={BadgeCheck} description="Check each finished roll. Passed rolls go to live stock." />
      {notice ? <p className="text-[12px] text-(--accent-strong)">{notice}</p> : null}

      <Panel title="Search knitter challan">
        <div className="flex items-end gap-2">
          <Field label="Knitter Challan No." className="flex-1">
            <input
              className={inputClass}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") searchChallan();
              }}
            />
          </Field>
          <button type="button" className={buttonClass} onClick={searchChallan}>
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        </div>
        {lookupError ? <p className="mt-2 text-[12px] text-(--danger)">{lookupError}</p> : null}
      </Panel>

      <Panel title="Pending finished work" flush>
        {works.length === 0 ? (
          <div className="p-2.5"><EmptyState icon={BadgeCheck} text="No finished work waiting for QC." /></div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Knitter Challan No.</th>
                  <th>Mill</th>
                  <th>Item</th>
                  <th className="num">Rolls left</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {works.map((row) => (
                  <tr key={row.id}>
                    <td>{row.knitterChallanNo || "—"}</td>
                    <td>{row.mill}</td>
                    <td>{row.item}</td>
                    <td className="num tabular-nums">{row.physicalRolls.length}</td>
                    <td>
                      <button type="button" className={buttonTinyClass} onClick={() => openWork(row)}>
                        {row.draft ? "Continue" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Without QC stock" flush>
        {withoutQc.length === 0 ? (
          <div className="p-2.5"><EmptyState text="No rolls are waiting without QC." /></div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Challan</th>
                  <th>Item</th>
                  <th>Colour</th>
                  <th className="num">Available Rolls</th>
                  <th className="num">Total KG</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {withoutQc.map((row) => (
                  <tr key={`${row.finishedWorkId}-${row.itemName}-${row.colour}`}>
                    <td>{row.knitterChallanNo || "—"}</td>
                    <td>{row.itemName || "—"}</td>
                    <td>{row.colour || "—"}</td>
                    <td className="num tabular-nums">{row.rolls}</td>
                    <td className="num tabular-nums">{Number(row.totalKg).toFixed(3)}</td>
                    <td>
                      <button
                        type="button"
                        className={buttonTinyClass}
                        onClick={() => {
                          const target = works.find((workRow) => workRow.id === row.finishedWorkId);
                          if (target) openWork(target, row.rollIds);
                        }}
                      >
                        Start QC
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="QC records" flush>
        {rows.length === 0 ? (
          <div className="p-2.5"><EmptyState text="No QC entries yet." /></div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>QC Sr. No.</th>
                  <th>Knitter Challan No.</th>
                  <th className="num">Rolls</th>
                  <th>Result</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold tabular-nums">{row.srNo}</td>
                    <td>{row.knitterChallanNo || "—"}</td>
                    <td className="num tabular-nums">{row.qcRolls}</td>
                    <td>{row.result === "draft" ? "Draft" : row.result.replace("_", " ").toUpperCase()}</td>
                    <td><span className={statusBadge(row.status === "draft" ? "PENDING_QC" : "CLOSED")}>{row.status === "draft" ? "DRAFT" : "SUBMITTED"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {session && work ? (
        <Overlay title={`QC ${work.knitterChallanNo || work.srNo}`} onClose={unsaved.requestClose}>
          <div className="space-y-3 px-4 py-2.5">
            {error ? <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">{error}</p> : null}
            <FieldGroup label="Finished work">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Knitter Challan No."><p className="py-1.5 text-[12.5px]">{work.knitterChallanNo || "—"}</p></Field>
                <Field label="Mill"><p className="py-1.5 text-[12.5px]">{program?.mill || work.mill || "—"}</p></Field>
                <Field label="Knitter"><p className="py-1.5 text-[12.5px]">{program?.knitter || "—"}</p></Field>
                <Field label="Program"><p className="py-1.5 text-[12.5px]">{program?.srNo || "—"}</p></Field>
                <Field label="Item"><p className="py-1.5 text-[12.5px]">{program?.item || work.item || "—"}</p></Field>
                <Field label="Programmed rolls"><p className="py-1.5 text-[12.5px] tabular-nums">{program?.programmedRolls ?? "—"}</p></Field>
                <Field label="Received rolls"><p className="py-1.5 text-[12.5px] tabular-nums">{work.rolls}</p></Field>
                <Field label="Date of issue"><p className="py-1.5 text-[12.5px]">{formatDisplayDate(program?.dateOfIssue || work.date)}</p></Field>
              </div>
            </FieldGroup>

            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={buttonGhostClass} onClick={() => setSession({ ...session, rolls: session.rolls.map((roll) => ({ ...roll, decision: "pass" })) })}>
                PASS ALL
              </button>
              <button type="button" className={buttonGhostClass} onClick={() => void persist("without_qc")}>
                WITHOUT QC
              </button>
            </div>

            <Field label="Search weight">
              <input
                className={inputClass}
                value={session.weight}
                inputMode="decimal"
                placeholder="24.650"
                onChange={(event) => setSession({ ...session, weight: event.target.value })}
              />
            </Field>

            <TableWrap>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Item</th>
                    <th>Code</th>
                    <th>Colour</th>
                    <th className="num">Finished KG</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((roll) => (
                    <tr key={roll.id}>
                      <td className="tabular-nums">{roll.rollNo}</td>
                      <td>{roll.itemName || "—"}</td>
                      <td>{roll.codeNo || "—"}</td>
                      <td>{roll.colour || "—"}</td>
                      <td className="num tabular-nums">{Number(roll.finishedKg).toFixed(3)}</td>
                      <td>
                        <button
                          type="button"
                          className={roll.decision === "pass" ? buttonClass : buttonGhostClass}
                          onClick={() => patchRoll(roll.id, roll.decision === "pass" ? "fail" : "pass")}
                        >
                          {roll.decision === "pass" ? "PASS" : "FAIL"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {session.weight.trim() && visible.length === 0 ? (
              <p className="text-[12px] text-(--muted)">No roll matches that weight.</p>
            ) : null}

            <MetricStrip className="grid-cols-3">
              <Metric label="PASS" value={passCount} tone="accent" />
              <Metric label="FAIL" value={failCount} tone={failCount ? "warn" : "neutral"} />
              <Metric label="WITHOUT QC" value={withoutCount} />
            </MetricStrip>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Grade">
                <select className={inputClass} value={session.grade} onChange={(event) => setSession({ ...session, grade: event.target.value as QualityCheckGrade })}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </Field>
              <Field label="Defect type">
                <select className={inputClass} value={session.defectType} onChange={(event) => setSession({ ...session, defectType: event.target.value as QualityCheckDefect })}>
                  <option value="">Select…</option>
                  <option value="MILL">Mill</option>
                  <option value="WEAVER">Weaver</option>
                  <option value="DYEING">Dyeing</option>
                  <option value="MINOR">Minor</option>
                </select>
              </Field>
            </div>
            <Field label="Remarks">
              <input className={inputClass} value={session.remarks} onChange={(event) => setSession({ ...session, remarks: event.target.value })} />
            </Field>

            <div className="flex justify-end gap-1.5">
              <button type="button" className={buttonGhostClass} onClick={() => void persist("draft")}>Save draft</button>
              <button type="button" className={buttonClass} onClick={() => void persist("submit")}>
                <Plus className="h-3.5 w-3.5" />
                Submit QC
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
