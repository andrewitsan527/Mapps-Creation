"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type HasteRecord = {
  id: string;
  hasteName: string;
  receiverName: string;
  cityName: string;
  distance: string;
  manager: string;
  address: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  kstNo: string;
  gujaratState: string;
  cstNo: string;
  transport: string;
  tinNo: string;
  policyNo: string;
  panNo: string;
  gstin: string;
  compositeNo: string;
  registrationDate: string;
  createdAt: string;
  updatedAt: string;
};

export type HasteInput = Omit<HasteRecord, "id" | "createdAt" | "updatedAt">;

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emailLooksValid(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function decimalOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw new Error("Distance must be a valid number.");
  }
  return trimmed;
}

function parseRegistrationDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Enter a valid registration date.");
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid registration date.");
  }
  return date;
}

function assertInput(input: HasteInput) {
  if (!input.hasteName.trim()) throw new Error("Enter haste name.");
  if (input.email.trim() && !emailLooksValid(input.email)) {
    throw new Error("Enter a valid email ID.");
  }
  decimalOrNull(input.distance);
  parseRegistrationDate(input.registrationDate);
}

function toData(input: HasteInput) {
  return {
    hasteName: input.hasteName.trim(),
    receiverName: textOrNull(input.receiverName),
    cityName: textOrNull(input.cityName),
    distance: decimalOrNull(input.distance),
    manager: textOrNull(input.manager),
    address: textOrNull(input.address),
    phoneNo: textOrNull(input.phone),
    mobileNo: textOrNull(input.mobile),
    faxNo: textOrNull(input.fax),
    emailId: textOrNull(input.email),
    residentNo: textOrNull(input.residentNo),
    kstNo: textOrNull(input.kstNo),
    gujaratState: textOrNull(input.gujaratState),
    cstNo: textOrNull(input.cstNo),
    transport: textOrNull(input.transport),
    tinNo: textOrNull(input.tinNo),
    policyNo: textOrNull(input.policyNo),
    panNo: textOrNull(input.panNo),
    gstin: textOrNull(input.gstin),
    compositeNo: textOrNull(input.compositeNo),
    registrationDate: parseRegistrationDate(input.registrationDate),
  };
}

function toRecord(row: {
  id: string;
  hasteName: string;
  receiverName: string | null;
  cityName: string | null;
  distance: { toString(): string } | null;
  manager: string | null;
  address: string | null;
  phoneNo: string | null;
  mobileNo: string | null;
  faxNo: string | null;
  emailId: string | null;
  residentNo: string | null;
  kstNo: string | null;
  gujaratState: string | null;
  cstNo: string | null;
  transport: string | null;
  tinNo: string | null;
  policyNo: string | null;
  panNo: string | null;
  gstin: string | null;
  compositeNo: string | null;
  registrationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): HasteRecord {
  return {
    id: row.id,
    hasteName: row.hasteName,
    receiverName: row.receiverName ?? "",
    cityName: row.cityName ?? "",
    distance: row.distance == null ? "" : row.distance.toString(),
    manager: row.manager ?? "",
    address: row.address ?? "",
    phone: row.phoneNo ?? "",
    mobile: row.mobileNo ?? "",
    fax: row.faxNo ?? "",
    email: row.emailId ?? "",
    residentNo: row.residentNo ?? "",
    kstNo: row.kstNo ?? "",
    gujaratState: row.gujaratState ?? "",
    cstNo: row.cstNo ?? "",
    transport: row.transport ?? "",
    tinNo: row.tinNo ?? "",
    policyNo: row.policyNo ?? "",
    panNo: row.panNo ?? "",
    gstin: row.gstin ?? "",
    compositeNo: row.compositeNo ?? "",
    registrationDate: row.registrationDate
      ? row.registrationDate.toISOString().slice(0, 10)
      : "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listHastes(): Promise<HasteRecord[]> {
  await requireUser();
  const rows = await prisma.haste.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createHaste(input: HasteInput): Promise<HasteRecord> {
  await requireUser();
  assertInput(input);
  const row = await prisma.haste.create({ data: toData(input) });
  revalidatePath("/masters/hastes");
  return toRecord(row);
}

export async function updateHaste(id: string, input: HasteInput): Promise<HasteRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Haste not found.");
  assertInput(input);
  const existing = await prisma.haste.findUnique({ where: { id } });
  if (!existing) throw new Error("Haste not found.");
  const row = await prisma.haste.update({
    where: { id },
    data: toData(input),
  });
  revalidatePath("/masters/hastes");
  return toRecord(row);
}
