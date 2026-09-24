import Link from "next/link";
import { prisma } from "@/lib/db";
import { submitQc } from "@/server/actions/qc";
import { programQtySummary } from "@/server/domain/mill-inward";
import { formatDateTime, formatQty, relativeDays } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { DefectChecklist } from "@/components/defect-checklist";
import {
  EmptyState,
  Field,
  FieldGroup,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import {
  AlertTriangle,
  ClipboardCheck,
  MessageCircle,
  RotateCcw,
} from "lucide-react";

export default async function QcPage() {
  const now = new Date();
  const [programs, openInwards, pendingLots, weaverHigh, openRfs, recentQc, grPending] =
    await Promise.all([
      prisma.millProgram.findMany({
        where: { status: { in: ["SENT_TO_MILL", "IN_PROCESS", "RETURNED"] } },
        select: {
          id: true,
          programNo: true,
          mill: { select: { name: true } },
          weaver: { select: { name: true } },
          fabricType: { select: { name: true } },
          finishType: { select: { name: true } },
          quality: { select: { name: true } },
          code: { select: { name: true } },
          colour: { select: { name: true } },
          greyOrder: { select: { quantity: true, unit: true } },
          inwards: { select: { quantity: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.millInward.findMany({
        where: { lot: { is: null }, qualityChecks: { none: {} } },
        select: {
          id: true,
          inwardNo: true,
          quantity: true,
          unit: true,
          program: {
            select: {
              programNo: true,
              mill: { select: { name: true } },
              fabricType: { select: { name: true } },
              quality: { select: { name: true } },
              code: { select: { name: true } },
              colour: { select: { name: true } },
            },
          },
        },
        orderBy: { inwardDate: "desc" },
      }),
      prisma.lot.findMany({
        where: {
          origin: "PROGRAM",
          movements: { none: {} },
          qualityChecks: { none: {} },
        },
        select: {
          id: true,
          lotNumber: true,
          quantity: true,
          lengthM: true,
          rollCount: true,
          createdAt: true,
          fabricType: { select: { name: true } },
          quality: { select: { name: true } },
          code: { select: { name: true } },
          colour: { select: { name: true } },
          mill: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.lot.findMany({
        where: {
          defectType: "WEAVER",
          OR: [{ returnPriority: "HIGH" }, { qualityGrade: "REJECT" }],
        },
        select: {
          id: true,
          lotNumber: true,
          returnPriority: true,
          fabricType: { select: { name: true } },
          quality: { select: { name: true } },
          code: { select: { name: true } },
          colour: { select: { name: true } },
          weaver: { select: { name: true } },
        },
        orderBy: [{ returnPriority: "desc" }, { updatedAt: "desc" }],
        take: 20,
      }),
      prisma.millReturn.findMany({
        where: { status: "OPEN" },
        select: {
          id: true,
          rfNo: true,
          lotId: true,
          dueAt: true,
          whatsappSent: true,
          lot: { select: { lotNumber: true, origin: true } },
          millInward: { select: { inwardNo: true } },
          mill: { select: { name: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 20,
      }),
      prisma.qualityCheck.findMany({
        select: {
          id: true,
          passed: true,
          defectType: true,
          checkedAt: true,
          lot: { select: { id: true, lotNumber: true } },
          millInward: { select: { inwardNo: true } },
        },
        orderBy: { checkedAt: "desc" },
        take: 12,
      }),
      prisma.salesReturn.count({ where: { status: "PENDING_QC" } }),
    ]);

  const rfOverdue = openRfs.filter((rf) => rf.dueAt < now).length;
  const inwardable = programs
    .map((p) => {
      const summary = programQtySummary(p);
      return {
        id: p.id,
        programNo: p.programNo,
        millName: p.mill.name,
        unit: summary.unit,
        remaining: summary.remaining,
      };
    })
    .filter((p) => p.remaining == null || p.remaining > 0);

  return (
    <div className="tx-page tx-page-qc">
      <div className="tx-stage space-y-3">
      <div className="tx-chrome">
      <PageHeader
        title="Quality check"
        eyebrow="Produce"
        icon={ClipboardCheck}
        description="Record each mill inward, inspect it, then PASS creates the lot and stock. FAIL opens mill RF with no lot."
        actions={
          <Link href="/returns" className={buttonTinyClass}>
            <RotateCcw className="h-3 w-3" />
            Goods-return QC
          </Link>
        }
      />
      </div>

      <MetricStrip className="tx-metrics divide-x-0 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Awaiting inward"
          value={inwardable.length}
          hint="Programs with remaining qty"
        />
        <Metric
          label="Pending QC"
          value={openInwards.length + pendingLots.length}
          tone={openInwards.length + pendingLots.length ? "warn" : "neutral"}
          hint="Inwards and leftover lots"
        />
        <Metric
          label="Weaver HIGH"
          value={weaverHigh.length}
          tone={weaverHigh.length ? "danger" : "neutral"}
        />
        <Metric
          label="Open mill RF"
          value={openRfs.length}
          tone={rfOverdue ? "danger" : "neutral"}
          hint={rfOverdue ? `${rfOverdue} past SLA` : "1-day SLA"}
        />
        <Metric
          label="GR QC pending"
          value={grPending}
          tone={grPending ? "info" : "neutral"}
          hint="On returns desk"
        />
      </MetricStrip>

      <Section
        title="Inspection desk"
        icon={ClipboardCheck}
        tone="accent"
        description="Inspect pending mill inwards. PASS creates the lot and stock."
      >
        <div className="grid gap-1.5">
          <Panel
            title="QC inspection"
            icon={ClipboardCheck}
            tone="accent"
            compact
          >
            {openInwards.length === 0 && pendingLots.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                text="No mill inwards waiting for QC. Record an inward first."
              />
            ) : (
              <form action={submitQc} className="space-y-2.5">
                <FieldGroup label="Subject">
                  {openInwards.length > 0 ? (
                    <Field label="Mill inward waiting for QC">
                      <select className={inputClass} name="millInwardId" required={pendingLots.length === 0}>
                        <option value="">Select…</option>
                        {openInwards.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.inwardNo} · {row.program.programNo} ·{" "}
                            {formatQty(row.quantity)} {row.unit} ·{" "}
                            {row.program.fabricType.name} ·{" "}
                            {row.program.quality &&
                            row.program.code &&
                            row.program.colour
                              ? `${row.program.quality.name} / ${row.program.code.name} / ${row.program.colour.name}`
                              : "Incomplete identity"}{" "}
                            · mill{" "}
                            {row.program.mill.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  {pendingLots.length > 0 ? (
                    <Field
                      label="Existing lot (created before this workflow)"
                      hint="Only leftover lots with no QC"
                    >
                      <select className={inputClass} name="lotId">
                        <option value="">Select…</option>
                        {pendingLots.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.lotNumber} · {l.fabricType.name} ·{" "}
                            {l.quality && l.code && l.colour
                              ? `${l.quality.name} / ${l.code.name} / ${l.colour.name}`
                              : "Incomplete identity"}{" "}
                            ·{" "}
                            {formatQty(l.lengthM ?? l.quantity)}
                            {l.mill ? ` · ${l.mill.name}` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <Field label="Result">
                    <select
                      className={inputClass}
                      name="passed"
                      required
                      defaultValue="true"
                    >
                      <option value="true">Pass → create lot + stock IN</option>
                      <option value="false">Fail → defect / mill RF</option>
                    </select>
                  </Field>
                </FieldGroup>

                <DefectChecklist columns={2} />

                <FieldGroup label="Judgement">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="Severity (non-weaver)">
                      <select
                        className={inputClass}
                        name="severity"
                        defaultValue="MEDIUM"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </Field>
                    <Field label="Grade (if pass)">
                      <select
                        className={inputClass}
                        name="grade"
                        defaultValue="A"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Remarks">
                    <textarea className={inputClass} name="remarks" rows={2} />
                  </Field>
                </FieldGroup>

                <p className="rounded-md border border-(--line) bg-(--panel-sunken) px-2 py-1.5 text-[10.5px] leading-snug text-(--muted)">
                  Fail opens a mill RF (MCRF) with a 1-day send-by SLA. A mill
                  defect WhatsApps the mill immediately with full fabric detail.
                  A weaver defect is flagged HIGH on the control tower.
                </p>

                <button className={buttonClass + " w-full"} type="submit">
                  Submit QC
                </button>
              </form>
            )}
          </Panel>
        </div>
      </Section>

      {weaverHigh.length > 0 || openRfs.length > 0 ? (
        <Section
          title="Escalations from QC"
          icon={AlertTriangle}
          tone="danger"
          description="Failures that must leave the building"
        >
          <div className="grid gap-1.5 xl:grid-cols-2">
            {weaverHigh.length > 0 ? (
              <Panel
                title="Weaver defect — priority"
                icon={AlertTriangle}
                tone="danger"
                subtitle={`${weaverHigh.length} lots`}
                flush
              >
                <TableWrap maxHeight={260}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Lot</th>
                        <th>Fabric / identity</th>
                        <th>Weaver</th>
                        <th>Pri</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {weaverHigh.map((lot) => (
                        <tr key={lot.id}>
                          <td className="font-semibold">{lot.lotNumber}</td>
                          <td className="text-(--muted)">
                            {lot.fabricType.name} /{" "}
                            {lot.quality && lot.code && lot.colour
                              ? `${lot.quality.name} / ${lot.code.name} / ${lot.colour.name}`
                              : "Incomplete identity"}
                          </td>
                          <td>{lot.weaver?.name ?? "—"}</td>
                          <td>
                            <span
                              className={statusBadge(
                                lot.returnPriority ?? "HIGH",
                              )}
                            >
                              {lot.returnPriority ?? "HIGH"}
                            </span>
                          </td>
                          <td>
                            <Link
                              href={`/stock/${lot.id}`}
                              className="font-medium text-(--accent) hover:underline"
                            >
                              Trail
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </Panel>
            ) : null}

            {openRfs.length > 0 ? (
              <Panel
                title="Mill RF — send within 1 day"
                icon={RotateCcw}
                tone="warn"
                subtitle={
                  rfOverdue ? `${rfOverdue} overdue` : `${openRfs.length} open`
                }
                flush
                action={
                  <Link href="/returns" className={buttonTinyClass}>
                    Returns desk
                  </Link>
                }
              >
                <TableWrap maxHeight={260}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>RF</th>
                        <th>Lot</th>
                        <th>Mill</th>
                        <th>Send by</th>
                        <th>WA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openRfs.map((rf) => {
                        const overdue = rf.dueAt < now;
                        return (
                          <tr key={rf.id}>
                            <td className="font-semibold">{rf.rfNo}</td>
                            <td>
                              {rf.lot && rf.lotId ? (
                                <Link
                                  href={`/stock/${rf.lotId}`}
                                  className="text-(--accent) hover:underline"
                                >
                                  {rf.lot.lotNumber}
                                </Link>
                              ) : (
                                <span>
                                  {rf.millInward?.inwardNo ?? "Inward"}
                                </span>
                              )}
                              <div className="text-[10px] text-(--faint)">
                                {rf.lot?.origin === "SALES_RETURN"
                                  ? "GR QC"
                                  : "Program"}
                              </div>
                            </td>
                            <td className="text-(--muted)">{rf.mill.name}</td>
                            <td className="text-[11px]">
                              {formatDateTime(rf.dueAt)}
                              <div
                                className={
                                  overdue
                                    ? "font-semibold text-(--danger)"
                                    : "text-(--muted)"
                                }
                              >
                                {relativeDays(rf.dueAt, now)}
                              </div>
                            </td>
                            <td>
                              <span
                                className={
                                  rf.whatsappSent
                                    ? "badge badge-wa"
                                    : "badge badge-warn"
                                }
                              >
                                <MessageCircle className="h-2.5 w-2.5" />
                                {rf.whatsappSent ? "Sent" : "Pending"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              </Panel>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section title="Recent inspections" icon={ClipboardCheck}>
        <Panel flush>
          {recentQc.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No QC recorded yet." />
            </div>
          ) : (
            <TableWrap maxHeight={280}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Lot</th>
                    <th>Result</th>
                    <th>Defect</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQc.map((q) => (
                    <tr key={q.id}>
                      <td>
                        {q.lot ? (
                        <Link
                          href={`/stock/${q.lot.id}`}
                          className="font-semibold text-(--accent) hover:underline"
                        >
                          {q.lot.lotNumber}
                        </Link>
                        ) : (
                          <span className="font-semibold">
                            {q.millInward?.inwardNo ?? "Inward QC"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            q.passed ? "badge badge-ok" : "badge badge-danger"
                          }
                        >
                          {q.passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                      <td className="text-(--muted)">{q.defectType}</td>
                      <td className="text-[11px] text-(--muted)">
                        {formatDateTime(q.checkedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <div className="tx-next">
        <NextStep
          steps={[
            {
              label: "See it in live stock",
              href: "/stock",
              hint: "Passed lots become sellable",
            },
            {
              label: "Send failed goods back",
              href: "/returns",
              hint: "Mill RF desk",
              count: openRfs.length || undefined,
            },
            {
              label: "Bill available stock",
              href: "/sales",
              hint: "Reserve or invoice",
            },
          ]}
        />
        </div>
      </Section>
      </div>
    </div>
  );
}
