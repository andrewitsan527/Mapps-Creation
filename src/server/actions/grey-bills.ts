"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type GreyBillItemRecord = {
  id: string;
  itemId: string;
  itemName: string;
  rolls: string;
  qty: string;
  rate: string;
  amount: number;
};

export type GreyBillRollRecord = {
  id: string;
  weight: string;
};

export type GreyBillMatchStatus = "MATCHED" | "UNMATCHED";

export type GreyBillRecord = {
  id: string;
  srNo: string;
  billDate: string;
  billNo: string;
  challanNo: string;
  knitterId: string;
  knitterName: string;
  millId: string;
  millName: string;
  agent: string;
  remarks: string;
  freightRate: string;
  goodsAmount: number;
  freightAmount: number;
  taxableAmount: number;
  sgstAmount: number;
  cgstAmount: number;
  netAmount: number;
  status: "DRAFT" | "SAVED";
  purchaseOrderId: string | null;
  matchScore: number | null;
  matchStatus: GreyBillMatchStatus | null;
  matchedAt: string | null;
  items: GreyBillItemRecord[];
  rolls: GreyBillRollRecord[];
};

export type GreyBillItemInput = {
  itemId: string;
  rolls: string;
  qty: string;
  rate: string;
};

export type GreyBillRollInput = {
  weight: string;
};

export type GreyBillInput = {
  billDate: string;
  billNo: string;
  challanNo: string;
  knitterId: string;
  millId: string;
  agent: string;
  remarks: string;
  freightRate: string;
  status: "DRAFT" | "SAVED";
  items: GreyBillItemInput[];
  rolls: GreyBillRollInput[];
};

const SAVED_REQUIRED = "Enter bill no., challan no. and knitter.";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function asDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error("Enter a date of issue.");
  }
  return new Date(`${iso}T00:00:00.000Z`);
}

function decText(value: { toString(): string } | null | undefined) {
  if (value == null) return "";
  return value.toString();
}

