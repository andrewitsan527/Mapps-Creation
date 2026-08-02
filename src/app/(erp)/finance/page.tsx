import Link from "next/link";
import { prisma } from "@/lib/db";
import { createAccountNote, createCommission } from "@/server/actions/finance";
import { listPartyOptions } from "@/lib/parties";
import { formatDate, formatMoney, formatMoneyShort, formatQty } from "@/lib/utils";
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
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import { Briefcase, Calculator, Receipt } from "lucide-react";

export default async function FinancePage() {
  const [parties, agents, bills, notes, commissions] = await Promise.all([
    listPartyOptions([
      "CLIENT",
      "MILL",
      "WEAVER",
      "GREY_SUPPLIER",
      "AGENT",
      "OTHER",
    ]),
    listPartyOptions("AGENT"),
    prisma.saleBill.findMany({
      where: { type: "SALE" },
      select: {
        id: true,
        billNo: true,
        total: true,
        party: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.accountNote.findMany({
      select: {
        id: true,
        noteNo: true,
        type: true,
        amount: true,
        tdsAmount: true,
        reason: true,
        createdAt: true,
        party: { select: { name: true } },
        saleBill: { select: { id: true, billNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.commissionEntry.findMany({
      select: {
        id: true,
        basis: true,
        ratePct: true,
        amount: true,
        createdAt: true,
        agent: { select: { name: true } },
        relatedParty: { select: { name: true } },
        saleBill: { select: { id: true, billNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const debitTotal = notes
    .filter((n) => n.type === "DEBIT")
    .reduce((sum, n) => sum + Number(n.amount), 0);
  const creditTotal = notes
    .filter((n) => n.type === "CREDIT")
    .reduce((sum, n) => sum + Number(n.amount), 0);
  const tdsTotal = notes.reduce((sum, n) => sum + Number(n.tdsAmount), 0);
  const commissionTotal = commissions.reduce(
    (sum, c) => sum + Number(c.amount),
    0,
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Finance tools"
        eyebrow="Money"
        icon={Calculator}
        description="Adjustments that change what a party owes: debit and credit notes with TDS, plus the agent commission that becomes a payout."
        actions={
          <Link href="/payments" className={buttonTinyClass}>
            Payments & dues
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
        <Metric
          label="Debit notes"
          value={formatMoneyShort(debitTotal)}
          tone="warn"
          hint="Increases what they owe"
        />
        <Metric
          label="Credit notes"
          value={formatMoneyShort(creditTotal)}
          tone="accent"
          hint="Reduces what they owe"
        />
        <Metric label="TDS booked" value={formatMoneyShort(tdsTotal)} />
        <Metric
          label="Commission raised"
          value={formatMoneyShort(commissionTotal)}
          tone="info"
          hint={`${commissions.length} entries`}
        />
      </MetricStrip>

      <div className="grid gap-3 xl:grid-cols-2">
        <Section title="Debit / credit note" icon={Receipt} tone="warn">
          <Panel compact>
            <form action={createAccountNote} className="space-y-2.5">
              <FieldGroup label="Who and what">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Type">
                    <select
                      className={inputClass}
                      name="type"
                      defaultValue="DEBIT"
                    >
                      <option value="DEBIT">Debit note</option>
                      <option value="CREDIT">Credit note</option>
                    </select>
                  </Field>
                  <Field label="Party">
                    <PartySelect
                      name="partyId"
                      options={parties}
                      required
                      showType
                    />
                  </Field>
                </div>
                <Field
                  label="Sale bill (optional)"
                  hint="Links the note to a specific receivable"
                >
                  <select className={inputClass} name="saleBillId">
                    <option value="">—</option>
                    {bills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.billNo} · {b.party.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </FieldGroup>

              <FieldGroup label="Amount">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Amount">
                    <input
                      className={inputClass}
                      name="amount"
                      type="number"
                      step="any"
                      required
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
                <Field label="Reason">
                  <input className={inputClass} name="reason" />
                </Field>
              </FieldGroup>

              <button className={buttonClass + " w-full"} type="submit">
                Create note
              </button>
            </form>
          </Panel>

          <Panel title="Recent notes" icon={Receipt} flush>
            {notes.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No notes yet." />
              </div>
            ) : (
              <TableWrap maxHeight={300}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Note</th>
                      <th>Party</th>
                      <th>Bill</th>
                      <th className="num">Amount</th>
                      <th className="num">TDS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((n) => (
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
                          <div className="text-[10px] text-(--faint)">
                            {formatDate(n.createdAt)}
                          </div>
                        </td>
                        <td className="text-(--muted)">{n.party.name}</td>
                        <td>
                          {n.saleBill ? (
                            <Link
                              href={`/sales/${n.saleBill.id}`}
                              className="text-(--accent) hover:underline"
                            >
                              {n.saleBill.billNo}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num font-semibold">
                          {formatMoney(n.amount)}
                        </td>
                        <td className="num text-(--muted)">
                          {formatMoney(n.tdsAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </Section>

        <Section title="Agent commission" icon={Briefcase} tone="info">
          <Panel compact>
            <form action={createCommission} className="space-y-2.5">
              <FieldGroup label="Agent & basis">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Agent">
                    <PartySelect name="agentId" options={agents} required />
                  </Field>
                  <Field label="Basis">
                    <select
                      className={inputClass}
                      name="basis"
                      defaultValue="PARTY"
                    >
                      <option value="PARTY">Party</option>
                      <option value="MILL">Mill</option>
                      <option value="WEAVER">Weaver</option>
                    </select>
                  </Field>
                </div>
                <Field label="Related party (mill / weaver / client)">
                  <PartySelect
                    name="relatedPartyId"
                    options={parties}
                    placeholder="—"
                    showType
                  />
                </Field>
                <Field label="Sale bill (optional)">
                  <select className={inputClass} name="saleBillId">
                    <option value="">—</option>
                    {bills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.billNo} · {formatMoney(b.total)}
                      </option>
                    ))}
                  </select>
                </Field>
              </FieldGroup>

              <FieldGroup label="Calculation">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Base amount">
                    <input
                      className={inputClass}
                      name="baseAmount"
                      type="number"
                      step="any"
                      required
                    />
                  </Field>
                  <Field label="Rate %">
                    <input
                      className={inputClass}
                      name="ratePct"
                      type="number"
                      step="any"
                      required
                    />
                  </Field>
                </div>
                <Field label="Notes">
                  <input className={inputClass} name="notes" />
                </Field>
              </FieldGroup>

              <button className={buttonClass + " w-full"} type="submit">
                Save commission
              </button>
            </form>
          </Panel>

          <Panel title="Recent commissions" icon={Briefcase} flush>
            {commissions.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No commissions yet. Add an agent party first." />
              </div>
            ) : (
              <TableWrap maxHeight={300}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Basis</th>
                      <th>Bill</th>
                      <th className="num">Rate</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td className="font-semibold">{c.agent.name}</td>
                        <td className="text-(--muted)">
                          {c.basis}
                          {c.relatedParty ? ` · ${c.relatedParty.name}` : ""}
                        </td>
                        <td>
                          {c.saleBill ? (
                            <Link
                              href={`/sales/${c.saleBill.id}`}
                              className="text-(--accent) hover:underline"
                            >
                              {c.saleBill.billNo}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num text-(--muted)">
                          {formatQty(c.ratePct)}%
                        </td>
                        <td className="num font-semibold">
                          {formatMoney(c.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </Section>
      </div>

      <NextStep
        steps={[
          {
            label: "Pay an agent commission",
            href: "/payments",
            hint: "Record the payout",
          },
          {
            label: "Review client dues",
            href: "/payments",
            hint: "Notes adjust the outstanding",
          },
          {
            label: "Manage agents",
            href: "/masters/agents",
            hint: "Masters",
          },
        ]}
      />
    </div>
  );
}
