import type { PaymentCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  calcInterest,
  daysBetween,
  effectiveInterestRate,
  toDec,
} from "@/server/domain/finance";

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  CUSTOMER_RECEIPT: "Customer receipt",
  MILL_PAYMENT: "Mill payment",
  WEAVER_PAYMENT: "Weaver payment",
  GREY_SUPPLIER_PAYMENT: "Grey supplier payment",
  AGENT_COMMISSION: "Agent commission",
  OTHER: "Other payment",
};

export type ReceivableBill = {
  id: string;
  billNo: string;
  partyId: string;
  partyName: string;
  whatsapp: string | null;
  billTotal: number;
  paid: number;
  noteBalance: number;
  outstanding: number;
  paymentTermsDays: number;
  interestRatePct: number;
  creditStartsAt: Date | null;
  dueDate: Date | null;
  overdueDays: number;
  interest: number;
  preDueReminderSentAt: Date | null;
  dueReminderSentAt: Date | null;
  dispatched: boolean;
};

export type ClientOutstanding = {
  partyId: string;
  partyName: string;
  whatsapp: string | null;
  paymentTermsDays: number;
  interestRatePct: number;
  billCount: number;
  outstanding: number;
  overdue: number;
  interest: number;
  nextDueDate: Date | null;
};

function noteBalanceOf(
  notes: Array<{ type: "DEBIT" | "CREDIT"; amount: { toString(): string } }>,
) {
  return notes.reduce(
    (sum, note) =>
      note.type === "DEBIT"
        ? sum.plus(toDec(note.amount.toString()))
        : sum.minus(toDec(note.amount.toString())),
    toDec(0),
  );
}

export async function listDispatchedReceivables(): Promise<ReceivableBill[]> {
  const bills = await prisma.saleBill.findMany({
    where: {
      type: "SALE",
      status: "ISSUED",
      dispatches: { some: { status: "DISPATCHED" } },
    },
    include: {
      party: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          paymentTermsDays: true,
          interestRatePct: true,
        },
      },
      payments: {
        where: { direction: "RECEIPT" },
        select: { amount: true },
      },
      accountNotes: { select: { type: true, amount: true } },
      dispatches: {
        where: { status: "DISPATCHED" },
        select: { dispatchedAt: true },
        orderBy: { dispatchedAt: "asc" },
        take: 1,
      },
    },
    orderBy: [{ dueDate: "asc" }, { billDate: "asc" }],
    take: 200,
  });

  const now = new Date();
  return bills
    .map((bill) => {
      const paid = bill.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        toDec(0),
      );
      const notes = noteBalanceOf(bill.accountNotes);
      const outstanding = Number(toDec(bill.total).plus(notes).minus(paid));
      const paymentTermsDays =
        bill.paymentTermsDays ?? bill.party.paymentTermsDays;
      const interestRatePct = effectiveInterestRate(
        bill.interestRatePct ?? bill.party.interestRatePct,
      );
      const overdueDays =
        bill.dueDate && outstanding > 0
          ? Math.max(0, daysBetween(bill.dueDate, now))
          : 0;
      const interest = Number(
        calcInterest({
          principal: Math.max(outstanding, 0),
          annualRatePct: interestRatePct,
          daysOverdue: overdueDays,
        }),
      );

      return {
        id: bill.id,
        billNo: bill.billNo,
        partyId: bill.partyId,
        partyName: bill.party.name,
        whatsapp: bill.party.whatsapp,
        billTotal: Number(bill.total),
        paid: Number(paid),
        noteBalance: Number(notes),
        outstanding,
        paymentTermsDays,
        interestRatePct,
        creditStartsAt:
          bill.creditStartsAt ?? bill.dispatches[0]?.dispatchedAt ?? null,
        dueDate: bill.dueDate,
        overdueDays,
        interest,
        preDueReminderSentAt: bill.preDueReminderSentAt,
        dueReminderSentAt: bill.dueReminderSentAt,
        dispatched: bill.dispatches.length > 0,
      };
    })
    .filter((row) => row.outstanding > 0.009);
}

export function summarizeClientOutstanding(
  rows: ReceivableBill[],
): ClientOutstanding[] {
  const map = new Map<string, ClientOutstanding>();
  for (const row of rows) {
    const existing = map.get(row.partyId);
    if (!existing) {
      map.set(row.partyId, {
        partyId: row.partyId,
        partyName: row.partyName,
        whatsapp: row.whatsapp,
        paymentTermsDays: row.paymentTermsDays,
        interestRatePct: row.interestRatePct,
        billCount: 1,
        outstanding: row.outstanding,
        overdue: row.overdueDays > 0 ? row.outstanding : 0,
        interest: row.interest,
        nextDueDate: row.dueDate,
      });
      continue;
    }

    existing.billCount += 1;
    existing.outstanding += row.outstanding;
    if (row.overdueDays > 0) existing.overdue += row.outstanding;
    existing.interest += row.interest;
    if (
      row.dueDate &&
      (!existing.nextDueDate || row.dueDate < existing.nextDueDate)
    ) {
      existing.nextDueDate = row.dueDate;
    }
  }

  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
}

export async function listOpenCommissions() {
  const commissions = await prisma.commissionEntry.findMany({
    include: {
      agent: { select: { id: true, name: true } },
      relatedParty: { select: { name: true } },
      saleBill: { select: { billNo: true } },
      payments: {
        where: { direction: "PAYMENT", category: "AGENT_COMMISSION" },
        select: { amount: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return commissions
    .map((entry) => {
      const paid = entry.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        toDec(0),
      );
      const outstanding = Number(toDec(entry.amount).minus(paid));
      return {
        id: entry.id,
        agentId: entry.agentId,
        agentName: entry.agent.name,
        basis: entry.basis,
        relatedPartyName: entry.relatedParty?.name ?? null,
        saleBillNo: entry.saleBill?.billNo ?? null,
        amount: Number(entry.amount),
        paid: Number(paid),
        outstanding,
      };
    })
    .filter((row) => row.outstanding > 0.009);
}