function decNumber(value: { toString(): string } | null | undefined) {
  if (value == null) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

function finiteText(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return trimmed;
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function rupee(n: number) {
  return Math.round(n);
}

type Money = {
  goodsAmount: number;
  freightAmount: number;
  taxableAmount: number;
  sgstAmount: number;
  cgstAmount: number;
  netAmount: number;
  lines: { amount: number }[];
};

function moneyFor(
  items: { qty: string; rate: string }[],
  rolls: { weight: string }[],
  freightRate: string,
): Money {
  const lines = items.map((item) => ({
    amount: rupee(num(item.qty) * num(item.rate)),
  }));
  const goodsAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const itemKg = items.reduce((sum, item) => sum + num(item.qty), 0);
  const weighed = rolls.filter((roll) => roll.weight.trim() !== "");
  const rollKg = weighed.reduce((sum, roll) => sum + num(roll.weight), 0);
  const totalKg = rollKg > 0 ? rollKg : itemKg;
  const freightAmount = rupee(num(freightRate) * totalKg);
  const taxableAmount = rupee(goodsAmount + freightAmount);
  const sgstAmount = rupee(taxableAmount * 0.025);
  const cgstAmount = rupee(taxableAmount * 0.025);
  const netAmount = rupee(taxableAmount + sgstAmount + cgstAmount);
  return {
    goodsAmount,
    freightAmount,
    taxableAmount,
    sgstAmount,
    cgstAmount,
    netAmount,
    lines,
  };
}

async function nextSrNo(isoDate: string) {
  const stamp = dateStamp(isoDate);
  const rows = await prisma.greyBill.findMany({
    where: { srNo: { endsWith: `-${stamp}` } },
    select: { srNo: true },
  });
  const used = rows
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

const includeBill = {
  knitter: { select: { knitterName: true } },
  mill: { select: { millName: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: { item: { select: { itemName: true } } },
  },
  rolls: { orderBy: { sortOrder: "asc" as const } },
};

type BillRow = {
  id: string;
  srNo: string;
  billDate: Date;
  billNo: string;
  challanNo: string;
  knitterId: string | null;
  knitter: { knitterName: string } | null;
  millId: string | null;
  mill: { millName: string } | null;
  agent: string | null;
  remarks: string | null;
  freightRate: { toString(): string } | null;
  goodsAmount: { toString(): string };
  freightAmount: { toString(): string };
  taxableAmount: { toString(): string };
  sgstAmount: { toString(): string };
  cgstAmount: { toString(): string };
  netAmount: { toString(): string };
  status: string;
  purchaseOrderId: string | null;
  matchScore: number | null;
  matchStatus: string | null;
  matchedAt: Date | null;
  items: {
    id: string;
    itemId: string | null;
    item: { itemName: string } | null;
    rolls: { toString(): string } | null;
    qtyKg: { toString(): string } | null;
    rate: { toString(): string } | null;
    amount: { toString(): string };
  }[];
  rolls: {
    id: string;
    weightKg: { toString(): string } | null;
  }[];
};

function toRecord(row: BillRow): GreyBillRecord {
  const matchStatus =
    row.matchStatus === "MATCHED" || row.matchStatus === "UNMATCHED"
      ? row.matchStatus
      : null;
  return {
    id: row.id,
    srNo: row.srNo,
    billDate: row.billDate.toISOString().slice(0, 10),
    billNo: row.billNo,
    challanNo: row.challanNo,
    knitterId: row.knitterId ?? "",
    knitterName: row.knitter?.knitterName ?? "",
    millId: row.millId ?? "",
    millName: row.mill?.millName ?? "",
    agent: row.agent ?? "",
    remarks: row.remarks ?? "",
    freightRate: decText(row.freightRate),
    goodsAmount: decNumber(row.goodsAmount),
    freightAmount: decNumber(row.freightAmount),
    taxableAmount: decNumber(row.taxableAmount),
    sgstAmount: decNumber(row.sgstAmount),
    cgstAmount: decNumber(row.cgstAmount),
    netAmount: decNumber(row.netAmount),
    status: row.status === "DRAFT" ? "DRAFT" : "SAVED",
    purchaseOrderId: row.purchaseOrderId,
    matchScore: row.matchScore,
    matchStatus,
    matchedAt: row.matchedAt ? row.matchedAt.toISOString() : null,
    items: row.items.map((item) => ({
      id: item.id,
      itemId: item.itemId ?? "",
      itemName: item.item?.itemName ?? "",
      rolls: decText(item.rolls),
      qty: decText(item.qtyKg),
      rate: decText(item.rate),
      amount: decNumber(item.amount),
    })),
    rolls: row.rolls.map((roll) => ({
      id: roll.id,
      weight: decText(roll.weightKg),
    })),
  };
}

async function assertMasters(input: GreyBillInput) {
  if (input.knitterId.trim()) {
    const knitter = await prisma.knitter.findUnique({
      where: { id: input.knitterId },
      select: { id: true },
    });
    if (!knitter) throw new Error("Knitter not found.");
  }
  if (input.millId.trim()) {
    const mill = await prisma.mill.findUnique({
      where: { id: input.millId },
      select: { id: true },
    });
    if (!mill) throw new Error("Mill not found.");
  }
  const itemIds = [
    ...new Set(input.items.map((item) => item.itemId.trim()).filter(Boolean)),
  ];
  if (itemIds.length === 0) return;
  const found = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true },
  });
  if (found.length !== itemIds.length) throw new Error("Item not found.");
}

function assertSaved(input: GreyBillInput) {
  if (input.status !== "SAVED") return;
  if (!input.billNo.trim() || !input.challanNo.trim() || !input.knitterId.trim()) {
    throw new Error(SAVED_REQUIRED);
  }
}

function billData(input: GreyBillInput, money: Money) {
  return {
    billDate: asDate(input.billDate),
    billNo: input.billNo.trim(),
    challanNo: input.challanNo.trim(),
    knitterId: input.knitterId.trim() || null,
    millId: input.millId.trim() || null,
    agent: input.agent.trim() || null,
    remarks: input.remarks.trim() || null,
    freightRate: finiteText(input.freightRate),
    goodsAmount: String(money.goodsAmount),
    freightAmount: String(money.freightAmount),
    taxableAmount: String(money.taxableAmount),
    sgstAmount: String(money.sgstAmount),
    cgstAmount: String(money.cgstAmount),
    netAmount: String(money.netAmount),
    status: input.status === "DRAFT" ? "DRAFT" : "SAVED",
    items: {
      create: input.items.map((item, index) => ({
        itemId: item.itemId.trim() || null,
        sortOrder: index,
        rolls: finiteText(item.rolls),
        qtyKg: finiteText(item.qty),
        rate: finiteText(item.rate),
        amount: String(money.lines[index]?.amount ?? 0),
      })),
    },
    rolls: {
      create: input.rolls.map((roll, index) => ({
        sortOrder: index,
        weightKg: finiteText(roll.weight),
      })),
    },
  };
}

export async function listGreyBills(): Promise<GreyBillRecord[]> {
  await requireUser();
  const rows = await prisma.greyBill.findMany({
    include: includeBill,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toRecord(row));
}

export async function createGreyBill(input: GreyBillInput): Promise<GreyBillRecord> {
  await requireUser();
  assertSaved(input);
  await assertMasters(input);
  const money = moneyFor(input.items, input.rolls, input.freightRate);
  const data = billData(input, money);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const row = await prisma.greyBill.create({
        data: { ...data, srNo: await nextSrNo(input.billDate) },
        include: includeBill,
      });
      revalidatePath("/grey-purchase");
      return toRecord(row);
    } catch (error) {
      const unique =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002";
      if (!unique || attempt === 1) throw error;
    }
  }
  throw new Error("Could not save the grey bill.");
}

