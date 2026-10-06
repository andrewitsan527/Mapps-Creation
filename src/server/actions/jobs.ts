"use server";

import { revalidatePath } from "next/cache";
import { CrDr } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type JobRecord = {
  id: string;
  accountName: string;
  accountType: string;
  group: string;
  agent: string;
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
  creditDebit: string;
  tds: string;
  tdsAccount: string;
  tdsLimit: string;
  dob: string;
  references: string;
  transName: string;
  discountPercent: string;
  rdPcs: string;
  mts: string;
  commissionPercent: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamRegNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  jobType: string;
  blackListed: boolean;
  masterType: "JOB";
  createdAt: string;
  updatedAt: string;
};

export type JobInput = Omit<JobRecord, "id" | "masterType" | "createdAt" | "updatedAt">;

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
    throw new Error("Enter a valid date.");
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}

function parseCrDr(value: string): CrDr | null {
  if (!value) return null;
  if (value === CrDr.CR || value === CrDr.DR) return value;
  throw new Error("Select Cr. or Dr.");
}

function assertInput(input: JobInput) {
  if (!input.accountName.trim()) throw new Error("Enter account name.");
  if (input.email.trim() && !emailLooksValid(input.email)) {
    throw new Error("Enter a valid email ID.");
  }
  decimalOrNull(input.distance);
  decimalOrNull(input.creditLimit);
  creditDaysOrNull(input.creditDays);
  decimalOrNull(input.openingBalance);
  decimalOrNull(input.tds);
  decimalOrNull(input.tdsLimit);
  decimalOrNull(input.discountPercent);
  decimalOrNull(input.rdPcs);
  decimalOrNull(input.mts);
  decimalOrNull(input.commissionPercent);
  parseDate(input.registrationDate);
  parseDate(input.dob);
  parseCrDr(input.creditDebit);
}

function toData(input: JobInput) {
  return {
    accountName: input.accountName.trim(),
    accountType: textOrNull(input.accountType),
    group: textOrNull(input.group),
    agent: textOrNull(input.agent),
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
    registrationDate: parseDate(input.registrationDate),
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
    crDr: parseCrDr(input.creditDebit),
    tds: decimalOrNull(input.tds),
    tdsAccount: textOrNull(input.tdsAccount),
    tdsLimit: decimalOrNull(input.tdsLimit),
    dob: parseDate(input.dob),
    references: textOrNull(input.references),
    transName: textOrNull(input.transName),
    discountPercentage: decimalOrNull(input.discountPercent),
    rdPcs: decimalOrNull(input.rdPcs),
    mts: decimalOrNull(input.mts),
    commissionPercentage: decimalOrNull(input.commissionPercent),
    bankDetail: textOrNull(input.bankDetail),
    bankName: textOrNull(input.bankName),
    accountNo: textOrNull(input.accountNo),
    ifscCode: textOrNull(input.ifscCode),
    branch: textOrNull(input.branch),
    udyamRegistrationNumber: textOrNull(input.udyamRegNo),
    enterpriseType: textOrNull(input.enterpriseType),
    enterpriseActivity: textOrNull(input.enterpriseActivity),
    jobType: textOrNull(input.jobType),
    blackListed: Boolean(input.blackListed),
    masterType: "JOB",
  };
}

function dec(value: { toString(): string } | null | undefined) {
  return value == null ? "" : value.toString();
}

function dateText(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function toRecord(row: {
  id: string;
  accountName: string;
  accountType: string | null;
  group: string | null;
  agent: string | null;
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
  tdsAccount: string | null;
  tdsLimit: { toString(): string } | null;
  dob: Date | null;
  references: string | null;
  transName: string | null;
  discountPercentage: { toString(): string } | null;
  rdPcs: { toString(): string } | null;
  mts: { toString(): string } | null;
  commissionPercentage: { toString(): string } | null;
  bankDetail: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  branch: string | null;
  udyamRegistrationNumber: string | null;
  enterpriseType: string | null;
  enterpriseActivity: string | null;
  jobType: string | null;
  blackListed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): JobRecord {
  return {
    id: row.id,
    accountName: row.accountName,
    accountType: row.accountType ?? "",
    group: row.group ?? "",
    agent: row.agent ?? "",
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
    registrationDate: dateText(row.registrationDate),
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
    creditDebit: row.crDr ?? "",
    tds: dec(row.tds),
    tdsAccount: row.tdsAccount ?? "",
    tdsLimit: dec(row.tdsLimit),
    dob: dateText(row.dob),
    references: row.references ?? "",
    transName: row.transName ?? "",
    discountPercent: dec(row.discountPercentage),
    rdPcs: dec(row.rdPcs),
    mts: dec(row.mts),
    commissionPercent: dec(row.commissionPercentage),
    bankDetail: row.bankDetail ?? "",
    bankName: row.bankName ?? "",
    accountNo: row.accountNo ?? "",
    ifscCode: row.ifscCode ?? "",
    branch: row.branch ?? "",
    udyamRegNo: row.udyamRegistrationNumber ?? "",
    enterpriseType: row.enterpriseType ?? "",
    enterpriseActivity: row.enterpriseActivity ?? "",
    jobType: row.jobType ?? "",
    blackListed: row.blackListed,
    masterType: "JOB",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listJobs(): Promise<JobRecord[]> {
  await requireUser();
  const rows = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toRecord);
}

export async function createJob(input: JobInput): Promise<JobRecord> {
  await requireUser();
  assertInput(input);
  const row = await prisma.job.create({ data: toData(input) });
  revalidatePath("/masters/jobs");
  return toRecord(row);
}

export async function updateJob(id: string, input: JobInput): Promise<JobRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Job not found.");
  assertInput(input);
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) throw new Error("Job not found.");
  const row = await prisma.job.update({ where: { id }, data: toData(input) });
  revalidatePath("/masters/jobs");
  return toRecord(row);
}
