import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  cancelProvisionalBill,
  convertProvisionalToSale,
  createDirectSaleBill,
  createProvisionalBill,
} from "@/server/actions/sales";
import { availableQty, formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { lotGoodsInclude, lotLabel, type LotGoods } from "@/server/domain/goods";
import { listPartyOptions, type PartyOption } from "@/lib/parties";
import { PartySelect } from "@/components/party-select";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  buttonGhostClass,
  inputClass,
} from "@/components/ui";

type SellableLot = LotGoods & {
  id: string;
  onHand: { toString(): string };
  reserved: { toString(): string };
};

export default async function SalesPage() {
  const [clients, lots, bills] = await Promise.all([
    listPartyOptions("CLIENT"),
    prisma.lot.findMany({
      where: { active: true },
      include: lotGoodsInclude,
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.saleBill.findMany({
      select: {
        id: true,
        billNo: true,
        type: true,
        status: true,
        total: true,
        party: { select: { name: true } },
        lines: {
          select: {
            fabricName: true,
            shadeName: true,
            colorFamily: true,
            rollCount: true,
            quantity: true,
            unit: true,
          },
        },
        _count: { select: { dispatches: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const sellable = lots.filter(
    (l) => availableQty(l.onHand.toString(), l.reserved.toString()) > 0,
  ) as SellableLot[];

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Reserve or bill lots with full fabric identity. Deliver from Delivery."
      />
      <div className="grid gap-1.5 xl:grid-cols-[280px_280px_1fr]">
        <Panel title="Sale order (provisional)" compact>
          <BillForm
            action={createProvisionalBill}
            clients={clients}
            sellable={sellable}
            submitLabel="Reserve stock"
            showNotify={false}
          />
        </Panel>
        <Panel title="Sale bill" compact>
          <BillForm
            action={createDirectSaleBill}
            clients={clients}
            sellable={sellable}
            submitLabel="Issue sale bill"
            showNotify
          />
        </Panel>
        <Panel title="Orders & bills" compact>
          {bills.length === 0 ? (
            <EmptyState text="No bills yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Party</th>
                    <th>Goods</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => {
                    const goods = b.lines
                      .map((l) =>
                        [
                          l.fabricName,
                          l.colorFamily && l.shadeName
                            ? `${l.colorFamily}/${l.shadeName}`
                            : l.shadeName,
                          l.rollCount ? `${l.rollCount}r` : null,
                          `${formatQty(l.quantity)}${l.unit}`,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join("; ");
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link
                            href={`/sales/${b.id}`}
                            className="font-semibold text-(--accent-strong) underline-offset-2 hover:underline"
                          >
                            {b.billNo}
                          </Link>
                          <div className="text-[10px] text-(--muted)">
                            {b.type}
                            {b._count.dispatches > 0 ? " · delivered" : ""}
                          </div>
                        </td>
                        <td>{b.party.name}</td>
                        <td className="max-w-56 truncate text-[11px]">
                          {goods || "—"}
                        </td>
                        <td className="tabular-nums">₹{formatQty(b.total)}</td>
                        <td>
                          <span className={statusBadge(b.status)}>{b.status}</span>
                        </td>
                        <td>
                          {b.type === "PROVISIONAL" && b.status === "ISSUED" ? (
                            <div className="flex flex-wrap gap-1">
                              <form action={convertProvisionalToSale}>
                                <input type="hidden" name="id" value={b.id} />
                                <button className={buttonGhostClass} type="submit">
                                  To sale bill
                                </button>
                              </form>
                              <form action={cancelProvisionalBill}>
                                <input type="hidden" name="id" value={b.id} />
                                <button className={buttonGhostClass} type="submit">
                                  Cancel
                                </button>
                              </form>
                            </div>
                          ) : b.type === "SALE" && b.status === "ISSUED" ? (
                            <Link href={`/sales/${b.id}`} className={buttonGhostClass}>
                              Open
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function BillForm({
  action,
  clients,
  sellable,
  submitLabel,
  showNotify,
}: {
  action: (formData: FormData) => Promise<void>;
  clients: PartyOption[];
  sellable: SellableLot[];
  submitLabel: string;
  showNotify: boolean;
}) {
  return (
    <form action={action} className="space-y-1.5">
      <Field label="Party">
        <PartySelect name="partyId" options={clients} required />
      </Field>
      <Field label="Lot / goods">
        <select className={inputClass} name="lotId" required>
          <option value="">Select…</option>
          {sellable.map((l) => {
            const avail = availableQty(l.onHand.toString(), l.reserved.toString());
            return (
              <option key={l.id} value={l.id}>
                {lotLabel(l, avail)}
              </option>
            );
          })}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Qty (m)">
          <input className={inputClass} name="quantity" type="number" step="any" required />
        </Field>
        <Field label="Rate">
          <input className={inputClass} name="rate" type="number" step="any" defaultValue={0} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="GST %">
          <input className={inputClass} name="gstPct" type="number" step="any" defaultValue={5} />
        </Field>
        <Field label="TDS %">
          <input className={inputClass} name="tdsPct" type="number" step="any" defaultValue={0} />
        </Field>
      </div>
      {showNotify ? (
        <label className="flex items-center gap-1.5 text-[11px] text-(--muted)">
          <input type="checkbox" name="notifyWhatsapp" value="true" />
          WhatsApp bill to party on issue
        </label>
      ) : null}
      <button className={buttonClass} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
