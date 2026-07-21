import Link from "next/link";
import { prisma } from "@/lib/db";
import { createLotFromProgram, submitQc } from "@/server/actions/qc";
import { formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  StatCard,
  buttonClass,
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import { ClipboardCheck, MessageCircle } from "lucide-react";

export default async function QcPage() {
  const now = new Date();
  const [programs, pendingLots, weaverHigh, openRfs, recentQc] =
    await Promise.all([
      prisma.millProgram.findMany({
        where: { status: { in: ["SENT_TO_MILL", "IN_PROCESS", "RETURNED"] } },
        include: {
          mill: true,
          weaver: true,
          fabricType: true,
          finishType: true,
          shade: { include: { colorFamily: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.lot.findMany({
        where: {
          origin: "PROGRAM",
          movements: { none: {} },
          qualityChecks: { none: {} },
        },
        include: {
          fabricType: true,
          shade: { include: { colorFamily: true } },
          mill: true,
          weaver: true,
          finishType: true,
          rolls: { orderBy: { sortOrder: "asc" } },
          program: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.lot.findMany({
        where: {
          defectType: "WEAVER",
          OR: [{ returnPriority: "HIGH" }, { qualityGrade: "REJECT" }],
        },
        include: {
          fabricType: true,
          shade: true,
          weaver: { select: { name: true } },
          mill: { select: { name: true } },
        },
        orderBy: [{ returnPriority: "desc" }, { updatedAt: "desc" }],
        take: 20,
      }),
      prisma.millReturn.findMany({
        where: { status: "OPEN" },
        include: {
          lot: { select: { lotNumber: true, origin: true } },
          mill: { select: { name: true, whatsapp: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 20,
      }),
      prisma.qualityCheck.findMany({
        include: { lot: true },
        orderBy: { checkedAt: "desc" },
        take: 15,
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Quality check"
        icon={ClipboardCheck}
        description="Program inward QC. Goods return QC is on Returns. Weaver HIGH on top; mill RF within 1 day."
      />

      <div className="mb-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <StatCard label="Awaiting inward" value={programs.length} />
        <StatCard label="Pending QC" value={pendingLots.length} />
        <StatCard
          label="Weaver HIGH"
          value={weaverHigh.length}
          hint="Dashboard priority"
        />
        <StatCard
          label="Open mill RF"
          value={openRfs.length}
          hint="Send within 1 day"
        />
      </div>

      {weaverHigh.length > 0 ? (
        <Panel title="Weaver defect — priority" className="mb-1.5" compact>
          <div className="overflow-x-auto">
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
                    <td>
                      {lot.fabricType.name} / {lot.shade.name}
                    </td>
                    <td>{lot.weaver?.name ?? "—"}</td>
                    <td>
                      <span className={statusBadge(lot.returnPriority ?? "HIGH")}>
                        {lot.returnPriority ?? "HIGH"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/stock/${lot.id}`}
                        className="text-(--accent) hover:underline"
                      >
                        Trail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {openRfs.length > 0 ? (
        <Panel title="Mill RF — send within 1 day" className="mb-1.5" compact>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>RF</th>
                  <th>Lot</th>
                  <th>Mill</th>
                  <th>Kind</th>
                  <th>Due</th>
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
                          className="hover:underline"
                        >
                          {rf.lot.lotNumber}
                        </Link>
                      </td>
                      <td>{rf.mill.name}</td>
                      <td>
                        {rf.lot.origin === "SALES_RETURN" ? "GR QC" : "Program"}
                      </td>
                      <td>
                        <span
                          className={
                            overdue
                              ? "font-semibold text-red-700"
                              : "tabular-nums"
                          }
                        >
                          {rf.dueAt.toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {overdue ? " · overdue" : ""}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            rf.whatsappSent ? "badge badge-wa" : "badge badge-warn"
                          }
                        >
                          <MessageCircle className="h-3 w-3" />
                          {rf.whatsappSent ? "Sent" : "Pending"}
                        </span>
                        {!rf.whatsappSent ? (
                          <Link
                            href="/returns"
                            className={`${buttonWaClass} ml-1 px-1.5 py-0.5 text-[10px]`}
                          >
                            Send
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-1.5 xl:grid-cols-2">
        <Panel title="1. Mill return → create lot (program)" compact>
          {programs.length === 0 ? (
            <EmptyState text="No programs awaiting mill return. Send a program first." />
          ) : (
            <form action={createLotFromProgram} className="space-y-1.5">
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
              <Field label="Roll lengths (m)">
                <input
                  className={inputClass}
                  name="rollLengths"
                  placeholder="45, 48.5, 50  or  R1:45, R2:48"
                />
              </Field>
              <p className="text-[10px] text-(--muted)">
                Each value is one roll. Total lot length = sum. Or enter a single
                total below.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <Field label="Total length (m)">
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
              <button className={buttonClass} type="submit">
                Create lot for QC
              </button>
            </form>
          )}
        </Panel>

        <Panel title="2. Program QC (not goods return)" compact>
          {pendingLots.length === 0 ? (
            <EmptyState text="No program lots waiting for QC." />
          ) : (
            <form action={submitQc} className="space-y-1.5">
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
              <div>
                <p className="mb-1 text-[11px] font-medium text-(--muted)">
                  Defects (multi-select on fail)
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      name="checklistMill"
                      value="true"
                    />
                    Mill
                  </label>
                  <label className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      name="checklistWeaver"
                      value="true"
                    />
                    Weaver (dashboard HIGH)
                  </label>
                  <label className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      name="checklistDying"
                      value="true"
                    />
                    Dyeing
                  </label>
                  <label className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      name="checklistMinor"
                      value="true"
                    />
                    Minor
                  </label>
                </div>
              </div>
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
                  <select className={inputClass} name="grade" defaultValue="A">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </Field>
              </div>
              <Field label="Remarks">
                <textarea className={inputClass} name="remarks" rows={2} />
              </Field>
              <p className="text-[10px] text-(--muted)">
                Fail opens mill RF (MCRF) with a 1-day send-by SLA. Mill defect
                WhatsApps the mill immediately with full fabric detail. Weaver
                defect is HIGH on the dashboard.
              </p>
              <button className={buttonClass} type="submit">
                Submit QC
              </button>
            </form>
          )}
        </Panel>
      </div>

      {recentQc.length > 0 ? (
        <Panel title="Recent QC" className="mt-1.5" compact>
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
                  <td>{q.lot.lotNumber}</td>
                  <td>{q.passed ? "Pass" : "Fail"}</td>
                  <td>{q.defectType}</td>
                  <td className="tabular-nums text-[11px]">
                    {q.checkedAt.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </div>
  );
}
