import Link from "next/link";
import { prisma } from "@/lib/db";
import { createLotFromProgram, submitQc } from "@/server/actions/qc";
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
  Inbox,
  MessageCircle,
  RotateCcw,
} from "lucide-react";

export default async function QcPage() {
  const now = new Date();
  const [programs, pendingLots, weaverHigh, openRfs, recentQc, grPending] =
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
          shade: {
            select: { name: true, colorFamily: { select: { name: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
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
          shade: {
            select: { name: true, colorFamily: { select: { name: true } } },
          },
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
          shade: { select: { name: true } },
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
        },
        orderBy: { checkedAt: "desc" },
        take: 12,
      }),
      prisma.salesReturn.count({ where: { status: "PENDING_QC" } }),
    ]);

  const rfOverdue = openRfs.filter((rf) => rf.dueAt < now).length;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Quality check"
        eyebrow="Produce"
        icon={ClipboardCheck}
        description="Inward the mill return as a lot, inspect it, then let the result route itself — pass takes stock in, mill defect opens an RF, weaver defect escalates."
        actions={
          <Link href="/returns" className={buttonTinyClass}>
            <RotateCcw className="h-3 w-3" />
            Goods-return QC
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Awaiting inward"
          value={programs.length}
          hint="Programs at mill"
        />
        <Metric
          label="Pending QC"
          value={pendingLots.length}
          tone={pendingLots.length ? "warn" : "neutral"}
          hint="Lots not inspected"
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
        description="Two steps: bring goods in, then judge them"
      >
        <div className="grid gap-1.5 xl:grid-cols-2">
          <Panel
            title="Mill return → create lot"
            subtitle="Step 1"
            icon={Inbox}
            tone="info"
            compact
          >
            {programs.length === 0 ? (
              <EmptyState
                icon={Inbox}
                text="No programs awaiting mill return. Send a program to a mill first."
                action={
                  <Link href="/programs" className={buttonTinyClass}>
                    Go to programs
                  </Link>
                }
              />
            ) : (
              <form action={createLotFromProgram} className="space-y-2.5">
                <FieldGroup label="Source">
                  <Field label="Program">
                    <select className={inputClass} name="programId" required>
                      <option value="">Select…</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.programNo} · {p.fabricType.name} ·{" "}
                          {p.shade.colorFamily.name}/{p.shade.name}
                          {p.finishType ? ` · ${p.finishType.name}` : ""} · mill{" "}
                          {p.mill.name}
                          {p.weaver ? ` · weaver ${p.weaver.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                </FieldGroup>

                <FieldGroup label="Measurement">
                  <Field
                    label="Roll lengths (m)"
                    hint="Each value is one roll; total = sum. Leave blank to enter a single total."
                  >
                    <input
                      className={inputClass}
                      name="rollLengths"
                      placeholder="45, 48.5, 50  or  R1:45, R2:48"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Field label="Total (m)">
                      <input
                        className={inputClass}
                        name="quantity"
                        type="number"
                        step="any"
                        placeholder="if no rolls"
                      />
                    </Field>
                    <Field label="Rolls">
                      <input
                        className={inputClass}
                        name="rollCount"
                        type="number"
                        min={1}
                        defaultValue={1}
                      />
                    </Field>
                    <Field label="Weight (kg)">
                      <input
                        className={inputClass}
                        name="weightKg"
                        type="number"
                        step="any"
                      />
                    </Field>
                  </div>
                </FieldGroup>

                <FieldGroup label="Identity">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="Width">
                      <input
                        className={inputClass}
                        name="width"
                        type="number"
                        step="any"
                        placeholder="from program"
                      />
                    </Field>
                    <Field label="GSM">
                      <input
                        className={inputClass}
                        name="gsm"
                        type="number"
                        step="any"
                        placeholder="from program"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="Marka">
                      <input className={inputClass} name="marka" />
                    </Field>
                    <Field label="Primary roll no">
                      <input className={inputClass} name="rollNumber" />
                    </Field>
                  </div>
                </FieldGroup>

                <button className={buttonClass + " w-full"} type="submit">
                  Create lot for QC
                </button>
              </form>
            )}
          </Panel>

          <Panel
            title="Program QC"
            subtitle="Step 2"
            icon={ClipboardCheck}
            tone="accent"
            compact
          >
            {pendingLots.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                text="No program lots waiting for QC. Create a lot from a mill return first."
              />
            ) : (
              <form action={submitQc} className="space-y-2.5">
                <FieldGroup label="Subject">
                  <Field label="Lot">
                    <select className={inputClass} name="lotId" required>
                      <option value="">Select…</option>
                      {pendingLots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lotNumber} · {l.fabricType.name} ·{" "}
                          {l.shade.colorFamily.name}/{l.shade.name} ·{" "}
                          {formatQty(l.lengthM ?? l.quantity)}m · {l.rollCount}r
                          {l.mill ? ` · ${l.mill.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Result">
                    <select
                      className={inputClass}
                      name="passed"
                      required
                      defaultValue="true"
                    >
                      <option value="true">Pass → stock IN</option>
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
                        <th>Fabric / shade</th>
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
                            {lot.fabricType.name} / {lot.shade.name}
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
                              <Link
                                href={`/stock/${rf.lotId}`}
                                className="text-(--accent) hover:underline"
                              >
                                {rf.lot.lotNumber}
                              </Link>
                              <div className="text-[10px] text-(--faint)">
                                {rf.lot.origin === "SALES_RETURN"
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
                        <Link
                          href={`/stock/${q.lot.id}`}
                          className="font-semibold text-(--accent) hover:underline"
                        >
                          {q.lot.lotNumber}
                        </Link>
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
      </Section>
    </div>
  );
}
