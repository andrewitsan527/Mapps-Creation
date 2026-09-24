import Link from "next/link";
import { prisma } from "@/lib/db";
import { addGreyBill, createGreyPo } from "@/server/actions/grey";
import {
  listAgentWeaverLinks,
  listMillWeaverLinks,
  listPartyOptions,
} from "@/lib/parties";
import { formatDate, formatMoney, formatMoneyShort, formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { GreyPurchaseFields } from "@/components/grey-purchase-fields";
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
  buttonTinyClass,
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import { WhatsAppNotifyToggle } from "@/components/whatsapp-notify-toggle";
import {
  FileText,
  MessageCircle,
  Package,
  PlusCircle,
} from "lucide-react";

export default async function GreyPage() {
  const [suppliers, mills, agents, millWeaverLinks, agentWeaverLinks, orders] =
    await Promise.all([
    listPartyOptions("WEAVER"),
    listPartyOptions("MILL"),
    listPartyOptions("AGENT"),
    listMillWeaverLinks(),
    listAgentWeaverLinks(),
    prisma.greyPurchaseOrder.findMany({
      select: {
        id: true,
        poNumber: true,
        status: true,
        orderDate: true,
        quantity: true,
        unit: true,
        dyeingRate: true,
        fabricNotes: true,
        supplier: { select: { id: true, name: true } },
        mill: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
        bills: {
          select: { id: true, billNo: true, amount: true, billDate: true, notes: true },
          orderBy: { billDate: "desc" },
        },
        programs: { select: { id: true, programNo: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 40,
    }),
  ]);

  const openCount = orders.filter((o) => o.status === "OPEN").length;
  const orderedQty = orders.reduce(
    (sum, o) => sum + Number(o.quantity ?? 0),
    0,
  );
  const billedValue = orders.reduce(
    (sum, o) => sum + o.bills.reduce((s, b) => s + Number(b.amount), 0),
    0,
  );
  const unbilled = orders.filter((o) => o.bills.length === 0).length;
  const unprogrammed = orders.filter(
    (o) => o.status === "OPEN" && o.programs.length === 0,
  ).length;

  return (
    <div className="tx-page tx-page-grey">
      <div className="tx-stage space-y-3">
      <div className="tx-chrome">
      <PageHeader
        title="Grey purchase"
        eyebrow="Procure"
        icon={Package}
        description="Raise the PO, WhatsApp it to the weaver, book their bills against it, then hand the grey over to a mill program."
        actions={
          <Link href="/masters/weavers" className={buttonTinyClass}>
            Weavers
          </Link>
        }
      />
      </div>

      <MetricStrip className="tx-metrics divide-x-0 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Open POs" value={openCount} hint={`${orders.length} total`} />
        <Metric label="Ordered qty" value={formatQty(orderedQty)} hint="all units" />
        <Metric label="Billed value" value={formatMoneyShort(billedValue)} />
        <Metric
          label="Awaiting bill"
          value={unbilled}
          tone={unbilled > 0 ? "warn" : "neutral"}
          hint="No supplier bill yet"
        />
        <Metric
          label="No program yet"
          value={unprogrammed}
          tone={unprogrammed > 0 ? "info" : "neutral"}
          hint="Grey sitting idle"
        />
      </MetricStrip>

      <div className="grid gap-3 xl:grid-cols-[300px_1fr]">
        <Section title="Raise a PO" step={1} icon={PlusCircle} tone="accent">
          <Panel compact>
            <form action={createGreyPo} className="space-y-2.5">
              <GreyPurchaseFields
                weavers={suppliers}
                mills={mills}
                agents={agents}
                millWeaverLinks={millWeaverLinks}
                agentWeaverLinks={agentWeaverLinks}
              />

              <FieldGroup label="Details">
                <Field label="Fabric notes">
                  <textarea className={inputClass} name="fabricNotes" rows={2} />
                </Field>
                <Field label="WhatsApp note" hint="Appended to the supplier message">
                  <textarea className={inputClass} name="whatsappNote" rows={2} />
                </Field>
                <WhatsAppNotifyToggle
                  label="WhatsApp PO to supplier"
                  hint="Uses supplier WhatsApp from masters"
                />
              </FieldGroup>

              <button className={buttonWaClass + " w-full"} type="submit">
                <MessageCircle className="h-3 w-3" />
                Create PO & WhatsApp
              </button>
            </form>
          </Panel>
        </Section>

        <Section
          title="Purchase orders"
          step={2}
          icon={FileText}
          description="Book supplier bills and track the handoff"
        >
          {orders.length === 0 ? (
            <Panel compact>
              <EmptyState
                icon={Package}
                text="No grey POs yet. Add a weaver in masters first."
                action={
                  <Link href="/masters/weavers" className={buttonTinyClass}>
                    Add weaver
                  </Link>
                }
              />
            </Panel>
          ) : (
            <Panel flush>
              <TableWrap maxHeight={620}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>PO</th>
                      <th>Weaver</th>
                      <th>Mill</th>
                      <th>Agent</th>
                      <th className="num">Qty</th>
                      <th className="num">Dyeing</th>
                      <th className="num">Billed</th>
                      <th>Program</th>
                      <th>Bills & notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const billed = o.bills.reduce(
                        (s, b) => s + Number(b.amount),
                        0,
                      );
                      return (
                        <tr key={o.id} className="align-top">
                          <td>
                            <span className="font-semibold">{o.poNumber}</span>
                            <div className="mt-0.5 flex items-center gap-1">
                              <span className={statusBadge(o.status)}>
                                {o.status}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-(--faint)">
                              {formatDate(o.orderDate)}
                            </div>
                          </td>
                          <td className="text-(--muted)">{o.supplier.name}</td>
                          <td className="text-(--muted)">{o.mill?.name ?? "—"}</td>
                          <td className="text-(--muted)">
                            {o.agent?.name ?? "Direct"}
                          </td>
                          <td className="num">
                            {o.quantity ? formatQty(o.quantity) : "—"} {o.unit}
                          </td>
                          <td className="num">
                            {o.dyeingRate
                              ? `${formatMoney(o.dyeingRate)}/${o.unit}`
                              : "—"}
                          </td>
                          <td className="num font-semibold">
                            {billed > 0 ? formatMoney(billed) : "—"}
                            <div className="text-[10px] font-normal text-(--faint)">
                              {o.bills.length} bill(s)
                            </div>
                          </td>
                          <td>
                            {o.programs.length > 0 ? (
                              <Link
                                href="/programs"
                                className="badge badge-ok hover:underline"
                              >
                                {o.programs.length} linked
                              </Link>
                            ) : (
                              <Link
                                href="/programs"
                                className="badge badge-info hover:underline"
                              >
                                Start program
                              </Link>
                            )}
                          </td>
                          <td className="min-w-70">
                            {o.fabricNotes ? (
                              <p className="mb-1 text-[11px] text-(--muted)">
                                {o.fabricNotes}
                              </p>
                            ) : null}
                            {o.bills.length > 0 ? (
                              <ul className="mb-1 space-y-0.5">
                                {o.bills.map((b) => (
                                  <li
                                    key={b.id}
                                    className="flex items-baseline justify-between gap-2 text-[11px]"
                                  >
                                    <span className="truncate">
                                      {b.billNo}
                                      {b.notes ? (
                                        <span className="text-(--faint)">
                                          {" "}
                                          · {b.notes}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="shrink-0 tabular-nums">
                                      {formatMoney(b.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <details className="group">
                              <summary className="cursor-pointer list-none text-[11px] font-medium text-(--accent) hover:underline">
                                + Add supplier bill
                              </summary>
                              <form
                                action={addGreyBill}
                                className="mt-1 grid gap-1 sm:grid-cols-[1fr_1fr_1fr_auto]"
                              >
                                <input type="hidden" name="orderId" value={o.id} />
                                <input
                                  className={inputClass}
                                  name="billNo"
                                  placeholder="Bill no"
                                  required
                                />
                                <input
                                  className={inputClass}
                                  name="amount"
                                  type="number"
                                  step="any"
                                  placeholder="Amount"
                                  required
                                />
                                <input
                                  className={inputClass}
                                  name="notes"
                                  placeholder="Notes"
                                />
                                <button className={buttonClass} type="submit">
                                  Add
                                </button>
                              </form>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}

          <div className="tx-next">
          <NextStep
            steps={[
              {
                label: "Create a mill program",
                href: "/programs",
                hint: "Send this grey to a mill",
                count: unprogrammed || undefined,
              },
              {
                label: "Record supplier payment",
                href: "/payments",
                hint: "Weaver payout",
              },
            ]}
          />
          </div>
        </Section>
      </div>
      </div>
    </div>
  );
}
