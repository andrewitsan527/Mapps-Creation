"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type ItemRecord = {
  id: string;
  itemName: string;
  quality: string;
  itemCategories: string;
  itemGroup: string;
  hsnCode: string;
  gstPercent: string;
  descriptionForGst: string;
  itemRatePer: string;
  openingPcs: string;
  openingMts: string;
  openingValue: string;
  ratePerPcs: string;
  ratePerMts: string;
  purchaseRatePerPcs: string;
  purchaseRatePerMts: string;
  itemFold: string;
  imagePath1: string;
  imagePath2: string;
  imagePath3: string;
  imagePath4: string;
  imagePath5: string;
  createdAt: string;
  updatedAt: string;
};

export type ItemInput = Omit<ItemRecord, "id" | "createdAt" | "updatedAt">;

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numericOk(raw: string) {
  if (!raw.trim()) return true;
  return Number.isFinite(Number(raw));
}

function decimalOrNull(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!numericOk(trimmed)) throw new Error(`${label} must be a number.`);
  return trimmed;
}

function assertInput(input: ItemInput) {
  if (!input.itemName.trim()) throw new Error("Enter item name.");
  const numericFields: [string, string][] = [
    ["GST Perc.", input.gstPercent],
    ["Opening Pcs", input.openingPcs],
    ["Opening Mts", input.openingMts],
    ["Opening Value", input.openingValue],
    ["Rate Per Pcs", input.ratePerPcs],
    ["Rate Per Mts", input.ratePerMts],
    ["Pur. Rate Per Pcs", input.purchaseRatePerPcs],
    ["Pur. Rate Per Mts", input.purchaseRatePerMts],
    ["Item Fold", input.itemFold],
  ];
  for (const [label, value] of numericFields) {
    if (!numericOk(value)) throw new Error(`${label} must be a number.`);
  }
}

function toData(input: ItemInput) {
  return {
    itemName: input.itemName.trim(),
    quality: textOrNull(input.quality),
    itemCategories: textOrNull(input.itemCategories),
    itemGroup: textOrNull(input.itemGroup),
    hsnCode: textOrNull(input.hsnCode),
    gstPercentage: decimalOrNull(input.gstPercent, "GST Perc."),
    descriptionForGst: textOrNull(input.descriptionForGst),
    itemRatePer: textOrNull(input.itemRatePer),
    openingPcs: decimalOrNull(input.openingPcs, "Opening Pcs"),
    openingMts: decimalOrNull(input.openingMts, "Opening Mts"),
    openingValue: decimalOrNull(input.openingValue, "Opening Value"),
    ratePerPcs: decimalOrNull(input.ratePerPcs, "Rate Per Pcs"),
    ratePerMts: decimalOrNull(input.ratePerMts, "Rate Per Mts"),
    purRatePerPcs: decimalOrNull(input.purchaseRatePerPcs, "Pur. Rate Per Pcs"),
    purRatePerMts: decimalOrNull(input.purchaseRatePerMts, "Pur. Rate Per Mts"),
    itemFold: textOrNull(input.itemFold),
    imagePath1: textOrNull(input.imagePath1),
    imagePath2: textOrNull(input.imagePath2),
    imagePath3: textOrNull(input.imagePath3),
    imagePath4: textOrNull(input.imagePath4),
    imagePath5: textOrNull(input.imagePath5),
  };
}

function dec(value: { toString(): string } | null | undefined) {
  return value == null ? "" : value.toString();
}

function toRecord(row: {
  id: string;
  itemName: string;
  quality: string | null;
  itemCategories: string | null;
  itemGroup: string | null;
  hsnCode: string | null;
  gstPercentage: { toString(): string } | null;
  descriptionForGst: string | null;
  itemRatePer: string | null;
  openingPcs: { toString(): string } | null;
  openingMts: { toString(): string } | null;
  openingValue: { toString(): string } | null;
  ratePerPcs: { toString(): string } | null;
  ratePerMts: { toString(): string } | null;
  purRatePerPcs: { toString(): string } | null;
  purRatePerMts: { toString(): string } | null;
  itemFold: string | null;
  imagePath1: string | null;
  imagePath2: string | null;
  imagePath3: string | null;
  imagePath4: string | null;
  imagePath5: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ItemRecord {
  return {
    id: row.id,
    itemName: row.itemName,
    quality: row.quality ?? "",
    itemCategories: row.itemCategories ?? "",
    itemGroup: row.itemGroup ?? "",
    hsnCode: row.hsnCode ?? "",
    gstPercent: dec(row.gstPercentage),
    descriptionForGst: row.descriptionForGst ?? "",
    itemRatePer: row.itemRatePer ?? "",
    openingPcs: dec(row.openingPcs),
    openingMts: dec(row.openingMts),
    openingValue: dec(row.openingValue),
    ratePerPcs: dec(row.ratePerPcs),
    ratePerMts: dec(row.ratePerMts),
    purchaseRatePerPcs: dec(row.purRatePerPcs),
    purchaseRatePerMts: dec(row.purRatePerMts),
    itemFold: row.itemFold ?? "",
    imagePath1: row.imagePath1 ?? "",
    imagePath2: row.imagePath2 ?? "",
    imagePath3: row.imagePath3 ?? "",
    imagePath4: row.imagePath4 ?? "",
    imagePath5: row.imagePath5 ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listItems(): Promise<ItemRecord[]> {
  await requireUser();
  const rows = await prisma.item.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createItem(input: ItemInput): Promise<ItemRecord> {
  await requireUser();
  assertInput(input);
  const row = await prisma.item.create({ data: toData(input) });
  revalidatePath("/masters/items");
  return toRecord(row);
}

export async function updateItem(id: string, input: ItemInput): Promise<ItemRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Item not found.");
  assertInput(input);
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new Error("Item not found.");
  const row = await prisma.item.update({
    where: { id },
    data: toData(input),
  });
  revalidatePath("/masters/items");
  return toRecord(row);
}
