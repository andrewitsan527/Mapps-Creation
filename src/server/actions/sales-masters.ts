"use server";

import { revalidatePath } from "next/cache";
import { CrDr } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type SalesMasterRecord = {
  id: string;
  accountName: string;
  salesAgentId: string;
  group: string;
  salesman: string;
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
  cityName2: string;
  address2: string;
  gstin: string;
  compositeNo: string;
  ecoSgstin: string;
  registrationDate: string;
  panNo: string;
  tanNo: string;
  kstNo: string;
  cstNo: string;
  gujaratState: string;
  tinNo: string;
  policyNo: string;
  creditLimit: string;
  creditDays: string;
  openingBalance: string;
  crDr: "" | "CR" | "DR";
  tds: string;
  payment: string;
  tcsApplicable: boolean;
  references: string;
  transName: string;
  discountPercentage: string;
  rdPcs: string;
  mts: string;
  excessRate: string;
  commissionPercentage: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  blackListed: boolean;
  masterType: "SALES";
  createdAt: string;
  updatedAt: string;
};

export type SalesMasterInput = Omit<
  SalesMasterRecord,
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
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
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

function parseCrDr(value: string): CrDr | null {
  if (!value) return null;
  if (value === CrDr.CR || value === CrDr.DR) return value;
  throw new Error("Select Cr. or Dr.");
}

function assertInput(input: SalesMasterInput) {
  if (!input.accountName.trim()) throw new Error("Enter account name.");
  if (!input.salesAgentId.trim()) throw new Error("Select a sales agent.");
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
  decimalOrNull(input.excessRate);
  decimalOrNull(input.commissionPercentage);
  parseRegistrationDate(input.registrationDate);
  parseCrDr(input.crDr);
}

async function requireSalesAgent(id: string) {
  const agent = await prisma.salesAgent.findUnique({ where: { id } });
  if (!agent) throw new Error("Select a sales agent.");
}

function toData(input: SalesMasterInput) {
  return {
    accountName: input.accountName.trim(),
    salesAgentId: input.salesAgentId,
    group: textOrNull(input.group),
    salesman: textOrNull(input.salesman),
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
    cityName2: textOrNull(input.cityName2),
    address2: textOrNull(input.address2),
    gstin: textOrNull(input.gstin),
    compositeNo: textOrNull(input.compositeNo),
    ecoSgstin: textOrNull(input.ecoSgstin),
    registrationDate: parseRegistrationDate(input.registrationDate),
    panNo: textOrNull(input.panNo),
    tanNo: textOrNull(input.tanNo),
    kstNo: textOrNull(input.kstNo),
    cstNo: textOrNull(input.cstNo),
    gujaratState: textOrNull(input.gujaratState),
    tinNo: textOrNull(input.tinNo),
    policyNo: textOrNull(input.policyNo),
    creditLimit: decimalOrNull(input.creditLimit),
    creditDays: creditDaysOrNull(input.creditDays),
    openingBalance: decimalOrNull(input.openingBalance),
    crDr: parseCrDr(input.crDr),
    tds: decimalOrNull(input.tds),
    payment: textOrNull(input.payment),
    tcsApplicable: Boolean(input.tcsApplicable),
    references: textOrNull(input.references),
    transName: textOrNull(input.transName),
    discountPercentage: decimalOrNull(input.discountPercentage),
    rdPcs: decimalOrNull(input.rdPcs),
    mts: decimalOrNull(input.mts),
    excessRate: decimalOrNull(input.excessRate),
    commissionPercentage: decimalOrNull(input.commissionPercentage),
    bankDetail: textOrNull(input.bankDetail),
    bankName: textOrNull(input.bankName),
    accountNo: textOrNull(input.accountNo),
    ifscCode: textOrNull(input.ifscCode),
    branch: textOrNull(input.branch),
    udyamRegistrationNumber: textOrNull(input.udyamNo),
    enterpriseType: textOrNull(input.enterpriseType),
    enterpriseActivity: textOrNull(input.enterpriseActivity),
    masterType: "SALES",
    blackListed: Boolean(input.blackListed),
  };
}

function dec(value: { toString(): string } | null | undefined) {
  return value == null ? "" : value.toString();
}

