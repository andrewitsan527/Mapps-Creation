"use server";

import { revalidatePath } from "next/cache";
import { PaymentCategory, PaymentDirection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendWhatsApp } from "@/server/whatsapp";
import {
  effectiveInterestRate,
  formatPaymentReminderBody,
  toDec,
} from "@/server/domain/finance";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function recordPayment(formData: FormData) {
  await requireUser();
  const partyId = String(formData.get("partyId") || "");
  const saleBillId = String(formData.get("saleBillId") || "") || null;
  const commissionEntryId =
    String(formData.get("commissionEntryId") || "") || null;
  const category = String(
    formData.get("category") || "CUSTOMER_RECEIPT",
  ) as PaymentCategory;
  const amountRaw = String(formData.get("amount") || "").trim();
  const method = String(formData.get("method") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!partyId || !amountRaw) throw new Error("Party and amount required");
  const amount = toDec(amountRaw);
  if (!amount.isPositive()) throw new Error("Payment amount must be positive");

  const allowedCategories = Object.values(PaymentCategory);
  if (!allowedCategories.includes(category)) {
    throw new Error("Invalid payment category");
  }

  const expectedPartyType: Partial<
    Record<PaymentCategory, "CLIENT" | "MILL" | "WEAVER" | "GREY_SUPPLIER" | "AGENT">
  > = {
    CUSTOMER_RECEIPT: "CLIENT",
    MILL_PAYMENT: "MILL",
    WEAVER_PAYMENT: "WEAVER",
    GREY_SUPPLIER_PAYMENT: "GREY_SUPPLIER",
    AGENT_COMMISSION: "AGENT",
  };

  const party = await prisma.party.findUniqueOrThrow({
    where: { id: partyId },
    select: { id: true, type: true },
  });
  const requiredType = expectedPartyType[category];
  if (requiredType && party.type !== requiredType) {
    throw new Error(`${category} requires a ${requiredType} party`);
  }

  const direction: PaymentDirection =
    category === "CUSTOMER_RECEIPT" ? "RECEIPT" : "PAYMENT";

  if (category === "CUSTOMER_RECEIPT") {
    if (!saleBillId) {
      throw new Error("Select the dispatched sale bill being paid");
    }
    const bill = await prisma.saleBill.findUniqueOrThrow({
      where: { id: saleBillId },
      include: {
        payments: {
          where: { direction: "RECEIPT" },
          select: { amount: true },
        },
        accountNotes: { select: { type: true, amount: true } },
        dispatches: {
          where: { status: "DISPATCHED" },
          select: { id: true },
        },
      },
    });
    if (bill.partyId !== partyId || bill.type !== "SALE") {
      throw new Error("Sale bill does not belong to this client");
    }
    if (bill.dispatches.length === 0) {
      throw new Error("Payment can be allocated after goods are dispatched");
    }
    const paid = bill.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      toDec(0),
    );
    const noteBalance = bill.accountNotes.reduce(
      (sum, note) =>
        note.type === "DEBIT"
          ? sum.plus(note.amount)
          : sum.minus(note.amount),
      toDec(0),
    );
    const outstanding = toDec(bill.total).plus(noteBalance).minus(paid);
    if (amount.gt(outstanding)) {
      throw new Error(
        `Amount exceeds bill outstanding ₹${outstanding.toFixed(2)}`,
      );
    }
  } else if (saleBillId) {
    throw new Error("Sale bill allocation is only for customer receipts");
  }

  if (category === "AGENT_COMMISSION") {
    if (!commissionEntryId) {
      throw new Error("Select the agent commission being paid");
    }
    const commission = await prisma.commissionEntry.findUniqueOrThrow({
      where: { id: commissionEntryId },
      include: {
        payments: {
          where: { direction: "PAYMENT" },
          select: { amount: true },
        },
      },
    });
    if (commission.agentId !== partyId) {
      throw new Error("Commission does not belong to this agent");
    }
    const paid = commission.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      toDec(0),
    );
    const outstanding = toDec(commission.amount).minus(paid);
    if (amount.gt(outstanding)) {
      throw new Error(
        `Amount exceeds commission outstanding ₹${outstanding.toFixed(2)}`,
      );
    }
  } else if (commissionEntryId) {
    throw new Error("Commission allocation is only for agent payments");
  }

  await prisma.payment.create({
    data: {
      partyId,
      saleBillId,
      commissionEntryId,
      direction,
      category,
      amount,
      method,
      reference,
      notes,
    },
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

type ReminderKind = "PRE_DUE_10" | "DUE_TODAY" | "MANUAL";

async function getBillReminderData(saleBillId: string) {
  const bill = await prisma.saleBill.findUniqueOrThrow({
    where: { id: saleBillId },
    include: {
      party: true,
      payments: {
        where: { direction: "RECEIPT" },
        select: { amount: true },
      },
      accountNotes: { select: { type: true, amount: true } },
      dispatches: {
        where: { status: "DISPATCHED" },
        orderBy: { dispatchedAt: "asc" },
        take: 1,
      },
    },
  });

  const paid = bill.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    toDec(0),
  );
  const noteBalance = bill.accountNotes.reduce(
    (sum, note) =>
      note.type === "DEBIT"
        ? sum.plus(note.amount)
        : sum.minus(note.amount),
    toDec(0),
  );
  const outstanding = toDec(bill.total).plus(noteBalance).minus(paid);
  return { bill, outstanding };
}

async function sendBillReminder(saleBillId: string, kind: ReminderKind) {
  const { bill, outstanding } = await getBillReminderData(saleBillId);
  if (!bill.party.whatsapp) throw new Error("Party has no WhatsApp number");
  if (!bill.dueDate || !bill.creditStartsAt || bill.dispatches.length === 0) {
    throw new Error("Payment terms start only after dispatch");
  }
  if (!outstanding.isPositive()) return false;

  const paymentTermsDays =
    bill.paymentTermsDays ?? bill.party.paymentTermsDays;
  const interestRatePct = effectiveInterestRate(
    bill.interestRatePct ?? bill.party.interestRatePct,
  );
  const body = formatPaymentReminderBody({
    partyName: bill.party.name,
    billNo: bill.billNo,
    outstanding,
    dueDate: bill.dueDate,
    paymentTermsDays,
    interestRatePct,
    reminderKind: kind,
  });

  await sendWhatsApp({
    to: bill.party.whatsapp,
    template: "payment_reminder",
    entityType: "SaleBill",
    entityId: bill.id,
    variables: {
      billNo: bill.billNo,
      partyName: bill.party.name,
      due: outstanding.toFixed(2),
      dueDate: bill.dueDate.toLocaleDateString("en-IN"),
      paymentTermsDays: String(paymentTermsDays),
      interestRatePct: String(interestRatePct),
      reminderKind: kind,
      body,
    },
  });

  if (kind === "PRE_DUE_10") {
    await prisma.saleBill.update({
      where: { id: bill.id },
      data: { preDueReminderSentAt: new Date() },
    });
  } else if (kind === "DUE_TODAY") {
    await prisma.saleBill.update({
      where: { id: bill.id },
      data: { dueReminderSentAt: new Date() },
    });
  }
  return true;
}

export async function sendPaymentReminder(formData: FormData) {
  await requireUser();
  const saleBillId = String(formData.get("saleBillId") || "");
  if (!saleBillId) throw new Error("Sale bill required");
  await sendBillReminder(saleBillId, "MANUAL");
  revalidatePath("/payments");
  revalidatePath("/messages");
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Daily cron: exactly 10 days before dispatch-based due date and on due date. */
export async function runPaymentReminderJob() {
  const today = dayRange(new Date());
  const tenDaysAhead = new Date(today.start);
  tenDaysAhead.setDate(tenDaysAhead.getDate() + 10);
  const preDueDay = dayRange(tenDaysAhead);

  const [preDueBills, dueTodayBills] = await Promise.all([
    prisma.saleBill.findMany({
      where: {
        type: "SALE",
        status: "ISSUED",
        preDueReminderSentAt: null,
        dueDate: { gte: preDueDay.start, lt: preDueDay.end },
        creditStartsAt: { not: null },
      },
      select: { id: true },
      take: 100,
    }),
    prisma.saleBill.findMany({
      where: {
        type: "SALE",
        status: "ISSUED",
        dueReminderSentAt: null,
        dueDate: { gte: today.start, lt: today.end },
        creditStartsAt: { not: null },
      },
      select: { id: true },
      take: 100,
    }),
  ]);

  let sent = 0;
  for (const bill of preDueBills) {
    try {
      if (await sendBillReminder(bill.id, "PRE_DUE_10")) sent += 1;
    } catch {
      // Skip bills without WhatsApp / already cleared.
    }
  }
  for (const bill of dueTodayBills) {
    try {
      if (await sendBillReminder(bill.id, "DUE_TODAY")) sent += 1;
    } catch {
      // Skip bills without WhatsApp / already cleared.
    }
  }

  return {
    scanned: preDueBills.length + dueTodayBills.length,
    preDue: preDueBills.length,
    dueToday: dueTodayBills.length,
    sent,
  };
}
