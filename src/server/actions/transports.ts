"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type TransportRecord = {
  id: string;
  transportName: string;
  phone: string;
  email: string;
  transIdGstin: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export type TransportInput = Omit<TransportRecord, "id" | "createdAt" | "updatedAt">;

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

function assertInput(input: TransportInput) {
  if (!input.transportName.trim()) throw new Error("Enter transport name.");
  if (input.email.trim() && !emailLooksValid(input.email)) {
    throw new Error("Enter a valid email ID.");
  }
}

function toData(input: TransportInput) {
  return {
    transportName: input.transportName.trim(),
    phoneNo: textOrNull(input.phone),
    emailId: textOrNull(input.email),
    transIdGstin: textOrNull(input.transIdGstin),
    address: textOrNull(input.address),
  };
}

function toRecord(row: {
  id: string;
  transportName: string;
  phoneNo: string | null;
  emailId: string | null;
  transIdGstin: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TransportRecord {
  return {
    id: row.id,
    transportName: row.transportName,
    phone: row.phoneNo ?? "",
    email: row.emailId ?? "",
    transIdGstin: row.transIdGstin ?? "",
    address: row.address ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTransports(): Promise<TransportRecord[]> {
  await requireUser();
  const rows = await prisma.transport.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function createTransport(input: TransportInput): Promise<TransportRecord> {
  await requireUser();
  assertInput(input);
  const row = await prisma.transport.create({ data: toData(input) });
  revalidatePath("/masters/transport");
  return toRecord(row);
}

export async function updateTransport(
  id: string,
  input: TransportInput,
): Promise<TransportRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Transport not found.");
  assertInput(input);
  const existing = await prisma.transport.findUnique({ where: { id } });
  if (!existing) throw new Error("Transport not found.");
  const row = await prisma.transport.update({
    where: { id },
    data: toData(input),
  });
  revalidatePath("/masters/transport");
  return toRecord(row);
}
