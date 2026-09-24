import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  EmptyState,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonTinyClass,
} from "@/components/ui";
import { FlowRail } from "@/components/flow-rail";
import { getPipelineSnapshot } from "@/server/domain/pipeline";
import {
  listDispatchedReceivables,
  summarizeClientOutstanding,
} from "@/server/domain/receivables";
import { statusBadge } from "@/lib/format";
import {
  formatDateTime,
  formatMoneyShort,
  formatQty,
  relativeDays,
} from "@/lib/utils";
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  LayoutDashboard,
  RotateCcw,
  Truck,
  Wallet,
} from "lucide-react";

export default async function DashboardPage() {
  const now = new Date();

  const [flow, receivables, weaverPriority, openRfs, awaitingDelivery] =
    await Promise.all([
      getPipelineSnapshot(),
      listDispatchedReceivables(),
      prisma.lot.findMany({
        where: {
          defectType: "WEAVER",
          OR: [{ returnPriority: "HIGH" }, { qualityGrade: "REJECT" }],
        },
        select: {
          id: true,
          lotNumber: true,
          quantity: true,
          unit: true,
          returnPriority: true,
          fabricType: { select: { name: true } },
          shade: { select: { name: true } },
          weaver: { select: { name: true } },
        },
        orderBy: [{ returnPriority: "desc" }, { updatedAt: "desc" }],
        take: 6,
      }),
      prisma.millReturn.findMany({
        where: { status: "OPEN" },
        select: {
          id: true,
          rfNo: true,
          dueAt: true,
          lot: { select: { lotNumber: true } },
          millInward: { select: { inwardNo: true } },
          mill: { select: { name: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 6,
      }),
      prisma.saleBill.findMany({
        where: {
          type: "SALE",
          status: "ISSUED",
          dispatches: { none: { status: "DISPATCHED" } },
        },
        select: {
          id: true,
          billNo: true,
          total: true,
          billDate: true,
          party: { select: { name: true } },
        },
        orderBy: { billDate: "asc" },
        take: 6,
      }),
    ]);

  const clients = summarizeClientOutstanding(receivables);
  const outstanding = clients.reduce((sum, row) => sum + row.outstanding, 0);
  const overdue = clients.reduce((sum, row) => sum + row.overdue, 0);
  const interest = receivables.reduce((sum, row) => sum + row.interest, 0);
  const dueSoon = receivables.filter(
    (row) =>
      row.dueDate &&
      row.overdueDays === 0 &&
      row.dueDate.getTime() - now.getTime() < 10 * 86400000,
  );

  const escalations =
    weaverPriority.length + openRfs.filter((rf) => rf.dueAt < now).length;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Control tower"
        eyebrow="Command"
        icon={LayoutDashboard}
        description="Every stage of the order-to-cash chain, the exceptions that need a decision today, and the money position."
        actions={
          <>
            <Link href="/qc" className={buttonTinyClass}>
              <ClipboardCheck className="h-3 w-3" />
              QC desk
            </Link>
            <Link href="/payments" className={buttonTinyClass}>
              <Banknote className="h-3 w-3" />
              Dues
            </Link>
          </>
        }
      />

      <FlowRail counts={flow} />

      <Section
        title="Money position"
        icon={Wallet}
        tone="accent"
        description="Credit clock starts at delivery"
        actions={
          <Link href="/payments" className={buttonTinyClass}>
            Open payments
          </Link>
        }
      >
        <MetricStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            label="Outstanding"
            value={formatMoneyShort(outstanding)}
            hint={`${clients.length} clients`}
          />
          <Metric
            label="Overdue"
            value={formatMoneyShort(overdue)}
            tone={overdue > 0 ? "danger" : "neutral"}
            hint={`${flow.payment.alert} bills`}
          />
          <Metric
            label="Accrued interest"
            value={formatMoneyShort(interest)}
            tone={interest > 0 ? "warn" : "neutral"}
          />
          <Metric
            label="Due in 10 days"
            value={dueSoon.length}
            hint="Reminder window"
          />
          <Metric
            label="Awaiting delivery"
            value={flow.delivery.queue}
            hint="Billed, not dispatched"
          />
          <Metric
            label="Escalations"
            value={escalations}
            tone={escalations > 0 ? "danger" : "accent"}
            hint="Weaver HIGH + RF late"
          />
        </MetricStrip>
      </Section>

      <Section
        title="Needs a decision today"
        icon={AlertTriangle}
        tone="danger"
        description="Exceptions that block the chain"
      >
        <div className="grid gap-1.5 lg:grid-cols-2">
          <Panel
            title="Weaver defect — priority"
            icon={AlertTriangle}
            tone="danger"
            subtitle={`${flow.weaverHigh} open`}
            flush
            action={
              <Link href="/qc" className={buttonTinyClass}>
                QC desk
              </Link>
            }
          >
            {weaverPriority.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No weaver-defect lots pending. Clean run." />
              </div>
            ) : (
              <TableWrap maxHeight={240}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Fabric / shade</th>
                      <th>Weaver</th>
                      <th className="num">Qty</th>
                      <th>Pri</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {weaverPriority.map((lot) => (
                      <tr key={lot.id}>
                        <td className="font-semibold">{lot.lotNumber}</td>
                        <td className="text-(--muted)">
                          {lot.fabricType.name} / {lot.shade.name}
                        </td>
                        <td>{lot.weaver?.name ?? "—"}</td>
                        <td className="num">
                          {formatQty(lot.quantity)} {lot.unit}
                        </td>
                        <td>
                          <span
                            className={statusBadge(lot.returnPriority ?? "HIGH")}
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
            )}
          </Panel>

          <Panel
            title="Mill RF — 1-day send SLA"
            icon={RotateCcw}
            tone="warn"
            subtitle={
              flow.millRfOverdue > 0
                ? `${flow.millRfOverdue} overdue`
                : `${flow.millRfOpen} open`
            }
            flush
            action={
              <Link href="/returns" className={buttonTinyClass}>
                Returns desk
              </Link>
            }
          >
            {openRfs.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No open mill RF. Nothing to send back." />
              </div>
            ) : (
              <TableWrap maxHeight={240}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>RF</th>
                      <th>Lot</th>
                      <th>Mill</th>
                      <th>Send by</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {openRfs.map((rf) => {
                      const late = rf.dueAt < now;
                      return (
                        <tr key={rf.id}>
                          <td className="font-semibold">{rf.rfNo}</td>
                          <td>{rf.lot?.lotNumber ?? rf.millInward?.inwardNo ?? "—"}</td>
                          <td className="text-(--muted)">{rf.mill.name}</td>
                          <td className="text-[11px]">
                            {formatDateTime(rf.dueAt)}
                            <div
                              className={
                                late
                                  ? "font-semibold text-(--danger)"
                                  : "text-(--muted)"
                              }
                            >
                              {relativeDays(rf.dueAt, now)}
                            </div>
                          </td>
                          <td>
                            <Link
                              href="/returns"
                              className="font-medium text-(--accent) hover:underline"
                            >
                              Send
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>
      </Section>

      <Section
        title="Ready to move"
        icon={Truck}
        tone="info"
        description="Work parked at a handoff point"
      >
        <div className="grid gap-1.5 lg:grid-cols-2">
          <Panel
            title="Billed — awaiting delivery"
            icon={Truck}
            tone="info"
            subtitle={`${flow.delivery.queue} bills`}
            flush
            action={
              <Link href="/dispatch" className={buttonTinyClass}>
                Delivery desk
              </Link>
            }
          >
            {awaitingDelivery.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="Everything billed has been dispatched." />
              </div>
            ) : (
              <TableWrap maxHeight={220}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Client</th>
                      <th className="num">Value</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingDelivery.map((bill) => (
                      <tr key={bill.id}>
                        <td>
                          <Link
                            href={`/sales/${bill.id}`}
                            className="font-semibold text-(--accent) hover:underline"
                          >
                            {bill.billNo}
                          </Link>
                        </td>
                        <td className="text-(--muted)">{bill.party.name}</td>
                        <td className="num">
                          {formatMoneyShort(Number(bill.total))}
                        </td>
                        <td className="text-[11px] text-(--muted)">
                          {relativeDays(bill.billDate, now)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          <Panel
            title="Dues closing in"
            icon={Banknote}
            tone="accent"
            subtitle={`${dueSoon.length} within 10 days`}
            flush
            action={
              <Link href="/payments" className={buttonTinyClass}>
                Send reminders
              </Link>
            }
          >
            {dueSoon.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No dues inside the 10-day reminder window." />
              </div>
            ) : (
              <TableWrap maxHeight={220}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Client</th>
                      <th className="num">Outstanding</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSoon.slice(0, 8).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link
                            href={`/sales/${row.id}`}
                            className="font-semibold text-(--accent) hover:underline"
                          >
                            {row.billNo}
                          </Link>
                        </td>
                        <td className="text-(--muted)">{row.partyName}</td>
                        <td className="num font-semibold">
                          {formatMoneyShort(row.outstanding)}
                        </td>
                        <td className="text-[11px]">
                          {row.dueDate ? relativeDays(row.dueDate, now) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>
      </Section>
    </div>
  );
}
