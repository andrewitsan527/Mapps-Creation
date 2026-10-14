"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Plus, Search, X } from "lucide-react";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { statusBadge } from "@/lib/format";
import {
  EmptyState,
  Field,
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

function keepFieldVisible(event: { currentTarget: HTMLElement }) {
  event.currentTarget.scrollIntoView({ block: "nearest" });
}

function kgText(value: string) {
  const weight = Number(value);
  return Number.isFinite(weight) ? weight.toFixed(3) : value;
}

function passClass(selected: boolean) {
  return selected ? `${buttonClass} w-full md:w-auto` : `${buttonGhostClass} w-full md:w-auto`;
}

function failClass(selected: boolean) {
  return selected
    ? `${buttonGhostClass} w-full border-(--danger) bg-(--danger-soft) text-(--danger) md:w-auto`
    : `${buttonGhostClass} w-full md:w-auto`;
}

function mobileDecisionClass(kind: "pass" | "fail", selected: boolean) {
  const base =
    "pressable inline-flex h-11 min-h-11 w-full items-center justify-center rounded-md border px-1 text-[12px] font-semibold";
  if (selected && kind === "pass") return `${base} border-transparent bg-(--accent) text-white`;
  if (selected && kind === "fail") return `${base} border-transparent bg-(--danger) text-white`;
  return `${base} border-(--line) bg-white text-(--ink)`;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="block text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
        {label}
      </span>
      <span className="block truncate text-[13px] text-(--ink)">{value}</span>
    </p>
  );
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
  const [tab, setTab] = useState<"pending" | "records" | "without">("pending");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  /* close the challan search on an outside click */
  useEffect(() => {
    if (!searchOpen) return;
    function onDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);
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
    <div className="qc-page">
      <div className="qc-stage">
      {notice ? (
        <div className="gb-toast-wrap" role="status" aria-live="polite">
          <div className="gb-toast" data-tone="ok">
            <span className="gb-toast-text">{notice}</span>
            <button type="button" className="gb-toast-close" onClick={() => setNotice(null)} aria-label="Dismiss notification">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Three lists, one at a time, with the challan search folded in. This
          screen is worked on standing up, so the blocks and the row actions
          are deliberately larger than on the office desks. */}
      <div className="qc-switch">
        <button
          type="button"
          className="qc-tab"
          data-kind="pending"
          aria-pressed={tab === "pending"}
          onClick={() => setTab("pending")}
        >
          <span className="qc-tab-label">Pending QC</span>
          <span className="qc-tab-count tabular-nums">{works.length}</span>
        </button>
        <button
          type="button"
          className="qc-tab"
          data-kind="records"
          aria-pressed={tab === "records"}
          onClick={() => setTab("records")}
        >
          <span className="qc-tab-label">QC Records</span>
          <span className="qc-tab-count tabular-nums">{rows.length}</span>
        </button>
        <button
          type="button"
          className="qc-tab"
          data-kind="without"
          aria-pressed={tab === "without"}
          onClick={() => setTab("without")}
        >
          <span className="qc-tab-label">Without QC</span>
          <span className="qc-tab-count tabular-nums">{withoutQc.length}</span>
        </button>

        <div className="qc-pop-wrap" ref={searchRef}>
          <button
            type="button"
            className={`qc-icon-btn${searchOpen || search ? " is-on" : ""}`}
            aria-label="Search knitter challan"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Search className="h-5 w-5" />
          </button>
          {searchOpen ? (
            <div className="qc-pop">
              <input
                autoFocus
                aria-label="Knitter Challan No."
                placeholder="Knitter Challan No."
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchChallan();
                  if (event.key === "Escape") setSearchOpen(false);
                }}
              />
              <button
                type="button"
                className={buttonClass}
                onClick={searchChallan}
              >
                Search
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {lookupError ? (
        <p className="qc-lookup-error" role="alert">
          {lookupError}
        </p>
      ) : null}

      {tab === "pending" ? (
      <Panel flush className="qc-panel qc-pending">
        {works.length === 0 ? (
          <div className="qc-empty"><EmptyState icon={BadgeCheck} text="No finished work waiting for QC." /></div>
        ) : (
          <>
            <div className="divide-y divide-(--line) md:hidden">
              {works.map((row) => (
                <div key={row.id} className="flex items-center gap-2 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{row.knitterChallanNo || "—"}</p>
                    <p className="truncate text-[12px] text-(--muted)">
                      {row.mill || "—"} · {row.item || "—"}
                    </p>
                    <p className="text-[12px] tabular-nums text-(--ink-soft)">{row.physicalRolls.length} rolls left</p>
                  </div>
                  <button type="button" className={`${buttonClass} shrink-0`} onClick={() => openWork(row)}>
                    {row.draft ? "Continue" : "Inspect"}
                  </button>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register qc-reg w-full min-w-[44rem] table-fixed">
              <colgroup>
                <col className="w-[10rem]" />
                <col />
                <col />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
              </colgroup>
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
                <tr className="qc-filler" aria-hidden>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </TableWrap>
            </div>
          </>
        )}
      </Panel>
      ) : tab === "records" ? (
      <Panel flush className="qc-panel qc-records">
        {rows.length === 0 ? (
          <div className="qc-empty"><EmptyState text="No QC entries yet." /></div>
        ) : (
          <>
            <div className="divide-y divide-(--line) md:hidden">
              {rows.map((row) => (
                <div key={row.id} className="px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold tabular-nums">{row.srNo}</p>
                    <span className={statusBadge(row.status === "draft" ? "PENDING_QC" : "CLOSED")}>
                      {row.status === "draft" ? "DRAFT" : "SUBMITTED"}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-(--muted)">{row.knitterChallanNo || "—"}</p>
                  <p className="text-[12px] tabular-nums">
                    {row.qcRolls} rolls · {row.result === "draft" ? "Draft" : row.result.replace("_", " ").toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register qc-reg w-full min-w-[44rem] table-fixed">
              <colgroup>
                <col className="w-[8rem]" />
                <col className="w-[10rem]" />
                <col className="w-[5rem]" />
                <col />
                <col className="w-[7rem]" />
              </colgroup>
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
                <tr className="qc-filler" aria-hidden>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </TableWrap>
            </div>
          </>
        )}
      </Panel>
      ) : (
      <Panel flush className="qc-panel qc-without">
        {withoutQc.length === 0 ? (
          <div className="qc-empty"><EmptyState text="No rolls are waiting without QC." /></div>
        ) : (
          <>
            <div className="divide-y divide-(--line) md:hidden">
              {withoutQc.map((row) => (
                <div key={`${row.finishedWorkId}-${row.itemName}-${row.colour}`} className="flex items-center gap-2 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{row.colour || "—"}</p>
                    <p className="truncate text-[12px] text-(--muted)">
                      {row.knitterChallanNo || "—"} · {row.itemName || "—"}
                    </p>
                    <p className="text-[12px] tabular-nums text-(--ink-soft)">
                      {row.rolls} rolls · {Number(row.totalKg).toFixed(3)} kg
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${buttonClass} shrink-0`}
                    onClick={() => {
                      const target = works.find((workRow) => workRow.id === row.finishedWorkId);
                      if (target) openWork(target, row.rollIds);
                    }}
                  >
                    Start QC
                  </button>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register qc-reg w-full min-w-[50rem] table-fixed">
              <colgroup>
                <col className="w-[9rem]" />
                <col />
                <col className="w-[8rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[6rem]" />
              </colgroup>
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
                <tr className="qc-filler" aria-hidden>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </TableWrap>
            </div>
          </>
        )}
      </Panel>
      )}

      {unsaved.dialog}
      {session && work ? (
        <Overlay
          title={`QC ${work.knitterChallanNo || work.srNo}`}
          onClose={unsaved.requestClose}
          flushBody
          trapFocus
          portal
          lockScroll
          trackViewport
          closeClassName={`${buttonGhostClass} relative !h-8 !w-8 !min-h-8 !min-w-8 shrink-0 !rounded-md !border-transparent !bg-transparent !p-0 !shadow-none before:absolute before:-inset-1.5 before:content-[''] hover:!border-transparent hover:!bg-transparent md:!h-auto md:!w-auto md:!min-h-0 md:!min-w-11 md:!border-(--line) md:!bg-white md:!px-2 md:!py-1.5 md:!shadow-none md:before:hidden`}
          headerClassName="justify-between gap-2 px-2 py-0.5 md:px-5 md:py-2.5"
          overlayClassName="px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-[max(1.5rem,4vw)] md:py-8"
          frameWidthClass="qc-sheet h-auto max-h-full w-full min-h-0 self-stretch md:h-[min(720px,100%)] md:max-h-[min(720px,100%)] md:w-full md:max-w-[960px] md:self-center"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {error ? (
              <p className="mx-3 mt-2 shrink-0 rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[12px] text-(--danger) md:mx-4" role="alert">
                {error}
              </p>
            ) : null}
            <div className="table-scroll min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto px-3 py-2 md:space-y-3 md:px-4 md:py-2.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 md:hidden">
                <SummaryItem label="Challan" value={work.knitterChallanNo || "—"} />
                <SummaryItem label="Mill" value={program?.mill || work.mill || "—"} />
                <SummaryItem label="Program" value={program?.srNo || "—"} />
                <SummaryItem label="Received" value={String(work.rolls)} />
              </div>
              <p className="truncate text-[11px] leading-tight text-(--muted) md:hidden">
                {program?.knitter || "—"} · {program?.item || work.item || "—"} · Programmed {program ? program.programmedRolls : "—"} · Issued {formatDisplayDate(program?.dateOfIssue || work.date)}
              </p>
              <div className="hidden md:grid md:grid-cols-4 md:gap-x-3 md:gap-y-2">
                <SummaryItem label="Challan" value={work.knitterChallanNo || "—"} />
                <SummaryItem label="Mill" value={program?.mill || work.mill || "—"} />
                <SummaryItem label="Program" value={program?.srNo || "—"} />
                <SummaryItem label="Received" value={String(work.rolls)} />
                <SummaryItem label="Knitter" value={program?.knitter || "—"} />
                <SummaryItem label="Item" value={program?.item || work.item || "—"} />
                <SummaryItem label="Programmed" value={program ? String(program.programmedRolls) : "—"} />
                <SummaryItem label="Issued" value={formatDisplayDate(program?.dateOfIssue || work.date)} />
              </div>

              <div className="grid grid-cols-2 gap-1.5 md:flex md:gap-2">
                <button
                  type="button"
                  className={`${buttonGhostClass} w-full md:w-auto`}
                  onClick={() =>
                    setSession({
                      ...session,
                      rolls: session.rolls.map((roll) => ({ ...roll, decision: "pass" })),
                    })
                  }
                >
                  PASS ALL
                </button>
                <button
                  type="button"
                  className={`${buttonGhostClass} w-full border-(--warn) bg-(--warn-soft) text-(--warn) md:w-auto`}
                  title="Submits every roll in this session without QC"
                  onClick={() => void persist("without_qc")}
                >
                  WITHOUT QC
                </button>
              </div>

              <Field label="Search weight">
                <input
                  className={`${inputClass} max-md:!min-h-9 max-md:!py-1 max-md:!text-[13px]`}
                  value={session.weight}
                  inputMode="decimal"
                  placeholder="24.650"
                  onChange={(event) => setSession({ ...session, weight: event.target.value })}
                />
              </Field>

              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-(--line)">
                <p className="px-2 py-1.5">
                  <span className="block text-[10px] font-semibold tracking-wide text-(--muted) uppercase">Pass</span>
                  <span className="text-[15px] font-semibold tabular-nums text-(--accent-strong)">{passCount}</span>
                </p>
                <p className="border-l border-(--line) px-2 py-1.5">
                  <span className="block text-[10px] font-semibold tracking-wide text-(--muted) uppercase">Fail</span>
                  <span className={`text-[15px] font-semibold tabular-nums ${failCount ? "text-(--warn)" : "text-(--ink)"}`}>{failCount}</span>
                </p>
                <p className="border-l border-(--line) px-2 py-1.5">
                  <span className="block text-[10px] font-semibold tracking-wide text-(--muted) uppercase">Without QC</span>
                  <span className="text-[15px] font-semibold tabular-nums">{withoutCount}</span>
                </p>
              </div>

              <div className="divide-y divide-(--line) overflow-hidden rounded-md border border-(--line) md:hidden">
                {visible.map((roll) => (
                  <article key={roll.id} className="bg-white px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-tight">
                          <span className="font-semibold">Roll {roll.rollNo}</span>
                          <span className="ml-1.5 font-medium tabular-nums">{kgText(roll.finishedKg)} kg</span>
                        </p>
                        <p className="truncate text-[12px] leading-tight text-(--muted)">
                          <span className="text-(--ink)">{roll.itemName || "—"}</span>
                          <span className="px-1 text-(--faint)">·</span>
                          <span className="font-semibold text-(--ink)">{roll.colour || "—"}</span>
                          <span className="px-1 text-(--faint)">·</span>
                          Code {roll.codeNo || "—"}
                          {roll.stockState === "without_qc" ? " · Without QC" : ""}
                        </p>
                      </div>
                      <div className="grid w-[8.75rem] shrink-0 grid-cols-2 gap-1">
                        <button
                          type="button"
                          className={mobileDecisionClass("pass", roll.decision === "pass")}
                          aria-pressed={roll.decision === "pass"}
                          aria-label={`Roll ${roll.rollNo} pass`}
                          onClick={() => patchRoll(roll.id, "pass")}
                        >
                          PASS
                        </button>
                        <button
                          type="button"
                          className={mobileDecisionClass("fail", roll.decision === "fail")}
                          aria-pressed={roll.decision === "fail"}
                          aria-label={`Roll ${roll.rollNo} fail`}
                          onClick={() => patchRoll(roll.id, "fail")}
                        >
                          FAIL
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden md:block">
                <table className="erp-table table-fixed">
                  <colgroup>
                    <col className="w-14" />
                    <col />
                    <col className="w-24" />
                    <col className="w-36" />
                    <col className="w-28" />
                    <col className="w-44" />
                  </colgroup>
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
                        <td className="truncate">{roll.itemName || "—"}</td>
                        <td className="truncate">{roll.codeNo || "—"}</td>
                        <td className="truncate">{roll.colour || "—"}</td>
                        <td className="num tabular-nums">{kgText(roll.finishedKg)}</td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className={passClass(roll.decision === "pass")}
                              aria-pressed={roll.decision === "pass"}
                              aria-label={`Roll ${roll.rollNo} pass`}
                              onClick={() => patchRoll(roll.id, "pass")}
                            >
                              PASS
                            </button>
                            <button
                              type="button"
                              className={failClass(roll.decision === "fail")}
                              aria-pressed={roll.decision === "fail"}
                              aria-label={`Roll ${roll.rollNo} fail`}
                              onClick={() => patchRoll(roll.id, "fail")}
                            >
                              FAIL
                            </button>
                          </div>
                          {roll.stockState === "without_qc" ? (
                            <p className="mt-0.5 text-[10px] text-(--warn)">Already without QC</p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {session.weight.trim() && visible.length === 0 ? (
                <p className="text-[12px] text-(--muted)">No roll matches that weight.</p>
              ) : null}
            </div>

            <div className="shrink-0 space-y-1.5 border-t border-(--line) px-3 py-1.5 md:space-y-2 md:px-4 md:py-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Grade">
                  <select className={`${inputClass} max-md:!min-h-9 max-md:!py-1 max-md:!text-[13px]`} value={session.grade} onFocus={keepFieldVisible} onChange={(event) => setSession({ ...session, grade: event.target.value as QualityCheckGrade })}>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </Field>
                <Field label="Defect type">
                  <select className={`${inputClass} max-md:!min-h-9 max-md:!py-1 max-md:!text-[13px]`} value={session.defectType} onFocus={keepFieldVisible} onChange={(event) => setSession({ ...session, defectType: event.target.value as QualityCheckDefect })}>
                    <option value="">Select…</option>
                    <option value="MILL">Mill</option>
                    <option value="WEAVER">Weaver</option>
                    <option value="DYEING">Dyeing</option>
                    <option value="MINOR">Minor</option>
                  </select>
                </Field>
              </div>
              <Field label="Remarks">
                <input className={`${inputClass} max-md:!min-h-9 max-md:!py-1 max-md:!text-[13px]`} value={session.remarks} onFocus={keepFieldVisible} onChange={(event) => setSession({ ...session, remarks: event.target.value })} />
              </Field>
              <div className="flex gap-2 md:justify-end">
                <button type="button" className={`${buttonGhostClass} min-w-0 flex-1 md:flex-none md:w-auto`} onClick={() => void persist("draft")}>
                  Save draft
                </button>
                <button type="button" className={`${buttonClass} min-w-0 flex-1 md:flex-none md:w-auto`} onClick={() => void persist("submit")}>
                  <Plus className="h-3.5 w-3.5" />
                  Submit QC
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      ) : null}
      </div>
    </div>
  );
}
