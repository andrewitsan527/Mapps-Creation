import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatQty,
  relativeDays,
} from "@/lib/utils";
import { sendPaymentReminder } from "@/server/actions/payments";
import { listPartyOptions } from "@/lib/parties";
import { statusBadge } from "@/lib/format";
import { PaymentEntryForm } from "@/components/payment-entry-form";
import {
  listDispatchedReceivables,
  listOpenCommissions,
  summarizeClientOutstanding,
} from "@/server/domain/receivables";
import { PAYMENT_CATEGORY_LABELS } from "@/lib/payment-labels";
import {
  EmptyState,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonTinyClass,
  buttonWaClass,
} from "@/components/ui";
import {
  Banknote,
  Briefcase,
  MessageCircle,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

export default async function PaymentsPage() {
  const now = new Date();
  const [parties, receivables, commissions, recentPayments] = await Promise.all([
    listPartyOptions(["CLIENT", "MILL", "GREY_SUPPLIER", "AGENT", "WEAVER"]),
    listDispatchedReceivables(),
    listOpenCommissions(),
    prisma.payment.findMany({
      select: {
        id: true,
        amount: true,
        method: true,
        paidAt: true,
        direction: true,
        category: true,
        party: { select: { name: true, type: true } },
        saleBill: { select: { id: true, billNo: true } },
        commissionEntry: {
          select: {
            amount: true,
            basis: true,
            relatedParty: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 25,
    }),
  ]);

  const clients = summarizeClientOutstanding(receivables);
  const outstanding = clients.reduce((sum, row) => sum + row.outstanding, 0);
  const overdue = clients.reduce((sum, row) => sum + row.overdue, 0);
  const interest = receivables.reduce((sum, row) => sum + row.interest, 0);
  const maxOutstanding = Math.max(...clients.map((c) => c.outstanding), 1);
  const commissionDue = commissions.reduce(
    (sum, row) => sum + row.outstanding,
    0,
  );

  const overdueBills = receivables.filter((r) => r.overdueDays > 0);
  const dueSoonBills = receivables.filter(
    (r) =>
      r.overdueDays === 0 &&
      r.dueDate &&
      r.dueDate.getTime() - now.getTime() < 10 * 86400000,
  );
  const currentBills = receivables.filter(
    (r) => !overdueBills.includes(r) && !dueSoonBills.includes(r),
  );

  const agingBuckets = [
    {
      id: "overdue",
      title: "Overdue — interest accruing",
      tone: "danger" as const,
      hint: "Past the agreed credit period",
      rows: overdueBills,
    },
    {
      id: "due-soon",
      title: "Due within 10 days",
      tone: "warn" as const,
      hint: "Pre-due reminder window",
      rows: dueSoonBills,
    },
    {
      id: "current",
      title: "Current",
      tone: "accent" as const,
      hint: "Inside terms",
      rows: currentBills,
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Payments & dues"
        eyebrow="Money"
        icon={Banknote}
        description="The credit clock starts at delivery, not at billing. Each party carries its own terms and interest rate, so outstanding here is the real position."
        actions={
          <Link href="/finance" className={buttonTinyClass}>
            <Receipt className="h-3 w-3" />
            Notes & commission
          </Link>
        }
      />

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
          hint={`${overdueBills.length} bills`}
        />
        <Metric
          label="Accrued interest"
          value={formatMoneyShort(interest)}
          tone={interest > 0 ? "warn" : "neutral"}
        />
        <Metric
          label="Due in 10 days"
          value={dueSoonBills.length}
          hint="Reminder window"
        />
        <Metric
          label="Open bills"
          value={receivables.length}
          hint="Dispatched, unpaid"
        />
        <Metric
          label="Agent commission"
          value={formatMoneyShort(commissionDue)}
          hint={`${commissions.length} entries`}
        />
      </MetricStrip>

      <div className="grid gap-3 xl:grid-cols-[300px_1fr]">
        <Section title="Record a payment" icon={Wallet} tone="accent">
          <Panel compact>
            <PaymentEntryForm
              parties={parties}
              bills={receivables.map((bill) => ({
                id: bill.id,
                billNo: bill.billNo,
                partyId: bill.partyId,
                outstanding: bill.outstanding,
                dueDate: bill.dueDate?.toLocaleDateString("en-IN") ?? null,
              }))}
              commissions={commissions.map((c) => ({
                id: c.id,
                agentId: c.agentId,
                outstanding: c.outstanding,
                label: [c.agentName, c.basis, c.relatedPartyName, c.saleBillNo]
                  .filter(Boolean)
                  .join(" · "),
              }))}
            />
          </Panel>

          <Panel title="Client exposure" icon={Users} compact>
            {clients.length === 0 ? (
              <EmptyState text="No dispatched sale dues yet." />
            ) : (
              <div className="space-y-1.5">
                {clients.map((client) => {
                  const width = Math.max(
                    4,
                    Math.round((client.outstanding / maxOutstanding) * 100),
                  );
                  return (
                    <div key={client.partyId}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[12px] font-semibold">
                          {client.partyName}
                        </p>
                        <p className="shrink-0 text-[12px] font-semibold tabular-nums">
                          {formatMoneyShort(client.outstanding)}
                        </p>
                      </div>
                      <div className="my-1 h-1.5 overflow-hidden rounded-full bg-(--line-soft)">
                        <div
                          className={`h-full rounded-full ${
                            client.overdue > 0
                              ? "bg-(--danger)"
                              : "bg-(--accent)"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-(--muted)">
                        {client.billCount} bill(s) · {client.paymentTermsDays}d
                        terms · {formatQty(client.interestRatePct)}% p.a.
                        {client.overdue > 0
                          ? ` · overdue ${formatMoneyShort(client.overdue)}`
                          : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </Section>

        <Section
          title="Receivables by age"
          icon={Receipt}
          description="Dispatched bills only — credit starts at delivery"
        >
          {receivables.length === 0 ? (
            <Panel compact>
              <EmptyState
                icon={Receipt}
                text="No open receivables. The credit clock only starts once a bill is delivered."
                action={
                  <Link href="/dispatch" className={buttonTinyClass}>
                    Delivery desk
                  </Link>
                }
              />
            </Panel>
          ) : (
            <div className="space-y-1.5">
              {agingBuckets
                .filter((bucket) => bucket.rows.length > 0)
                .map((bucket) => (
                  <Panel
                    key={bucket.id}
                    title={bucket.title}
                    subtitle={bucket.hint}
                    tone={bucket.tone}
                    icon={Receipt}
                    flush
                    action={
                      <span className="badge badge-muted">
                        {formatMoneyShort(
                          bucket.rows.reduce((s, r) => s + r.outstanding, 0),
                        )}
                      </span>
                    }
                  >
                    <TableWrap maxHeight={320}>
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Bill</th>
                            <th>Client</th>
                            <th>Terms</th>
                            <th>Due</th>
                            <th className="num">Outstanding</th>
                            <th className="num">Interest</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {bucket.rows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <Link
                                  href={`/sales/${row.id}`}
                                  className="font-semibold text-(--accent) hover:underline"
                                >
                                  {row.billNo}
                                </Link>
                              </td>
                              <td className="text-(--muted)">
                                {row.partyName}
                              </td>
                              <td className="text-[11px]">
                                {row.paymentTermsDays}d
                                <div className="text-(--faint)">
                                  from {formatDate(row.creditStartsAt)}
                                </div>
                              </td>
                              <td className="text-[11px]">
                                {formatDate(row.dueDate)}
                                {row.dueDate ? (
                                  <div
                                    className={
                                      row.overdueDays > 0
                                        ? "font-semibold text-(--danger)"
                                        : "text-(--muted)"
                                    }
                                  >
                                    {relativeDays(row.dueDate, now)}
                                  </div>
                                ) : null}
                              </td>
                              <td className="num font-semibold">
                                {formatMoney(row.outstanding)}
                                <div className="text-[10px] font-normal text-(--faint)">
                                  paid {formatMoneyShort(row.paid)}
                                </div>
                              </td>
                              <td className="num">
                                {row.interest > 0 ? (
                                  <span className={statusBadge("HIGH")}>
                                    {formatMoneyShort(row.interest)}
                                  </span>
                                ) : (
                                  <span className="badge badge-ok">nil</span>
                                )}
                              </td>
                              <td>
                                {row.whatsapp ? (
                                  <form action={sendPaymentReminder}>
                                    <input
                                      type="hidden"
                                      name="saleBillId"
                                      value={row.id}
                                    />
                                    <button
                                      className={buttonWaClass}
                                      type="submit"
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                      Remind
                                    </button>
                                  </form>
                                ) : (
                                  <span className="text-[10px] text-(--faint)">
                                    no WA
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableWrap>
                  </Panel>
                ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Payables & ledger" icon={Wallet}>
        <div className="grid gap-1.5 xl:grid-cols-2">
          <Panel
            title="Open agent commissions"
            icon={Briefcase}
            tone="info"
            subtitle={formatMoneyShort(commissionDue)}
            flush
            action={
              <Link href="/finance" className={buttonTinyClass}>
                Add commission
              </Link>
            }
          >
            {commissions.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No unpaid agent commissions." />
              </div>
            ) : (
              <TableWrap maxHeight={260}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Basis</th>
                      <th>Bill</th>
                      <th className="num">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td className="font-semibold">{c.agentName}</td>
                        <td className="text-(--muted)">
                          {c.basis}
                          {c.relatedPartyName ? ` · ${c.relatedPartyName}` : ""}
                        </td>
                        <td>{c.saleBillNo ?? "—"}</td>
                        <td className="num font-semibold">
                          {formatMoney(c.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          <Panel
            title="Recent payments"
            icon={Banknote}
            tone="accent"
            subtitle="Receipts and payouts"
            flush
          >
            {recentPayments.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No payments recorded yet." />
              </div>
            ) : (
              <TableWrap maxHeight={260}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Party</th>
                      <th>Against</th>
                      <th className="num">Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="text-[11px] text-(--muted)">
                          {PAYMENT_CATEGORY_LABELS[payment.category]}
                        </td>
                        <td>{payment.party.name}</td>
                        <td className="text-[11px]">
                          {payment.saleBill ? (
                            <Link
                              href={`/sales/${payment.saleBill.id}`}
                              className="text-(--accent) hover:underline"
                            >
                              {payment.saleBill.billNo}
                            </Link>
                          ) : payment.commissionEntry ? (
                            `Commission · ${payment.commissionEntry.basis}`
                          ) : (
                            "—"
                          )}
                        </td>
                        <td
                          className={`num font-semibold ${
                            payment.direction === "PAYMENT"
                              ? "text-(--danger)"
                              : "text-(--accent-strong)"
                          }`}
                        >
                          {payment.direction === "PAYMENT" ? "−" : "+"}
                          {formatMoney(payment.amount)}
                          <div className="text-[10px] font-normal text-(--faint)">
                            {payment.method ?? "—"}
                          </div>
                        </td>
                        <td className="text-[11px] text-(--muted)">
                          {formatDate(payment.paidAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>

        <NextStep
          steps={[
            {
              label: "Deliver pending bills",
              href: "/dispatch",
              hint: "Credit only starts at delivery",
            },
            {
              label: "Raise a debit / credit note",
              href: "/finance",
              hint: "Adjust an outstanding bill",
            },
            {
              label: "Check WhatsApp delivery",
              href: "/messages",
              hint: "Reminder send log",
            },
          ]}
        />
      </Section>
    </div>
  );
}
