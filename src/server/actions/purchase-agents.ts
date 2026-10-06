"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type PurchaseAgentRecord = {
  id: string;
  agentName: string;
  accountType: string;
  contactPerson: string;
  mobileNo: string;
  phoneNo: string;
  emailId: string;
  address: string;
  city: string;
  residentNo: string;
  faxNo: string;
  panNo: string;
  gstin: string;
  compositeNo: string;
  registrationDate: string;
  masterType: "PURCHASE_AGENT";
  blackListed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseAgentInput = Omit<
  PurchaseAgentRecord,
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

function phoneLooksValid(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function emailLooksValid(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
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

function assertInput(input: PurchaseAgentInput) {
  if (!input.agentName.trim()) throw new Error("Enter agent name.");
  if (!input.accountType.trim()) throw new Error("Select account type.");
  if (input.mobileNo.trim() && !phoneLooksValid(input.mobileNo)) {
    throw new Error("Enter a valid mobile number.");
  }
  if (input.phoneNo.trim() && !phoneLooksValid(input.phoneNo)) {
    throw new Error("Enter a valid phone number.");
  }
  if (input.emailId.trim() && !emailLooksValid(input.emailId)) {
    throw new Error("Enter a valid email ID.");
  }
  parseRegistrationDate(input.registrationDate);
}

function toData(input: PurchaseAgentInput) {
  return {
    agentName: input.agentName.trim(),
    accountType: textOrNull(input.accountType),
    contactPerson: textOrNull(input.contactPerson),
    mobileNo: textOrNull(input.mobileNo),
    phoneNo: textOrNull(input.phoneNo),
    emailId: textOrNull(input.emailId),
    address: textOrNull(input.address),
    city: textOrNull(input.city),
    residentNo: textOrNull(input.residentNo),
    faxNo: textOrNull(input.faxNo),
    panNo: textOrNull(input.panNo),
    gstin: textOrNull(input.gstin),
    compositeNo: textOrNull(input.compositeNo),
    registrationDate: parseRegistrationDate(input.registrationDate),
    masterType: "PURCHASE_AGENT",
    blackListed: Boolean(input.blackListed),
  };
}

function toRecord(row: {
  id: string;
  agentName: string;
  accountType: string | null;
  contactPerson: string | null;
  mobileNo: string | null;
  phoneNo: string | null;
  emailId: string | null;
  address: string | null;
  city: string | null;
  residentNo: string | null;
  faxNo: string | null;
  panNo: string | null;
  gstin: string | null;
  compositeNo: string | null;
  registrationDate: Date | null;
  blackListed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PurchaseAgentRecord {
  return {
    id: row.id,
    agentName: row.agentName,
    accountType: row.accountType ?? "",
    contactPerson: row.contactPerson ?? "",
    mobileNo: row.mobileNo ?? "",
    phoneNo: row.phoneNo ?? "",
    emailId: row.emailId ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    residentNo: row.residentNo ?? "",
    faxNo: row.faxNo ?? "",
    panNo: row.panNo ?? "",
    gstin: row.gstin ?? "",
    compositeNo: row.compositeNo ?? "",
    registrationDate: row.registrationDate
      ? row.registrationDate.toISOString().slice(0, 10)
      : "",
    masterType: "PURCHASE_AGENT",
    blackListed: row.blackListed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPurchaseAgents(): Promise<PurchaseAgentRecord[]> {
  await requireUser();
  const rows = await prisma.purchaseAgent.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createPurchaseAgent(
  input: PurchaseAgentInput,
): Promise<PurchaseAgentRecord> {
  await requireUser();
  assertInput(input);
  const row = await prisma.purchaseAgent.create({ data: toData(input) });
  revalidatePath("/masters/purchase-agents");
  return toRecord(row);
}

export async function updatePurchaseAgent(
  id: string,
  input: PurchaseAgentInput,
): Promise<PurchaseAgentRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Purchase agent not found.");
  assertInput(input);
  const existing = await prisma.purchaseAgent.findUnique({ where: { id } });
  if (!existing) throw new Error("Purchase agent not found.");
  const row = await prisma.purchaseAgent.update({
    where: { id },
    data: toData(input),
  });
  revalidatePath("/masters/purchase-agents");
  return toRecord(row);
}
