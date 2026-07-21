import { prisma } from "@/lib/db";
import { addGreyBill, createGreyPo } from "@/server/actions/grey";
import { listPartyOptions } from "@/lib/parties";
import { formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { PartySelect } from "@/components/party-select";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import { WhatsAppNotifyToggle } from "@/components/whatsapp-notify-toggle";
import { MessageCircle, Package } from "lucide-react";

export default async function GreyPage() {
  const [suppliers, orders] = await Promise.all([
    listPartyOptions("GREY_SUPPLIER"),
    prisma.greyPurchaseOrder.findMany({
      include: {
        supplier: true,
        bills: true,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Grey purchase"
        icon={Package}
        description="PO, supplier WhatsApp, and grey bills."
      />
      <div className="grid gap-1.5 lg:grid-cols-[300px_1fr]">
        <Panel title="New grey PO" compact>
          <form action={createGreyPo} className="space-y-1.5">
            <Field label="Supplier">
              <PartySelect name="supplierId" options={suppliers} required />
            </Field>
            <Field label="Quantity">
              <input className={inputClass} name="quantity" type="number" step="any" />
            </Field>
            <Field label="Unit">
              <select className={inputClass} name="unit" defaultValue="m">
                <option value="m">m</option>
                <option value="kg">kg</option>
              </select>
            </Field>
            <Field label="Fabric notes">
              <textarea className={inputClass} name="fabricNotes" rows={2} />
            </Field>
            <Field label="WhatsApp note">
              <textarea className={inputClass} name="whatsappNote" rows={2} />
            </Field>
            <WhatsAppNotifyToggle
              label="WhatsApp PO to supplier"
              hint="Uses supplier WhatsApp from masters"
            />
            <button className={buttonWaClass} type="submit">
              <MessageCircle className="h-3 w-3" />
              Create PO & WhatsApp
            </button>
          </form>
        </Panel>

        <Panel title="Purchase orders" compact>
          {orders.length === 0 ? (
            <EmptyState text="No grey POs yet. Add a GREY_SUPPLIER party first if the list is empty." />
          ) : (
            <div className="space-y-1.5">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded border border-(--line) p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold">{o.poNumber}</p>
                    <span className={statusBadge(o.status)}>{o.status}</span>
                    <span className="text-[12px] text-(--muted)">
                      {o.supplier.name}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-(--muted)">
                    Qty {o.quantity ? formatQty(o.quantity) : "—"} {o.unit}
                    {o.fabricNotes ? ` · ${o.fabricNotes}` : ""}
                  </p>
                  {o.bills.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[12px]">
                      {o.bills.map((b) => (
                        <li key={b.id}>
                          Bill {b.billNo} · ₹{formatQty(b.amount)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <form action={addGreyBill} className="mt-2 grid gap-1.5 sm:grid-cols-4">
                    <input type="hidden" name="orderId" value={o.id} />
                    <input className={inputClass} name="billNo" placeholder="Bill no" required />
                    <input
                      className={inputClass}
                      name="amount"
                      type="number"
                      step="any"
                      placeholder="Amount"
                      required
                    />
                    <input className={inputClass} name="notes" placeholder="Notes" />
                    <button className={buttonClass} type="submit">
                      Add bill
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
