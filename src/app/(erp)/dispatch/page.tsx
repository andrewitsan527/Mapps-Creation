import Link from "next/link";
import { prisma } from "@/lib/db";
import { deliverSaleBill } from "@/server/actions/sales";
import { formatDate, formatMoney, formatMoneyShort, relativeDays } from "@/lib/utils";
import { GoodsTable } from "@/components/goods-table";
import {
  EmptyState,
  Field,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonTinyClass,
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import { WhatsAppNotifyToggle } from "@/components/whatsapp-notify-toggle";
import { MessageCircle, PackageCheck, Truck } from "lucide-react";

export default async function DispatchPage() {
  const now = new Date();
  const [pendingBills, deliveries] = await Promise.all([
    prisma.saleBill.findMany({
      where: {
        type: "SALE",
        status: "ISSUED",
        dispatches: { none: { status: "DISPATCHED" } },
      },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            whatsapp: true,
            paymentTermsDays: true,
          },
        },
        lines: true,
      },
      orderBy: { billDate: "asc" },
    }),
    prisma.dispatch.findMany({
      select: {
        id: true,
        challanNo: true,
        vehicleNo: true,
        driverName: true,
        whatsappSent: true,
        dispatchedAt: true,
        party: { select: { name: true } },
        saleBill: { select: { id: true, billNo: true, total: true } },
        lines: {
          select: {
            lotNumber: true,
            fabricName: true,
            shadeName: true,
            rollsDetail: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const pendingValue = pendingBills.reduce(
    (sum, b) => sum + Number(b.total),
    0,
  );
  const noWhatsapp = pendingBills.filter((b) => !b.party.whatsapp).length;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Delivery"
        eyebrow="Sell"
        icon={Truck}
        description="Delivering a bill releases the reservation, moves stock out, and starts the client's credit clock. Internal reference only — no challan document."
        actions={
          <Link href="/payments" className={buttonTinyClass}>
            Dues after delivery
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
        <Metric
          label="Awaiting delivery"
          value={pendingBills.length}
          tone={pendingBills.length ? "warn" : "accent"}
          hint="Billed, not dispatched"
        />
        <Metric
          label="Value in queue"
          value={formatMoneyShort(pendingValue)}
          hint="Credit not started"
        />
        <Metric
          label="Missing WhatsApp"
          value={noWhatsapp}
          tone={noWhatsapp ? "danger" : "neutral"}
          hint="Client has no number"
        />
        <Metric
          label="Delivered"
          value={deliveries.length}
          tone="accent"
          hint="Recent"
        />
      </MetricStrip>

      <Section
        title="Ready to dispatch"
        icon={PackageCheck}
        tone="warn"
        description="One card per bill — check the goods, then deliver"
      >
        {pendingBills.length === 0 ? (
          <Panel compact>
            <EmptyState
              icon={PackageCheck}
              text="No open sale bills awaiting delivery. Issue or convert a bill under Sales."
              action={
                <Link href="/sales" className={buttonTinyClass}>
                  Go to sales
                </Link>
              }
            />
          </Panel>
        ) : (
          <div className="space-y-1.5">
            {pendingBills.map((b) => (
              <Panel
                key={b.id}
                title={`${b.billNo} → ${b.party.name}`}
                icon={Truck}
                tone="info"
                subtitle={`${formatMoney(b.total)} · ${b.party.paymentTermsDays}d terms`}
                compact
                action={
                  <Link href={`/sales/${b.id}`} className={buttonTinyClass}>
                    Bill detail
                  </Link>
                }
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="badge badge-muted">
                    billed {formatDate(b.billDate)} ·{" "}
                    {relativeDays(b.billDate, now)}
                  </span>
                  {b.party.whatsapp ? (
                    <span className="badge badge-wa">
                      <MessageCircle className="h-2.5 w-2.5" />
                      {b.party.whatsapp}
                    </span>
                  ) : (
                    <span className="badge badge-danger">
                      No WhatsApp on file
                    </span>
                  )}
                </div>

                <GoodsTable rows={b.lines} showMoney />

                <form
                  action={deliverSaleBill}
                  className="mt-2 grid gap-1.5 border-t border-(--line-soft) pt-2 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <input type="hidden" name="saleBillId" value={b.id} />
                  <Field label="Vehicle">
                    <input className={inputClass} name="vehicleNo" />
                  </Field>
                  <Field label="Driver">
                    <input className={inputClass} name="driverName" />
                  </Field>
                  <Field label="Driver phone">
                    <input className={inputClass} name="driverPhone" />
                  </Field>
                  <Field label="Notes">
                    <input className={inputClass} name="notes" />
                  </Field>
                  <div className="flex flex-col justify-end gap-1">
                    <WhatsAppNotifyToggle
                      label="WhatsApp sale bill"
                      hint="Full goods detail to party"
                    />
                    <button className={buttonWaClass} type="submit">
                      <MessageCircle className="h-3 w-3" />
                      Deliver & WhatsApp
                    </button>
                  </div>
                </form>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      <Section title="Delivery log" icon={Truck}>
        <Panel flush>
          {deliveries.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No deliveries yet." />
            </div>
          ) : (
            <TableWrap maxHeight={360}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Sale bill</th>
                    <th>Party</th>
                    <th>Goods</th>
                    <th>Vehicle</th>
                    <th>WA</th>
                    <th>Dispatched</th>
                    <th>Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.saleBill ? (
                          <Link
                            href={`/sales/${d.saleBill.id}`}
                            className="font-semibold text-(--accent) hover:underline"
                          >
                            {d.saleBill.billNo}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-(--muted)">{d.party.name}</td>
                      <td className="max-w-52 truncate text-[11px] text-(--muted)">
                        {d.lines
                          .map((l) =>
                            [
                              l.lotNumber,
                              l.fabricName,
                              l.shadeName,
                              l.rollsDetail,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          )
                          .join("; ") || "—"}
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
                      <td className="text-[11px] text-(--muted)">
                        {formatDate(d.dispatchedAt)}
                      </td>
                      <td className="text-[10px] text-(--faint)">
                        {d.challanNo}
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
              label: "Track the receivable",
              href: "/payments",
              hint: "Credit clock now running",
            },
            {
              label: "Handle a goods return",
              href: "/returns",
              hint: "Take stock back on this bill",
            },
          ]}
        />
      </Section>
    </div>
  );
}
