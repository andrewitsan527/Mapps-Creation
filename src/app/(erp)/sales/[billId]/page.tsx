import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deliverSaleBill } from "@/server/actions/sales";
import { formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { GoodsTable } from "@/components/goods-table";
import {
  Field,
  PageHeader,
  Panel,
  buttonGhostClass,
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import { WhatsAppNotifyToggle } from "@/components/whatsapp-notify-toggle";

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
    },
  });

  if (!bill) notFound();

  const delivered = bill.dispatches.some((d) => d.status === "DISPATCHED");
  const canDeliver =
    bill.type === "SALE" && bill.status === "ISSUED" && !delivered;

  return (
    <div>
      <PageHeader
        title={bill.billNo}
        description={`${bill.party.name} · ${bill.type} · ${bill.status}`}
        actions={
          <Link href="/sales" className={buttonGhostClass}>
            All bills
          </Link>
        }
      />

      <div className="mb-1.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Party
          </p>
          <p className="mt-0.5 text-[12px] font-semibold">{bill.party.name}</p>
          <p className="text-[11px] text-(--muted)">
            {bill.party.whatsapp ?? "No WhatsApp"}
          </p>
        </Panel>
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Totals
          </p>
          <p className="mt-0.5 text-[12px] font-semibold tabular-nums">
            ₹{formatQty(bill.total)}
          </p>
          <p className="text-[11px] text-(--muted)">
            Sub ₹{formatQty(bill.subtotal)} · GST ₹{formatQty(bill.gstAmount)}
          </p>
        </Panel>
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Dates
          </p>
          <p className="mt-0.5 text-[12px] font-semibold">
            {bill.billDate.toLocaleDateString("en-IN")}
          </p>
          <p className="text-[11px] text-(--muted)">
            Terms {bill.paymentTermsDays ?? bill.party.paymentTermsDays}d from
            dispatch
            {bill.creditStartsAt
              ? ` · started ${bill.creditStartsAt.toLocaleDateString("en-IN")}`
              : " · not dispatched yet"}
          </p>
          <p className="text-[11px] text-(--muted)">
            Due {bill.dueDate?.toLocaleDateString("en-IN") ?? "—"} · interest{" "}
            {Number(
              bill.interestRatePct ?? bill.party.interestRatePct ?? 28.5,
            ).toLocaleString("en-IN")}
            % p.a. after due
          </p>
        </Panel>
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Delivery
          </p>
          <p className="mt-0.5 text-[12px] font-semibold">
            {delivered ? "Delivered" : "Pending"}
          </p>
          <p className="text-[11px] text-(--muted)">
            <span className={statusBadge(bill.status)}>{bill.status}</span>
          </p>
        </Panel>
      </div>

      <Panel title="Goods on this bill" className="mb-1.5" compact>
        <GoodsTable rows={bill.lines} showMoney />
      </Panel>

      <div className="grid gap-1.5 lg:grid-cols-[300px_1fr]">
        {canDeliver ? (
          <Panel title="Deliver to party" compact>
            <p className="mb-1.5 text-[11px] text-(--muted)">
              Stocks out reserved meters and WhatsApps the sale bill with full
              goods detail. No separate challan.
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
              <button className={buttonWaClass} type="submit">
                Deliver & WhatsApp bill
              </button>
            </form>
          </Panel>
        ) : (
          <Panel title="Delivery" compact>
            <p className="text-[11px] text-(--muted)">
              {bill.type === "PROVISIONAL"
                ? "Convert this sale order to a sale bill before delivery."
                : delivered
                  ? "Goods already delivered against this bill."
                  : "Delivery not available for this status."}
            </p>
            {bill.type === "PROVISIONAL" ? (
              <Link href="/sales" className={`${buttonGhostClass} mt-2`}>
                Back to sales
              </Link>
            ) : null}
          </Panel>
        )}

        <Panel title="Delivery record" compact>
          {bill.dispatches.length === 0 ? (
            <p className="text-[11px] text-(--muted)">Not delivered yet.</p>
          ) : (
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
                    <td>
                      {d.dispatchedAt?.toLocaleString("en-IN") ?? "—"}
                    </td>
                    <td>
                      {d.vehicleNo ?? "—"}
                      {d.driverName ? ` · ${d.driverName}` : ""}
                    </td>
                    <td>{d.whatsappSent ? "Sent" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
