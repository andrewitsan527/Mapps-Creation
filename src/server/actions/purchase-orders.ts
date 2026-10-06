"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type PurchaseOrderRecord = {
  id: string;
  srNo: string;
  knitterId: string;
  knitterName: string;
  quality: string;
  qtyUnits: number;
  rate: number;
  agent: string;
  remark: string;
  createdAt: string;
};

export type PurchaseOrderInput = {
  knitterId: string;
  quality: string;
  qtyUnits: number;
  rate: number;
  agent: string;
  remark: string;
};

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateStamp(date: Date) {
  return `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}${date.getFullYear()}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function num(value: { toString(): string }) {
  return Number(value.toString());
}

function assertInput(input: PurchaseOrderInput) {
  if (!input.knitterId.trim()) {
    throw new Error("Enter knitter, quality, qty (25 kg units), rate and agent.");
  }
  if (!input.quality.trim() || !input.agent.trim()) {
    throw new Error("Enter knitter, quality, qty (25 kg units), rate and agent.");
  }
  if (!Number.isFinite(input.qtyUnits) || input.qtyUnits <= 0) {
    throw new Error("Enter knitter, quality, qty (25 kg units), rate and agent.");
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    throw new Error("Enter knitter, quality, qty (25 kg units), rate and agent.");
  }
}

async function requireKnitter(id: string) {
  const knitter = await prisma.knitter.findUnique({ where: { id } });
  if (!knitter) {
    throw new Error("Enter knitter, quality, qty (25 kg units), rate and agent.");
  }
}

async function nextSrNo(now: Date) {
  const stamp = dateStamp(now);
  const rows = await prisma.purchaseOrder.findMany({
    where: { srNo: { endsWith: `-${stamp}` } },
    select: { srNo: true },
  });
  const used = rows
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function toRecord(row: {
  id: string;
  srNo: string;
  knitterId: string;
  knitter: { knitterName: string };
  quality: string;
  qtyUnits: { toString(): string };
  rate: { toString(): string };
  agent: string;
  remark: string | null;
  createdAt: Date;
}): PurchaseOrderRecord {
  return {
    id: row.id,
    srNo: row.srNo,
    knitterId: row.knitterId,
    knitterName: row.knitter.knitterName,
    quality: row.quality,
    qtyUnits: num(row.qtyUnits),
    rate: num(row.rate),
    agent: row.agent,
    remark: row.remark ?? "",
    createdAt: dateKey(row.createdAt),
  };
}

const includeKnitter = { knitter: { select: { knitterName: true } } } as const;

export async function listPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
  await requireUser();
  const rows = await prisma.purchaseOrder.findMany({
    include: includeKnitter,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createPurchaseOrder(
  input: PurchaseOrderInput,
): Promise<PurchaseOrderRecord> {
  await requireUser();
  assertInput(input);
  await requireKnitter(input.knitterId);
  const now = new Date();
  const row = await prisma.purchaseOrder.create({
    data: {
      srNo: await nextSrNo(now),
      knitterId: input.knitterId,
      quality: input.quality.trim(),
      qtyUnits: String(input.qtyUnits),
      rate: String(input.rate),
      agent: input.agent.trim(),
      remark: input.remark.trim() || null,
      createdAt: now,
    },
    include: includeKnitter,
  });
  revalidatePath("/purchase-orders");
  return toRecord(row);
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderInput,
): Promise<PurchaseOrderRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Purchase order not found.");
  assertInput(input);
  await requireKnitter(input.knitterId);
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) throw new Error("Purchase order not found.");
  const row = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      knitterId: input.knitterId,
      quality: input.quality.trim(),
      qtyUnits: String(input.qtyUnits),
      rate: String(input.rate),
      agent: input.agent.trim(),
      remark: input.remark.trim() || null,
    },
    include: includeKnitter,
  });
  revalidatePath("/purchase-orders");
  return toRecord(row);
}
