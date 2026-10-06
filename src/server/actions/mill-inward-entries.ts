"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type MillInwardSource = "GREY_PURCHASE" | "MANUAL" | "QC_RETURN";
export type MillInwardStatus = "pending" | "completed";

export type MillInwardItemRecord = {
  id: string;
  itemId: string;
  itemName: string;
  rolls: string;
  qty: string;
};

export type MillInwardRollRecord = {
  id: string;
  weight: string;
};

export type MillInwardQcReturn = {
  qcSrNo: string;
  finishedWorkSrNo: string;
  programSrNo: string;
  knitterChallanNo: string;
  challanNo: string;
  itemName: string;
  code: string;
  colour: string;
  failedRolls: number;
  failedKg: string;
  grade: string;
  defectType: string;
  lines: { id: string; rolls: string; codeNo: string; colour: string }[];
};

export type MillInwardRecord = {
  id: string;
  srNo: string;
  inwardDate: string;
  dateOfIssue: string;
  knitterId: string;
  knitterName: string;
  millId: string;
  millName: string;
  itemLabel: string;
  quantity: string;
  remarks: string;
  status: MillInwardStatus;
  sentOn: string;
  sourceType: MillInwardSource;
  greyBillId: string;
  sendNote: string;
  qcReturn: MillInwardQcReturn | null;
  items: MillInwardItemRecord[];
  rolls: MillInwardRollRecord[];
};

export type MillInwardItemInput = {
  itemId: string;
  rolls: string;
  qty: string;
};

export type MillInwardRollInput = {
  weight: string;
};

export type MillInwardInput = {
  inwardDate: string;
  dateOfIssue: string;
  knitterId: string;
  millId: string;
  quantity: string;
  remarks: string;
  items: MillInwardItemInput[];
  rolls: MillInwardRollInput[];
};

const MANUAL_REQUIRED = "Enter mill and item.";
const GREY_REQUIRED = "Enter knitter, mill and item.";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function asDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error("Enter a date.");
  }
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function decText(value: { toString(): string } | null | undefined) {
  if (value == null) return "";
  return value.toString();
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

function filledItems(items: MillInwardItemInput[]) {
  return items.filter((item) => item.itemId.trim());
}

function filledRolls(rolls: MillInwardRollInput[]) {
  return rolls.filter((roll) => roll.weight.trim() !== "");
}

async function nextSrNo(isoDate: string) {
  const stamp = dateStamp(isoDate);
  const rows = await prisma.millInwardEntry.findMany({
    where: { srNo: { endsWith: `-${stamp}` } },
    select: { srNo: true },
  });
  const used = rows
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

const includeEntry = {
  knitter: { select: { knitterName: true } },
  mill: { select: { millName: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: { item: { select: { itemName: true } } },
  },
  rolls: { orderBy: { sortOrder: "asc" as const } },
  returnLines: { orderBy: { sortOrder: "asc" as const } },
};

type EntryRow = {
  id: string;
  srNo: string;
  inwardDate: Date;
  dateOfIssue: Date | null;
  knitterId: string | null;
  knitter: { knitterName: string } | null;
  millId: string | null;
  mill: { millName: string } | null;
  quantityKg: { toString(): string } | null;
  remarks: string | null;
  status: string;
  sentOn: Date | null;
  sourceType: string;
  greyBillId: string | null;
  items: {
    id: string;
    itemId: string | null;
    item: { itemName: string } | null;
    rolls: { toString(): string } | null;
    qtyKg: { toString(): string } | null;
  }[];
  rolls: {
    id: string;
    weightKg: { toString(): string } | null;
  }[];
  sendNote: string;
  returnItemName: string;
  returnKnitterChallanNo: string;
  returnChallanNo: string;
  returnCode: string;
  returnColour: string;
  returnFailedRolls: number | null;
  returnGrade: string;
  returnDefectType: string;
  returnQcSrNo: string;
  returnFinishedWorkSrNo: string;
  returnProgramSrNo: string;
  returnLines: {
    id: string;
    rolls: number;
    codeNo: string;
    colour: string;
  }[];
};

function itemLabel(items: { itemName: string }[]) {
  return items
    .map((item) => item.itemName.trim())
    .filter(Boolean)
    .join(" · ");
}

function sourceOf(value: string): MillInwardSource {
  if (value === "GREY_PURCHASE" || value === "QC_RETURN") return value;
  return "MANUAL";
}

function toRecord(row: EntryRow): MillInwardRecord {
  const items = row.items.map((item) => ({
    id: item.id,
    itemId: item.itemId ?? "",
    itemName: item.item?.itemName ?? "",
    rolls: decText(item.rolls),
    qty: decText(item.qtyKg),
  }));
  const sourceType = sourceOf(row.sourceType);
  const quantity = decText(row.quantityKg);
  return {
    id: row.id,
    srNo: row.srNo,
    inwardDate: isoDate(row.inwardDate),
    dateOfIssue: row.dateOfIssue ? isoDate(row.dateOfIssue) : "",
    knitterId: row.knitterId ?? "",
    knitterName: row.knitter?.knitterName ?? "",
    millId: row.millId ?? "",
    millName: row.mill?.millName ?? "",
    itemLabel: sourceType === "QC_RETURN" ? row.returnItemName : itemLabel(items),
    quantity,
    remarks: row.remarks ?? "",
    status: row.status === "completed" ? "completed" : "pending",
    sentOn: row.sentOn ? isoDate(row.sentOn) : "",
    sourceType,
    greyBillId: row.greyBillId ?? "",
    sendNote: row.sendNote,
    qcReturn:
      sourceType === "QC_RETURN"
        ? {
            qcSrNo: row.returnQcSrNo,
            finishedWorkSrNo: row.returnFinishedWorkSrNo,
            programSrNo: row.returnProgramSrNo,
            knitterChallanNo: row.returnKnitterChallanNo,
            challanNo: row.returnChallanNo,
            itemName: row.returnItemName,
            code: row.returnCode,
            colour: row.returnColour,
            failedRolls: row.returnFailedRolls ?? 0,
            failedKg: quantity,
            grade: row.returnGrade,
            defectType: row.returnDefectType,
            lines: row.returnLines.map((line) => ({
              id: line.id,
              rolls: String(line.rolls),
              codeNo: line.codeNo,
              colour: line.colour,
            })),
          }
        : null,
    items,
    rolls: row.rolls.map((roll) => ({
      id: roll.id,
      weight: decText(roll.weightKg),
    })),
  };
}

async function assertMasters(input: MillInwardInput, requireKnitter: boolean) {
  const items = filledItems(input.items);
  if (!input.millId.trim() || items.length === 0) {
    throw new Error(requireKnitter ? GREY_REQUIRED : MANUAL_REQUIRED);
  }
  if (requireKnitter && !input.knitterId.trim()) {
    throw new Error(GREY_REQUIRED);
  }
  if (input.knitterId.trim()) {
    const knitter = await prisma.knitter.findUnique({
      where: { id: input.knitterId },
      select: { id: true },
    });
    if (!knitter) throw new Error("Knitter not found.");
  }
  const mill = await prisma.mill.findUnique({
    where: { id: input.millId },
    select: { id: true },
  });
  if (!mill) throw new Error("Mill not found.");
  const itemIds = [...new Set(items.map((item) => item.itemId.trim()))];
  const found = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true },
  });
  if (found.length !== itemIds.length) throw new Error("Item not found.");
}

