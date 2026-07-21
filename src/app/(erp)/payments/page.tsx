import { prisma } from "@/lib/db";
import { formatQty } from "@/lib/utils";
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
  PageHeader,
  Panel,
  StatCard,
  buttonWaClass,
} from "@/components/ui";
import { Banknote, MessageCircle } from "lucide-react";

export default async function PaymentsPage() {
  const [parties, receivables, commissions, recentPayments] = await Promise.all([
    listPartyOptions(["CLIENT", "MILL", "GREY_SUPPLIER", "AGENT", "WEAVER"]),
    listDispatchedReceivables(),
    listOpenCommissions(),
    prisma.payment.findMany({
      include: {
        party: { select: { name: true, type: true } },
        saleBill: { select: { billNo: true } },
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

  return (
    <div>
      <PageHeader
        title="Payments & dues"
        icon={Banknote}
        description="Client receipts after dispatch · mill / weaver / grey / agent payouts · 10-day & due-date WhatsApp reminders."
      />
      <div className="mb-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <StatCard label="Clients with dues" value={clients.length} icon={Banknote} />
        <StatCard label="Outstanding" value={`₹${formatQty(outstanding)}`} />
        <StatCard label="Overdue" value={`₹${formatQty(overdue)}`} />
        <StatCard label="Accrued interest" value={`₹${formatQty(interest)}`} />
      </div>

      <div className="grid gap-1.5 xl:grid-cols-[300px_1fr]">
        <Panel title="Record payment" compact>
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
              label: [
                c.agentName,
                c.basis,
                c.relatedPartyName,
                c.saleBillNo,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        </Panel>

        <div className="space-y-1.5">
          <Panel title="Client outstanding" compact>
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
                    <div
                      key={client.partyId}
                      className="rounded border border-(--line) px-2 py-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-semibold">
                            {client.partyName}
                          </p>
                          <p className="text-[10px] text-(--muted)">
                            {client.billCount} bill(s) · terms{" "}
                            {client.paymentTermsDays}d · interest{" "}
                            {formatQty(client.interestRatePct)}% p.a.
                            {client.nextDueDate
                              ? ` · next due ${client.nextDueDate.toLocaleDateString("en-IN")}`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-semibold tabular-nums">
                            ₹{formatQty(client.outstanding)}
                          </p>
                          {client.overdue > 0 ? (
                            <p className="text-[10px] font-semibold text-red-700">
                              overdue ₹{formatQty(client.overdue)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-(--muted)">current</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-(--line)">
                        <div
                          className={`h-full rounded ${
                            client.overdue > 0
                              ? "bg-red-600"
                              : "bg-(--accent)"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Bill aging (dispatched only)" compact>
            {receivables.length === 0 ? (
              <EmptyState text="No open receivables. Credit clock starts at delivery." />
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Client</th>
                      <th>Terms</th>
                      <th>Due</th>
                      <th>Outstanding</th>
                      <th>Overdue</th>
                      <th>Interest</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((row) => (
                      <tr key={row.id}>
                        <td className="font-semibold">{row.billNo}</td>
                        <td>{row.partyName}</td>
                        <td className="text-[11px]">
                          {row.paymentTermsDays}d
                          <div className="text-(--muted)">
                            from{" "}
                            {row.creditStartsAt?.toLocaleDateString("en-IN") ??
                              "—"}
                          </div>
                        </td>
                        <td className="text-[11px]">
                          {row.dueDate?.toLocaleDateString("en-IN") ?? "—"}
                        </td>
                        <td className="font-semibold">
                          ₹{formatQty(row.outstanding)}
                        </td>
                        <td>
                          {row.overdueDays > 0 ? (
                            <span className={statusBadge("HIGH")}>
                              {row.overdueDays}d
                            </span>
                          ) : (
                            <span className="badge badge-ok">OK</span>
                          )}
                        </td>
                        <td>₹{formatQty(row.interest)}</td>
                        <td>
                          {row.whatsapp ? (
                            <form action={sendPaymentReminder}>
                              <input
                                type="hidden"
                                name="saleBillId"
                                value={row.id}
                              />
                              <button className={buttonWaClass} type="submit">
                                <MessageCircle className="h-3 w-3" />
                                Remind WA
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Open agent commissions" compact>
            {commissions.length === 0 ? (
              <EmptyState text="No unpaid agent commissions." />
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Basis</th>
                    <th>Bill</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.agentName}</td>
                      <td>
                        {c.basis}
                        {c.relatedPartyName ? ` · ${c.relatedPartyName}` : ""}
                      </td>
                      <td>{c.saleBillNo ?? "—"}</td>
                      <td>₹{formatQty(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Recent payments" compact>
            {recentPayments.length === 0 ? (
              <EmptyState text="No payments recorded yet." />
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Party</th>
                    <th>Against</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="text-[11px]">
                        {PAYMENT_CATEGORY_LABELS[payment.category]}
                      </td>
                      <td>{payment.party.name}</td>
                      <td>
                        {payment.saleBill?.billNo ??
                          (payment.commissionEntry
                            ? `Commission · ${payment.commissionEntry.basis}`
                            : "—")}
                      </td>
                      <td>
                        {payment.direction === "PAYMENT" ? "−" : ""}₹
                        {formatQty(payment.amount)}
                      </td>
                      <td>{payment.method ?? "—"}</td>
                      <td>{payment.paidAt.toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
