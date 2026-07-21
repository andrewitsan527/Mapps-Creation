"use client";

import { useMemo, useState } from "react";
import type { PaymentCategory } from "@prisma/client";
import type { PartyOption } from "@/lib/parties";
import { PAYMENT_CATEGORY_LABELS } from "@/server/domain/receivables";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { recordPayment } from "@/server/actions/payments";

type BillOption = {
  id: string;
  billNo: string;
  partyId: string;
  outstanding: number;
  dueDate: string | null;
};

type CommissionOption = {
  id: string;
  agentId: string;
  label: string;
  outstanding: number;
};

const CATEGORY_PARTY_TYPE: Record<
  PaymentCategory,
  "CLIENT" | "MILL" | "WEAVER" | "GREY_SUPPLIER" | "AGENT" | null
> = {
  CUSTOMER_RECEIPT: "CLIENT",
  MILL_PAYMENT: "MILL",
  WEAVER_PAYMENT: "WEAVER",
  GREY_SUPPLIER_PAYMENT: "GREY_SUPPLIER",
  AGENT_COMMISSION: "AGENT",
  OTHER: null,
};

function money(n: number) {
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function PaymentEntryForm({
  parties,
  bills,
  commissions,
}: {
  parties: PartyOption[];
  bills: BillOption[];
  commissions: CommissionOption[];
}) {
  const [category, setCategory] = useState<PaymentCategory>("CUSTOMER_RECEIPT");
  const [partyId, setPartyId] = useState("");

  const partyType = CATEGORY_PARTY_TYPE[category];
  const filteredParties = useMemo(
    () =>
      partyType ? parties.filter((party) => party.type === partyType) : parties,
    [parties, partyType],
  );
  const filteredBills = useMemo(
    () => bills.filter((bill) => !partyId || bill.partyId === partyId),
    [bills, partyId],
  );
  const filteredCommissions = useMemo(
    () =>
      commissions.filter(
        (commission) => !partyId || commission.agentId === partyId,
      ),
    [commissions, partyId],
  );

  return (
    <form action={recordPayment} className="space-y-1.5">
      <Field label="Payment type">
        <select
          className={inputClass}
          name="category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as PaymentCategory);
            setPartyId("");
          }}
          required
        >
          {(Object.keys(PAYMENT_CATEGORY_LABELS) as PaymentCategory[]).map(
            (key) => (
              <option key={key} value={key}>
                {PAYMENT_CATEGORY_LABELS[key]}
              </option>
            ),
          )}
        </select>
      </Field>

      <Field
        label={
          category === "CUSTOMER_RECEIPT"
            ? "Client"
            : category === "MILL_PAYMENT"
              ? "Mill"
              : category === "WEAVER_PAYMENT"
                ? "Weaver"
                : category === "GREY_SUPPLIER_PAYMENT"
                  ? "Grey supplier"
                  : category === "AGENT_COMMISSION"
                    ? "Agent"
                    : "Party"
        }
      >
        <select
          className={inputClass}
          name="partyId"
          required
          value={partyId}
          onChange={(event) => setPartyId(event.target.value)}
        >
          <option value="">Select…</option>
          {filteredParties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
              {party.paymentTermsDays
                ? ` · ${party.paymentTermsDays}d`
                : ""}
              {!party.whatsapp ? " · no WA" : ""}
            </option>
          ))}
        </select>
      </Field>

      {category === "CUSTOMER_RECEIPT" ? (
        <Field label="Dispatched sale bill">
          <select className={inputClass} name="saleBillId" required>
            <option value="">Select…</option>
            {filteredBills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.billNo} · due ₹{money(bill.outstanding)}
                {bill.dueDate ? ` · ${bill.dueDate}` : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="saleBillId" value="" />
      )}

      {category === "AGENT_COMMISSION" ? (
        <Field label="Commission entry">
          <select className={inputClass} name="commissionEntryId" required>
            <option value="">Select…</option>
            {filteredCommissions.map((commission) => (
              <option key={commission.id} value={commission.id}>
                {commission.label} · due ₹{money(commission.outstanding)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="commissionEntryId" value="" />
      )}

      <Field label="Amount">
        <input
          className={inputClass}
          name="amount"
          type="number"
          step="any"
          required
        />
      </Field>
      <Field label="Method">
        <select className={inputClass} name="method" defaultValue="NEFT">
          <option>NEFT</option>
          <option>RTGS</option>
          <option>UPI</option>
          <option>Cash</option>
          <option>Cheque</option>
        </select>
      </Field>
      <Field label="Reference">
        <input className={inputClass} name="reference" />
      </Field>
      <Field label="Notes">
        <input className={inputClass} name="notes" />
      </Field>
      <p className="text-[10px] text-(--muted)">
        Customer dues start only after dispatch and use that client&apos;s
        payment terms. Reminders fire 10 days before due date and on due date,
        warning that 28.5% p.a. interest applies after due date.
      </p>
      <button className={buttonClass} type="submit">
        Save payment
      </button>
    </form>
  );
}