function toRecord(row: {
  id: string;
  accountName: string;
  salesAgentId: string;
  group: string | null;
  salesman: string | null;
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
  cityName2: string | null;
  address2: string | null;
  gstin: string | null;
  compositeNo: string | null;
  ecoSgstin: string | null;
  registrationDate: Date | null;
  panNo: string | null;
  tanNo: string | null;
  kstNo: string | null;
  cstNo: string | null;
  gujaratState: string | null;
  tinNo: string | null;
  policyNo: string | null;
  creditLimit: { toString(): string } | null;
  creditDays: number | null;
  openingBalance: { toString(): string } | null;
  crDr: CrDr | null;
  tds: { toString(): string } | null;
  payment: string | null;
  tcsApplicable: boolean | null;
  references: string | null;
  transName: string | null;
  discountPercentage: { toString(): string } | null;
  rdPcs: { toString(): string } | null;
  mts: { toString(): string } | null;
  excessRate: { toString(): string } | null;
  commissionPercentage: { toString(): string } | null;
  bankDetail: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  branch: string | null;
  udyamRegistrationNumber: string | null;
  enterpriseType: string | null;
  enterpriseActivity: string | null;
  blackListed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SalesMasterRecord {
  return {
    id: row.id,
    accountName: row.accountName,
    salesAgentId: row.salesAgentId,
    group: row.group ?? "",
    salesman: row.salesman ?? "",
    receiverName: row.receiverName ?? "",
    cityName: row.cityName ?? "",
    distance: dec(row.distance),
    manager: row.manager ?? "",
    address: row.address ?? "",
    phone: row.phoneNo ?? "",
    mobile: row.mobileNo ?? "",
    fax: row.faxNo ?? "",
    email: row.emailId ?? "",
    residentNo: row.residentNo ?? "",
    cityName2: row.cityName2 ?? "",
    address2: row.address2 ?? "",
    gstin: row.gstin ?? "",
    compositeNo: row.compositeNo ?? "",
    ecoSgstin: row.ecoSgstin ?? "",
    registrationDate: row.registrationDate
      ? row.registrationDate.toISOString().slice(0, 10)
      : "",
    panNo: row.panNo ?? "",
    tanNo: row.tanNo ?? "",
    kstNo: row.kstNo ?? "",
    cstNo: row.cstNo ?? "",
    gujaratState: row.gujaratState ?? "",
    tinNo: row.tinNo ?? "",
    policyNo: row.policyNo ?? "",
    creditLimit: dec(row.creditLimit),
    creditDays: row.creditDays == null ? "" : String(row.creditDays),
    openingBalance: dec(row.openingBalance),
    crDr: row.crDr ?? "",
    tds: dec(row.tds),
    payment: row.payment ?? "",
    tcsApplicable: row.tcsApplicable ?? false,
    references: row.references ?? "",
    transName: row.transName ?? "",
    discountPercentage: dec(row.discountPercentage),
    rdPcs: dec(row.rdPcs),
    mts: dec(row.mts),
    excessRate: dec(row.excessRate),
    commissionPercentage: dec(row.commissionPercentage),
    bankDetail: row.bankDetail ?? "",
    bankName: row.bankName ?? "",
    accountNo: row.accountNo ?? "",
    ifscCode: row.ifscCode ?? "",
    branch: row.branch ?? "",
    udyamNo: row.udyamRegistrationNumber ?? "",
    enterpriseType: row.enterpriseType ?? "",
    enterpriseActivity: row.enterpriseActivity ?? "",
    blackListed: row.blackListed,
    masterType: "SALES",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSalesMasters(): Promise<SalesMasterRecord[]> {
  await requireUser();
  const rows = await prisma.salesMaster.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createSalesMaster(
  input: SalesMasterInput,
): Promise<SalesMasterRecord> {
  await requireUser();
  assertInput(input);
  await requireSalesAgent(input.salesAgentId);
  const row = await prisma.salesMaster.create({ data: toData(input) });
  revalidatePath("/masters/sales");
  return toRecord(row);
}

export async function updateSalesMaster(
  id: string,
  input: SalesMasterInput,
): Promise<SalesMasterRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Sales master not found.");
  assertInput(input);
  await requireSalesAgent(input.salesAgentId);
  const existing = await prisma.salesMaster.findUnique({ where: { id } });
  if (!existing) throw new Error("Sales master not found.");
  const row = await prisma.salesMaster.update({
    where: { id },
    data: toData(input),
  });
  revalidatePath("/masters/sales");
  return toRecord(row);
}
