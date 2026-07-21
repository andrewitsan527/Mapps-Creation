import { prisma } from "@/lib/db";
import { createAccountNote, createCommission } from "@/server/actions/finance";
import { listPartyOptions } from "@/lib/parties";
import { formatQty } from "@/lib/utils";
import { PartySelect } from "@/components/party-select";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

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
      select: { id: true, billNo: true, total: true, party: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.accountNote.findMany({
      include: { party: { select: { name: true } }, saleBill: { select: { billNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.commissionEntry.findMany({
      include: {
        agent: { select: { name: true } },
        relatedParty: { select: { name: true } },
        saleBill: { select: { billNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Finance tools"
        description="DN/CN with TDS, and agent commission."
      />
      <div className="grid gap-1.5 xl:grid-cols-2">
        <Panel title="Debit / Credit note" compact>
          <form action={createAccountNote} className="space-y-1.5">
            <Field label="Type">
              <select className={inputClass} name="type" defaultValue="DEBIT">
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
            <Field label="Sale bill (optional)">
              <select className={inputClass} name="saleBillId">
                <option value="">—</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.billNo} · {b.party.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Amount">
                <input className={inputClass} name="amount" type="number" step="any" required />
              </Field>
              <Field label="TDS %">
                <input className={inputClass} name="tdsPct" type="number" step="any" defaultValue={0} />
              </Field>
            </div>
            <Field label="Reason">
              <input className={inputClass} name="reason" />
            </Field>
            <button className={buttonClass} type="submit">
              Create note
            </button>
          </form>
          <div className="mt-1.5">
            {notes.length === 0 ? (
              <EmptyState text="No notes yet." />
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Note</th>
                    <th>Party</th>
                    <th>Amt</th>
                    <th>TDS</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <span className="font-semibold">{n.noteNo}</span>
                        <span className="ml-1 text-[11px] text-(--muted)">{n.type}</span>
                      </td>
                      <td>{n.party.name}</td>
                      <td>₹{formatQty(n.amount)}</td>
                      <td>₹{formatQty(n.tdsAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="Agent commission" compact>
          <form action={createCommission} className="space-y-1.5">
            <Field label="Agent">
              <PartySelect name="agentId" options={agents} required />
            </Field>
            <Field label="Basis">
              <select className={inputClass} name="basis" defaultValue="PARTY">
                <option value="PARTY">Party</option>
                <option value="MILL">Mill</option>
                <option value="WEAVER">Weaver</option>
              </select>
            </Field>
            <Field label="Related party (mill/weaver/client)">
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
                    {b.billNo} · ₹{formatQty(b.total)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Base amount">
                <input className={inputClass} name="baseAmount" type="number" step="any" required />
              </Field>
              <Field label="Rate %">
                <input className={inputClass} name="ratePct" type="number" step="any" required />
              </Field>
            </div>
            <Field label="Notes">
              <input className={inputClass} name="notes" />
            </Field>
            <button className={buttonClass} type="submit">
              Save commission
            </button>
          </form>
          <div className="mt-1.5">
            {commissions.length === 0 ? (
              <EmptyState text="No commissions yet. Add an AGENT party first." />
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Basis</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <td>{c.agent.name}</td>
                      <td>
                        {c.basis}
                        {c.relatedParty ? ` · ${c.relatedParty.name}` : ""}
                      </td>
                      <td>{formatQty(c.ratePct)}%</td>
                      <td>₹{formatQty(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
