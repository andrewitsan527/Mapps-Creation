"use server";

import { revalidatePath } from "next/cache";
import { CrDr } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type KnitterRecord = {
  id: string;
  knitterName: string;
  accountType: string;
  group: string;
  agent: string;
  gstin: string;
  compositeNo: string;
  ecoSgstin: string;
  registrationDate: string;
  receiverName: string;
  address: string;
  cityName: string;
  distance: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  address2: string;
  cityName2: string;
  manager: string;
  creditLimit: string;
  creditDays: string;
  references: string;
  openingBalance: string;
  crDr: "" | "CR" | "DR";
  tds: string;
  panNo: string;
  tanNo: string;
  kstNo: string;
  cstNo: string;
  gujaratState: string;
  tinNo: string;
  transName: string;
  discountPercentage: string;
  rdPcs: string;
  mts: string;
  commissionPercentage: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  tcsApplicable: boolean;
  payment: string;
  blackListed: boolean;
  masterType: "KNITTER";
  createdAt: string;
  updatedAt: string;
};

export type KnitterInput = Omit<
  KnitterRecord,
  "id" | "masterType" | "createdAt" | "updatedAt"
>;

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
  if (!Number.isFinite(Number(trimmed))) {
    throw new Error("Numeric fields must contain valid numbers.");
  }
  return trimmed;
}

function creditDaysOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error("Numeric fields must contain valid numbers.");
  }
  return n;
}

