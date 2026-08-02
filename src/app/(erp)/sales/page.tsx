import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  cancelProvisionalBill,
  convertProvisionalToSale,
  createDirectSaleBill,
  createProvisionalBill,
} from "@/server/actions/sales";
import {
  availableQty,
  formatMoney,
  formatMoneyShort,
  formatQty,
} from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { lotGoodsInclude, lotLabel, type LotGoods } from "@/server/domain/goods";
import { listPartyOptions } from "@/lib/parties";
import { PartySelect } from "@/components/party-select";
import {
  EmptyState,
  Field,
  FieldGroup,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonClass,
  buttonGhostClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import { WhatsAppNotifyToggle } from "@/components/whatsapp-notify-toggle";
import { CreditCard, FileText, Truck } from "lucide-react";

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
        billDate: true,
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
      take: 60,
    }),
  ]);

  const sellable = lots.filter(
    (l) => availableQty(l.onHand.toString(), l.reserved.toString()) > 0,
  ) as SellableLot[];

  const provisional = bills.filter(
    (b) => b.type === "PROVISIONAL" && b.status === "ISSUED",
  );
  const awaitingDelivery = bills.filter(
    (b) =>
      b.type === "SALE" && b.status === "ISSUED" && b._count.dispatches === 0,
  );
  const delivered = bills.filter(
    (b) => b.type === "SALE" && b._count.dispatches > 0,
  );
  const closed = bills.filter(
    (b) => b.status === "CONVERTED" || b.status === "CANCELLED",
  );

  const billGroups = [
    {
      id: "provisional",
      title: "Provisional orders — stock reserved",
      tone: "warn" as const,
      hint: "Convert to a sale bill when confirmed",
      rows: provisional,
    },
    {
      id: "awaiting",
      title: "Sale bills — awaiting delivery",
      tone: "info" as const,
      hint: "Credit clock has not started",
      rows: awaitingDelivery,
    },
    {
      id: "delivered",
      title: "Delivered",
      tone: "accent" as const,
      hint: "Now tracked under payments",
      rows: delivered,
    },
    {
      id: "closed",
      title: "Converted / cancelled",
      tone: "neutral" as const,
      hint: "History",
      rows: closed,
    },
  ];

  const sellableQty = sellable.reduce(
    (sum, l) => sum + availableQty(l.onHand.toString(), l.reserved.toString()),
    0,
  );
  const reservedValue = provisional.reduce(
    (sum, b) => sum + Number(b.total),
    0,
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Sales"
        eyebrow="Sell"
        icon={CreditCard}
        description="Reserve a lot as a provisional order, or bill it directly. Either way the stock is committed here and released at delivery."
        actions={
          <Link href="/dispatch" className={buttonTinyClass}>
            <Truck className="h-3 w-3" />
            Delivery desk
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Sellable lots"
          value={sellable.length}
          tone="accent"
          hint={`${formatQty(sellableQty)} m free`}
        />
        <Metric
          label="Provisional"
          value={provisional.length}
          tone={provisional.length ? "warn" : "neutral"}
          hint={formatMoneyShort(reservedValue)}
        />
        <Metric
          label="Awaiting delivery"
          value={awaitingDelivery.length}
          tone={awaitingDelivery.length ? "info" : "neutral"}
        />
        <Metric label="Delivered" value={delivered.length} tone="accent" />
        <Metric label="Clients" value={clients.length} hint="On masters" />
      </MetricStrip>

      <div className="grid gap-3 xl:grid-cols-[320px_1fr]">
        <Section title="Raise an order" icon={FileText} tone="accent">
          <Panel compact>
            {sellable.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                text="Nothing sellable right now. Pass a QC to bring lots into stock."
                action={
                  <Link href="/qc" className={buttonTinyClass}>
                    QC desk
                  </Link>
                }
              />
            ) : (
              <form action={createProvisionalBill} className="space-y-2.5">
                <FieldGroup label="Customer & goods">
                  <Field label="Party">
                    <PartySelect name="partyId" options={clients} required />
                  </Field>
                  <Field label="Lot / goods">
                    <select className={inputClass} name="lotId" required>
                      <option value="">Select…</option>
                      {sellable.map((l) => {
                        const avail = availableQty(
                          l.onHand.toString(),
                          l.reserved.toString(),
                        );
                        return (
                          <option key={l.id} value={l.id}>
                            {lotLabel(l, avail)}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                </FieldGroup>

                <FieldGroup label="Pricing">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="Qty (m)">
                      <input
                        className={inputClass}
                        name="quantity"
                        type="number"
                        step="any"
                        required
                      />
                    </Field>
                    <Field label="Rate">
                      <input
                        className={inputClass}
                        name="rate"
                        type="number"
                        step="any"
                        defaultValue={0}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="GST %">
                      <input
                        className={inputClass}
                        name="gstPct"
                        type="number"
                        step="any"
                        defaultValue={5}
                      />
                    </Field>
                    <Field label="TDS %">
                      <input
                        className={inputClass}
                        name="tdsPct"
                        type="number"
                        step="any"
                        defaultValue={0}
                      />
                    </Field>
                  </div>
                </FieldGroup>

                <WhatsAppNotifyToggle
                  label="WhatsApp to party on issue"
                  hint="Uses party WhatsApp number from masters"
                  defaultChecked={false}
                />

                <div className="space-y-1 border-t border-(--line-soft) pt-2">
                  <button className={buttonClass + " w-full"} type="submit">
                    Reserve as provisional order
                  </button>
                  <button
                    className={buttonGhostClass + " w-full"}
                    type="submit"
                    formAction={createDirectSaleBill}
                  >
                    Issue sale bill directly
                  </button>
                  <p className="text-[10px] leading-snug text-(--faint)">
                    Both commit the stock. A provisional order can still be
                    cancelled; a sale bill goes on to delivery.
                  </p>
                </div>
              </form>
            )}
          </Panel>
        </Section>

        <Section
          title="Order book"
          icon={FileText}
          description="Grouped by where each bill sits in the chain"
        >
          {bills.length === 0 ? (
            <Panel compact>
              <EmptyState icon={FileText} text="No bills yet." />
            </Panel>
          ) : (
            <div className="space-y-1.5">
              {billGroups
                .filter((group) => group.rows.length > 0)
                .map((group) => (
                  <Panel
                    key={group.id}
                    title={group.title}
                    subtitle={group.hint}
                    tone={group.tone}
                    icon={FileText}
                    flush
                    action={
                      <span className="badge badge-muted">
                        {formatMoneyShort(
                          group.rows.reduce((s, b) => s + Number(b.total), 0),
                        )}
                      </span>
                    }
                  >
                    <TableWrap maxHeight={320}>
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Bill</th>
                            <th>Party</th>
                            <th>Goods</th>
                            <th className="num">Total</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((b) => {
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
                                    className="font-semibold text-(--accent) hover:underline"
                                  >
                                    {b.billNo}
                                  </Link>
                                  <div className="text-[10px] text-(--faint)">
                                    {b.type}
                                  </div>
                                </td>
                                <td className="text-(--muted)">
                                  {b.party.name}
                                </td>
                                <td className="max-w-56 truncate text-[11px] text-(--muted)">
                                  {goods || "—"}
                                </td>
                                <td className="num font-semibold">
                                  {formatMoney(b.total)}
                                </td>
                                <td>
                                  <span className={statusBadge(b.status)}>
                                    {b.status}
                                  </span>
                                </td>
                                <td>
                                  {b.type === "PROVISIONAL" &&
                                  b.status === "ISSUED" ? (
                                    <div className="flex flex-wrap gap-1">
                                      <form action={convertProvisionalToSale}>
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={b.id}
                                        />
                                        <button
                                          className={buttonTinyClass}
                                          type="submit"
                                        >
                                          To sale bill
                                        </button>
                                      </form>
                                      <form action={cancelProvisionalBill}>
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={b.id}
                                        />
                                        <button
                                          className={buttonTinyClass}
                                          type="submit"
                                        >
                                          Cancel
                                        </button>
                                      </form>
                                    </div>
                                  ) : b.type === "SALE" &&
                                    b._count.dispatches === 0 ? (
                                    <Link
                                      href="/dispatch"
                                      className={buttonTinyClass}
                                    >
                                      Deliver
                                    </Link>
                                  ) : (
                                    <Link
                                      href={`/sales/${b.id}`}
                                      className={buttonTinyClass}
                                    >
                                      Open
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TableWrap>
                  </Panel>
                ))}
            </div>
          )}

          <NextStep
            steps={[
              {
                label: "Deliver issued bills",
                href: "/dispatch",
                hint: "Starts the credit clock",
                count: awaitingDelivery.length || undefined,
              },
              {
                label: "Track receivables",
                href: "/payments",
                hint: "Dues from delivered bills",
              },
              {
                label: "Check stock cover",
                href: "/stock",
                hint: "What is free to sell",
              },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