export async function updateGreyBill(
  id: string,
  input: GreyBillInput,
): Promise<GreyBillRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Grey bill not found.");
  assertSaved(input);
  await assertMasters(input);
  const existing = await prisma.greyBill.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Grey bill not found.");
  const money = moneyFor(input.items, input.rolls, input.freightRate);
  const data = billData(input, money);
  const row = await prisma.$transaction(async (tx) => {
    await tx.greyBillItem.deleteMany({ where: { greyBillId: id } });
    await tx.greyBillRoll.deleteMany({ where: { greyBillId: id } });
    return tx.greyBill.update({
      where: { id },
      data,
      include: includeBill,
    });
  });
  revalidatePath("/grey-purchase");
  return toRecord(row);
}

export async function matchGreyBillPurchaseOrder(
  id: string,
  input: {
    matchStatus: GreyBillMatchStatus;
    purchaseOrderId: string | null;
    matchScore: number | null;
  },
): Promise<GreyBillRecord> {
  await requireUser();
  const existing = await prisma.greyBill.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Grey bill not found.");
  if (existing.status === "DRAFT") {
    throw new Error("Save the grey bill before checking a purchase order.");
  }

  let purchaseOrderId: string | null = null;
  let matchScore: number | null = null;
  if (input.matchStatus === "MATCHED") {
    if (!input.purchaseOrderId) throw new Error("Select a purchase order.");
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      select: { id: true },
    });
    if (!order) throw new Error("Purchase order not found.");
    const taken = await prisma.greyBill.findFirst({
      where: {
        id: { not: id },
        matchStatus: "MATCHED",
        purchaseOrderId: order.id,
      },
      select: { id: true },
    });
    if (taken) {
      throw new Error("That purchase order is already matched to another grey bill.");
    }
    purchaseOrderId = order.id;
    matchScore =
      input.matchScore != null && Number.isFinite(input.matchScore)
        ? Math.round(input.matchScore)
        : null;
  }

  const row = await prisma.greyBill.update({
    where: { id },
    data: {
      purchaseOrderId,
      matchScore,
      matchStatus: input.matchStatus,
      matchedAt: new Date(),
    },
    include: includeBill,
  });
  revalidatePath("/grey-purchase");
  return toRecord(row);
}