function parseDate(value: string) {
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

function parseCrDr(value: string): CrDr | null {
  if (!value) return null;
  if (value === CrDr.CR || value === CrDr.DR) return value;
  throw new Error("Select Cr. or Dr.");
}

function assertInput(input: KnitterInput) {
  if (!input.knitterName.trim()) throw new Error("Enter knitter name.");
  if (input.email.trim() && !emailLooksValid(input.email)) {
    throw new Error("Enter a valid email ID.");
  }
  decimalOrNull(input.distance);
  decimalOrNull(input.creditLimit);
  creditDaysOrNull(input.creditDays);
  decimalOrNull(input.openingBalance);
  decimalOrNull(input.tds);
  decimalOrNull(input.discountPercentage);
  decimalOrNull(input.rdPcs);
  decimalOrNull(input.mts);
  decimalOrNull(input.commissionPercentage);
  parseDate(input.registrationDate);
  parseCrDr(input.crDr);
}

function toData(input: KnitterInput) {
  return {
    knitterName: input.knitterName.trim(),
    accountType: textOrNull(input.accountType),
    group: textOrNull(input.group),
    agent: textOrNull(input.agent),
    gstin: textOrNull(input.gstin),
    compositeNo: textOrNull(input.compositeNo),
    ecoSgstin: textOrNull(input.ecoSgstin),
    registrationDate: parseDate(input.registrationDate),
    receiverName: textOrNull(input.receiverName),
    address: textOrNull(input.address),
    cityName: textOrNull(input.cityName),
    distance: decimalOrNull(input.distance),
    phoneNo: textOrNull(input.phone),
    mobileNo: textOrNull(input.mobile),
    faxNo: textOrNull(input.fax),
    emailId: textOrNull(input.email),
    residentNo: textOrNull(input.residentNo),
    address2: textOrNull(input.address2),
    cityName2: textOrNull(input.cityName2),
    manager: textOrNull(input.manager),
    creditLimit: decimalOrNull(input.creditLimit),
    creditDays: creditDaysOrNull(input.creditDays),
    references: textOrNull(input.references),
    openingBalance: decimalOrNull(input.openingBalance),
    crDr: parseCrDr(input.crDr),
    tds: decimalOrNull(input.tds),
    panNo: textOrNull(input.panNo),
    tanNo: textOrNull(input.tanNo),
    kstNo: textOrNull(input.kstNo),
    cstNo: textOrNull(input.cstNo),
    gujaratState: textOrNull(input.gujaratState),
    tinNo: textOrNull(input.tinNo),
    transName: textOrNull(input.transName),
    discPercentage: decimalOrNull(input.discountPercentage),
    rdPcs: decimalOrNull(input.rdPcs),
    mts: decimalOrNull(input.mts),
    commPercentage: decimalOrNull(input.commissionPercentage),
    bankDetail: textOrNull(input.bankDetail),
    bankName: textOrNull(input.bankName),
    accountNo: textOrNull(input.accountNo),
    ifscCode: textOrNull(input.ifscCode),
    branch: textOrNull(input.branch),
    udyamRegNumber: textOrNull(input.udyamNo),
    enterpriseType: textOrNull(input.enterpriseType),
    enterpriseActivity: textOrNull(input.enterpriseActivity),
    tcsApplicable: Boolean(input.tcsApplicable),
    payment: textOrNull(input.payment),
    blackListed: Boolean(input.blackListed),
    masterType: "KNITTER",
  };
}

function dec(value: { toString(): string } | null | undefined) {
  return value == null ? "" : value.toString();
}

function toRecord(row: {
  id: string;
  knitterName: string;
  accountType: string | null;
  group: string | null;
  agent: string | null;
  gstin: string | null;
  compositeNo: string | null;
  ecoSgstin: string | null;
  registrationDate: Date | null;
  receiverName: string | null;
  address: string | null;
  cityName: string | null;
  distance: { toString(): string } | null;
  phoneNo: string | null;
  mobileNo: string | null;
  faxNo: string | null;
  emailId: string | null;
  residentNo: string | null;
  address2: string | null;
  cityName2: string | null;
  manager: string | null;
  creditLimit: { toString(): string } | null;
  creditDays: number | null;
  references: string | null;
  openingBalance: { toString(): string } | null;
  crDr: CrDr | null;
  tds: { toString(): string } | null;
  panNo: string | null;
  tanNo: string | null;
  kstNo: string | null;
  cstNo: string | null;
  gujaratState: string | null;
  tinNo: string | null;
  transName: string | null;
  discPercentage: { toString(): string } | null;
  rdPcs: { toString(): string } | null;
  mts: { toString(): string } | null;
  commPercentage: { toString(): string } | null;
  bankDetail: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  branch: string | null;
  udyamRegNumber: string | null;
  enterpriseType: string | null;
  enterpriseActivity: string | null;
  tcsApplicable: boolean | null;
  payment: string | null;
  blackListed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): KnitterRecord {
  return {
    id: row.id,
    knitterName: row.knitterName,
    accountType: row.accountType ?? "",
    group: row.group ?? "",
    agent: row.agent ?? "",
    gstin: row.gstin ?? "",
    compositeNo: row.compositeNo ?? "",
    ecoSgstin: row.ecoSgstin ?? "",
    registrationDate: row.registrationDate
      ? row.registrationDate.toISOString().slice(0, 10)
      : "",
    receiverName: row.receiverName ?? "",
    address: row.address ?? "",
    cityName: row.cityName ?? "",
    distance: dec(row.distance),
    phone: row.phoneNo ?? "",
    mobile: row.mobileNo ?? "",
    fax: row.faxNo ?? "",
    email: row.emailId ?? "",
    residentNo: row.residentNo ?? "",
    address2: row.address2 ?? "",
    cityName2: row.cityName2 ?? "",
    manager: row.manager ?? "",
    creditLimit: dec(row.creditLimit),
    creditDays: row.creditDays == null ? "" : String(row.creditDays),
    references: row.references ?? "",
    openingBalance: dec(row.openingBalance),
    crDr: row.crDr ?? "",
    tds: dec(row.tds),
    panNo: row.panNo ?? "",
    tanNo: row.tanNo ?? "",
    kstNo: row.kstNo ?? "",
    cstNo: row.cstNo ?? "",
    gujaratState: row.gujaratState ?? "",
    tinNo: row.tinNo ?? "",
    transName: row.transName ?? "",
    discountPercentage: dec(row.discPercentage),
    rdPcs: dec(row.rdPcs),
    mts: dec(row.mts),
    commissionPercentage: dec(row.commPercentage),
    bankDetail: row.bankDetail ?? "",
    bankName: row.bankName ?? "",
    accountNo: row.accountNo ?? "",
    ifscCode: row.ifscCode ?? "",
    branch: row.branch ?? "",
    udyamNo: row.udyamRegNumber ?? "",
    enterpriseType: row.enterpriseType ?? "",
    enterpriseActivity: row.enterpriseActivity ?? "",
    tcsApplicable: row.tcsApplicable ?? false,
    payment: row.payment ?? "",
    blackListed: row.blackListed,
    masterType: "KNITTER",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listKnitters(): Promise<KnitterRecord[]> {
  await requireUser();
  const rows = await prisma.knitter.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createKnitter(input: KnitterInput): Promise<KnitterRecord> {
  await requireUser();
  assertInput(input);
  const row = await prisma.knitter.create({ data: toData(input) });
  revalidatePath("/masters/knitters");
  return toRecord(row);
}

export async function updateKnitter(
  id: string,
  input: KnitterInput,
): Promise<KnitterRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Knitter not found.");
  assertInput(input);
  const existing = await prisma.knitter.findUnique({ where: { id } });
  if (!existing) throw new Error("Knitter not found.");
  const row = await prisma.knitter.update({
    where: { id },
    data: toData(input),
  });
  revalidatePath("/masters/knitters");
  return toRecord(row);
}
