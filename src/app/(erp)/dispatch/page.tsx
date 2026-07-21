import Link from "next/link";
import { prisma } from "@/lib/db";
import { deliverSaleBill } from "@/server/actions/sales";
import { formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { GoodsTable } from "@/components/goods-table";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

export default async function DispatchPage() {
  const [pendingBills, deliveries] = await Promise.all([
    prisma.saleBill.findMany({
      where: {
        type: "SALE",
        status: "ISSUED",
        dispatches: { none: { status: "DISPATCHED" } },
      },
      include: {
        party: { select: { id: true, name: true, whatsapp: true } },
        lines: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dispatch.findMany({
      include: {
        party: { select: { name: true } },
        saleBill: { select: { id: true, billNo: true, total: true } },
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Delivery"
        description="Deliver against the sale bill and WhatsApp the party. Internal ref only — no challan."
      />

      {pendingBills.length === 0 ? (
        <Panel compact className="mb-1.5">
          <EmptyState text="No open sale bills awaiting delivery. Issue or convert a bill under Sales." />
        </Panel>
      ) : (
        <div className="mb-1.5 space-y-1.5">
          {pendingBills.map((b) => (
            <Panel
              key={b.id}
              title={`${b.billNo} → ${b.party.name}`}
              compact
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-(--muted)">
                <span className="font-semibold text-(--ink)">
                  ₹{formatQty(b.total)}
                </span>
                <span className={statusBadge(b.status)}>{b.status}</span>
                <span>
                  WA: {b.party.whatsapp ?? "not on file"}
                </span>
                <Link
                  href={`/sales/${b.id}`}
                  className="text-(--accent) underline-offset-2 hover:underline"
                >
                  Bill detail
                </Link>
              </div>

              <GoodsTable rows={b.lines} showMoney />

              <form
                action={deliverSaleBill}
                className="mt-1.5 grid gap-1.5 border-t border-(--line) pt-1.5 sm:grid-cols-2 lg:grid-cols-5"
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
                  <label className="flex items-center gap-1.5 text-[11px] text-(--muted)">
                    <input
                      type="checkbox"
                      name="notifyWhatsapp"
                      value="true"
                      defaultChecked
                    />
                    WhatsApp bill
                  </label>
                  <button className={buttonClass} type="submit">
                    Deliver & send bill
                  </button>
                </div>
              </form>
            </Panel>
          ))}
        </div>
      )}

      <Panel title="Recent deliveries" compact>
        {deliveries.length === 0 ? (
          <EmptyState text="No deliveries yet." />
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Sale bill</th>
                <th>Party</th>
                <th>Goods</th>
                <th>Vehicle</th>
                <th>WA</th>
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
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {d.saleBill.billNo}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{d.party.name}</td>
                  <td className="max-w-52 truncate text-[11px]">
                    {d.lines
                      .map((l) =>
                        [l.lotNumber, l.fabricName, l.shadeName, l.rollsDetail]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join("; ") || "—"}
                  </td>
                  <td>
                    {d.vehicleNo ?? "—"}
                    {d.driverName ? ` · ${d.driverName}` : ""}
                  </td>
                  <td>{d.whatsappSent ? "Sent" : "—"}</td>
                  <td className="text-[10px] text-(--muted)">{d.challanNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
