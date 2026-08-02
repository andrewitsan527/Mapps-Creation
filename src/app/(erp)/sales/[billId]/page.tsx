import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deliverSaleBill } from "@/server/actions/sales";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQty,
  relativeDays,
} from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { GoodsTable } from "@/components/goods-table";
import {
  Breadcrumbs,
  EmptyState,
  Field,
  KeyValue,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonGhostClass,
  buttonTinyClass,
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import { WhatsAppNotifyToggle } from "@/components/whatsapp-notify-toggle";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Truck,
} from "lucide-react";

export default async function SaleBillDetailPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = await params;
  const bill = await prisma.saleBill.findUnique({
    where: { id: billId },
    include: {
      party: true,
      lines: { orderBy: { id: "asc" } },
      dispatches: {
        include: { lines: true },
        orderBy: { createdAt: "desc" },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          method: true,
          paidAt: true,
          direction: true,
        },
        orderBy: { paidAt: "desc" },
      },
      accountNotes: {
        select: {
          id: true,
          noteNo: true,
          type: true,
          amount: true,
          reason: true,
        },
      },
    },
  });

  if (!bill) notFound();

  const now = new Date();
  const delivered = bill.dispatches.some((d) => d.status === "DISPATCHED");
  const canDeliver =
    bill.type === "SALE" && bill.status === "ISSUED" && !delivered;

  const paid = bill.payments
    .filter((p) => p.direction === "RECEIPT")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const noteBalance = bill.accountNotes.reduce(
    (sum, n) => sum + (n.type === "DEBIT" ? Number(n.amount) : -Number(n.amount)),
    0,
  );
  const outstanding = Number(bill.total) + noteBalance - paid;
  const settled = outstanding <= 0.009;
  const termsDays = bill.paymentTermsDays ?? bill.party.paymentTermsDays;
  const interestRate = Number(
    bill.interestRatePct ?? bill.party.interestRatePct ?? 28.5,
  );

  const stages = [
    { label: "Issued", done: true, detail: formatDate(bill.billDate) },
    {
      label: "Delivered",
      done: delivered,
      detail: delivered
        ? formatDate(bill.creditStartsAt ?? bill.dispatches[0]?.dispatchedAt)
        : "pending",
    },
    {
      label: "Paid",
      done: settled,
      detail: settled ? "settled" : formatMoney(outstanding) + " open",
    },
  ];

  return (
    <div className="space-y-3">
      <Breadcrumbs
        items={[
          { label: "Sell", href: "/sales" },
          { label: "Sales", href: "/sales" },
          { label: bill.billNo },
        ]}
      />

      <PageHeader
        title={bill.billNo}
        icon={CreditCard}
        description={`${bill.party.name} · ${bill.type} · ${bill.status}`}
        actions={
          <>
            <Link href="/sales" className={buttonGhostClass}>
              All bills
            </Link>
            {delivered ? (
              <Link href="/payments" className={buttonGhostClass}>
                <Banknote className="h-3 w-3" />
                Dues
              </Link>
            ) : null}
          </>
        }
      />

      <Panel flush>
        <ol className="flex divide-x divide-(--line-soft)">
          {stages.map((stage) => (
            <li key={stage.label} className="flex-1 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${
                    stage.done ? "text-(--accent)" : "text-(--faint)"
                  }`}
                />
                <span
                  className={`text-[11px] font-semibold tracking-wide uppercase ${
                    stage.done ? "text-(--accent-strong)" : "text-(--muted)"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-(--ink)">{stage.detail}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Party" icon={FileText} compact>
          <KeyValue
            items={[
              { label: "Name", value: bill.party.name },
              {
                label: "WhatsApp",
                value: bill.party.whatsapp ?? "not on file",
              },
              { label: "GST", value: bill.party.gstin ?? "—" },
            ]}
          />
        </Panel>
        <Panel title="Totals" icon={Banknote} compact>
          <KeyValue
            items={[
              { label: "Bill total", value: formatMoney(bill.total) },
              {
                label: "Subtotal / GST",
                value: `${formatMoney(bill.subtotal)} · ${formatMoney(bill.gstAmount)}`,
              },
              {
                label: "Notes",
                value: noteBalance === 0 ? "—" : formatMoney(noteBalance),
              },
            ]}
          />
        </Panel>
        <Panel title="Credit terms" icon={CreditCard} compact>
          <KeyValue
            items={[
              { label: "Terms", value: `${termsDays}d from dispatch` },
              {
                label: "Clock started",
                value: bill.creditStartsAt
                  ? formatDate(bill.creditStartsAt)
                  : "not dispatched",
              },
              {
                label: "Due",
                value: bill.dueDate
                  ? `${formatDate(bill.dueDate)} · ${relativeDays(bill.dueDate, now)}`
                  : "—",
              },
              {
                label: "Interest after due",
                value: `${formatQty(interestRate)}% p.a.`,
              },
            ]}
          />
        </Panel>
        <Panel
          title="Money position"
          icon={Banknote}
          tone={settled ? "accent" : outstanding > 0 ? "warn" : "neutral"}
          compact
        >
          <KeyValue
            items={[
              { label: "Received", value: formatMoney(paid) },
              {
                label: "Outstanding",
                value: (
                  <span
                    className={
                      settled ? "text-(--accent-strong)" : "text-(--danger)"
                    }
                  >
                    {settled ? "Settled" : formatMoney(outstanding)}
                  </span>
                ),
              },
              {
                label: "Status",
                value: (
                  <span className={statusBadge(bill.status)}>
                    {bill.status}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>

      <Section title="Goods on this bill" icon={FileText}>
        <Panel compact>
          <GoodsTable rows={bill.lines} showMoney />
        </Panel>
      </Section>

      <Section title="Delivery" icon={Truck} tone={delivered ? "accent" : "warn"}>
        <div className="grid gap-1.5 lg:grid-cols-[320px_1fr]">
          {canDeliver ? (
            <Panel title="Deliver to party" icon={Truck} tone="warn" compact>
              <p className="mb-2 rounded-md border border-(--line) bg-(--panel-sunken) px-2 py-1.5 text-[10.5px] leading-snug text-(--muted)">
                Releases the reservation, stocks the metres out, WhatsApps the
                bill with full goods detail, and starts the {termsDays}-day
                credit clock. No separate challan.
              </p>
              <form action={deliverSaleBill} className="space-y-1.5">
                <input type="hidden" name="saleBillId" value={bill.id} />
                <Field label="Vehicle">
                  <input className={inputClass} name="vehicleNo" />
                </Field>
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Driver">
                    <input className={inputClass} name="driverName" />
                  </Field>
                  <Field label="Driver phone">
                    <input className={inputClass} name="driverPhone" />
                  </Field>
                </div>
                <Field label="Notes">
                  <input className={inputClass} name="notes" />
                </Field>
                <WhatsAppNotifyToggle
                  label="WhatsApp sale bill to party"
                  hint="Sends full goods identity with delivery"
                />
                <button className={buttonWaClass + " w-full"} type="submit">
                  Deliver & WhatsApp bill
                </button>
              </form>
            </Panel>
          ) : (
            <Panel title="Delivery status" icon={Truck} compact>
              <p className="text-[11.5px] text-(--muted)">
                {bill.type === "PROVISIONAL"
                  ? "Convert this sale order to a sale bill before delivery."
                  : delivered
                    ? "Goods already delivered against this bill. The credit clock is running."
                    : "Delivery is not available for this status."}
              </p>
              <div className="mt-2">
                <Link
                  href={bill.type === "PROVISIONAL" ? "/sales" : "/payments"}
                  className={buttonTinyClass}
                >
                  {bill.type === "PROVISIONAL"
                    ? "Back to sales"
                    : "Track the due"}
                </Link>
              </div>
            </Panel>
          )}

          <Panel title="Delivery record" icon={Truck} flush>
            {bill.dispatches.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="Not delivered yet." />
              </div>
            ) : (
              <TableWrap>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      <th>When</th>
                      <th>Vehicle</th>
                      <th>WA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.dispatches.map((d) => (
                      <tr key={d.id}>
                        <td className="font-semibold">{d.challanNo}</td>
                        <td className="text-[11px]">
                          {formatDateTime(d.dispatchedAt)}
                        </td>
                        <td className="text-[11px]">
                          {d.vehicleNo ?? "—"}
                          {d.driverName ? (
                            <div className="text-[10px] text-(--faint)">
                              {d.driverName}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={
                              d.whatsappSent
                                ? "badge badge-wa"
                                : "badge badge-muted"
                            }
                          >
                            {d.whatsappSent ? "Sent" : "—"}
                          </span>
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

      {bill.payments.length > 0 || bill.accountNotes.length > 0 ? (
        <Section title="Money against this bill" icon={Banknote} tone="accent">
          <div className="grid gap-1.5 lg:grid-cols-2">
            <Panel title="Receipts" icon={Banknote} flush>
              {bill.payments.length === 0 ? (
                <div className="p-2.5">
                  <EmptyState text="No receipts yet." />
                </div>
              ) : (
                <TableWrap maxHeight={220}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="text-[11px]">{formatDate(p.paidAt)}</td>
                          <td className="text-(--muted)">{p.method ?? "—"}</td>
                          <td className="num font-semibold">
                            {formatMoney(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Panel>

            <Panel title="Notes on this bill" icon={FileText} flush>
              {bill.accountNotes.length === 0 ? (
                <div className="p-2.5">
                  <EmptyState text="No debit or credit notes." />
                </div>
              ) : (
                <TableWrap maxHeight={220}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Note</th>
                        <th>Reason</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.accountNotes.map((n) => (
                        <tr key={n.id}>
                          <td>
                            <span className="font-semibold">{n.noteNo}</span>
                            <div>
                              <span
                                className={
                                  n.type === "DEBIT"
                                    ? "badge badge-warn"
                                    : "badge badge-ok"
                                }
                              >
                                {n.type}
                              </span>
                            </div>
                          </td>
                          <td className="text-(--muted)">{n.reason ?? "—"}</td>
                          <td className="num font-semibold">
                            {formatMoney(n.amount)}
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
      ) : null}

      <NextStep
        steps={[
          ...(canDeliver
            ? [
                {
                  label: "Deliver from the dispatch desk",
                  href: "/dispatch",
                  hint: "Batch view of pending bills",
                },
              ]
            : []),
          ...(delivered && !settled
            ? [
                {
                  label: "Record a receipt",
                  href: "/payments",
                  hint: formatMoney(outstanding) + " outstanding",
                },
              ]
            : []),
          {
            label: "Take goods back",
            href: "/returns",
            hint: "Goods return against this bill",
          },
          {
            label: "Raise a note",
            href: "/finance",
            hint: "Debit or credit adjustment",
          },
        ]}
      />
    </div>
  );
}