function nestedChildren(input: MillInwardInput) {
  const items = filledItems(input.items);
  const rolls = filledRolls(input.rolls);
  return {
    items: {
      create: items.map((item, index) => ({
        itemId: item.itemId.trim(),
        sortOrder: index,
        rolls: finiteText(item.rolls),
        qtyKg: finiteText(item.qty),
      })),
    },
    rolls: {
      create: rolls.map((roll, index) => ({
        sortOrder: index,
        weightKg: finiteText(roll.weight),
      })),
    },
  };
}

function fieldData(input: MillInwardInput) {
  return {
    inwardDate: asDate(input.inwardDate),
    dateOfIssue: input.dateOfIssue.trim() ? asDate(input.dateOfIssue) : null,
    knitterId: input.knitterId.trim() || null,
    millId: input.millId.trim() || null,
    quantityKg: finiteText(input.quantity),
    remarks: input.remarks.trim() || null,
    ...nestedChildren(input),
  };
}

export async function listMillInwardEntries(): Promise<MillInwardRecord[]> {
  await requireUser();
  const rows = await prisma.millInwardEntry.findMany({
    include: includeEntry,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toRecord(row));
}

export async function createMillInwardEntry(
  input: MillInwardInput,
): Promise<MillInwardRecord> {
  await requireUser();
  await assertMasters(input, false);
  const data = fieldData(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const row = await prisma.millInwardEntry.create({
        data: {
          ...data,
          srNo: await nextSrNo(input.inwardDate),
          status: "pending",
          sourceType: "MANUAL",
        },
        include: includeEntry,
      });
      revalidatePath("/mill-inward");
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
  throw new Error("Could not save the mill inward.");
}

async function replaceEntry(id: string, input: MillInwardInput, status: MillInwardStatus) {
  const data = fieldData(input);
  return prisma.$transaction(async (tx) => {
    await tx.millInwardEntryItem.deleteMany({ where: { entryId: id } });
    await tx.millInwardEntryRoll.deleteMany({ where: { entryId: id } });
    return tx.millInwardEntry.update({
      where: { id },
      data: {
        ...data,
        status,
        sentOn: status === "completed" ? asDate(todayIso()) : null,
      },
      include: includeEntry,
    });
  });
}

export async function updateMillInwardEntry(
  id: string,
  input: MillInwardInput,
): Promise<MillInwardRecord> {
  await requireUser();
  const existing = await prisma.millInwardEntry.findUnique({
    where: { id },
    select: { id: true, status: true, sourceType: true },
  });
  if (!existing) throw new Error("Mill inward not found.");
  if (existing.sourceType === "QC_RETURN") {
    throw new Error("This mill inward is a QC return.");
  }
  if (existing.status === "completed") {
    throw new Error("This inward is already completed.");
  }
  await assertMasters(input, existing.sourceType === "GREY_PURCHASE");
  const row = await replaceEntry(id, input, "pending");
  revalidatePath("/mill-inward");
  return toRecord(row);
}

export async function sendMillInwardEntry(
  id: string,
  input: MillInwardInput,
): Promise<MillInwardRecord> {
  await requireUser();
  const existing = await prisma.millInwardEntry.findUnique({
    where: { id },
    select: { id: true, status: true, sourceType: true },
  });
  if (!existing) throw new Error("Mill inward not found.");
  if (existing.sourceType === "QC_RETURN") {
    throw new Error("This mill inward is a QC return.");
  }
  if (existing.status === "completed") {
    throw new Error("This inward is already completed.");
  }
  await assertMasters(input, existing.sourceType === "GREY_PURCHASE");
  const row = await replaceEntry(id, input, "completed");
  revalidatePath("/mill-inward");
  return toRecord(row);
}

function greyQuantity(
  rolls: { weightKg: { toString(): string } | null }[],
  items: { qtyKg: { toString(): string } | null }[],
) {
  const rollKg = rolls.reduce((sum, roll) => sum + num(decText(roll.weightKg)), 0);
  if (rollKg > 0) return rollKg.toFixed(3);
  const itemKg = items.reduce((sum, item) => sum + num(decText(item.qtyKg)), 0);
  return itemKg.toFixed(3);
}

export async function ensureMillInwardFromGreyBill(
  greyBillId: string,
): Promise<MillInwardRecord> {
  await requireUser();
  if (!greyBillId.trim()) throw new Error("Grey bill not found.");
  const existing = await prisma.millInwardEntry.findUnique({
    where: { greyBillId },
    include: includeEntry,
  });
  if (existing) return toRecord(existing);

  const bill = await prisma.greyBill.findUnique({
    where: { id: greyBillId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      rolls: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!bill || bill.status === "DRAFT") throw new Error("Grey bill not found.");

  const inwardDate = todayIso();
  const quantity = greyQuantity(bill.rolls, bill.items);
  const data = {
    srNo: await nextSrNo(inwardDate),
    inwardDate: asDate(inwardDate),
    dateOfIssue: bill.billDate,
    knitterId: bill.knitterId,
    millId: bill.millId,
    quantityKg: finiteText(quantity),
    remarks: bill.remarks,
    status: "pending",
    sourceType: "GREY_PURCHASE",
    greyBillId: bill.id,
    items: {
      create: bill.items.map((item) => ({
        itemId: item.itemId,
        sortOrder: item.sortOrder,
        rolls: item.rolls,
        qtyKg: item.qtyKg,
      })),
    },
    rolls: {
      create: bill.rolls.map((roll) => ({
        sortOrder: roll.sortOrder,
        weightKg: roll.weightKg,
      })),
    },
  };

  try {
    const row = await prisma.millInwardEntry.create({
      data,
      include: includeEntry,
    });
    revalidatePath("/mill-inward");
    return toRecord(row);
  } catch (error) {
    const unique =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";
    if (!unique) throw error;
    const raced = await prisma.millInwardEntry.findUnique({
      where: { greyBillId },
      include: includeEntry,
    });
    if (!raced) throw error;
    return toRecord(raced);
  }
}

export async function updateMillInwardQcReturn(
  id: string,
  input: { remarks: string; sendNote: string; send: boolean },
): Promise<MillInwardRecord> {
  await requireUser();
  const existing = await prisma.millInwardEntry.findUnique({
    where: { id },
    select: { id: true, status: true, sourceType: true },
  });
  if (!existing || existing.sourceType !== "QC_RETURN") {
    throw new Error("Mill inward not found.");
  }
  if (existing.status === "completed") {
    throw new Error("This inward is already completed.");
  }
  const row = await prisma.millInwardEntry.update({
    where: { id },
    data: {
      remarks: input.remarks,
      sendNote: input.sendNote,
      ...(input.send
        ? { status: "completed", sentOn: asDate(todayIso()) }
        : {}),
    },
    include: includeEntry,
  });
  revalidatePath("/mill-inward");
  return toRecord(row);
}
