"use server";

import { revalidatePath } from "next/cache";
import { CommissionBasis, NoteType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { calcCommission, calcTds } from "@/server/domain/finance";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function nextNoteNo(type: NoteType) {
  const count = await prisma.accountNote.count({ where: { type } });
  const prefix = type === "DEBIT" ? "DN" : "CN";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${stamp}-${String(count + 1).padStart(3, "0")}`;
}

export async function createAccountNote(formData: FormData) {
  await requireUser();
  const type = String(formData.get("type") || "DEBIT") as NoteType;
  const saleBillId = String(formData.get("saleBillId") || "") || null;
  const amount = String(formData.get("amount") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;
  const tdsPct = String(formData.get("tdsPct") || "0").trim() || "0";

  if (!amount) throw new Error("Amount required");
  if (type !== "DEBIT" && type !== "CREDIT") throw new Error("Invalid note type");

  const { tdsAmount } = calcTds({ amount, tdsPct });

  await prisma.accountNote.create({
    data: {
      noteNo: await nextNoteNo(type),
      type,
      saleBillId,
      amount,
      reason,
      tdsPct,
      tdsAmount,
    },
  });

  revalidatePath("/finance");
  revalidatePath("/payments");
}

export async function createCommission(formData: FormData) {
  await requireUser();
  const basis = String(formData.get("basis") || "PARTY") as CommissionBasis;
  const saleBillId = String(formData.get("saleBillId") || "") || null;
  const ratePct = String(formData.get("ratePct") || "0").trim() || "0";
  const baseAmount = String(formData.get("baseAmount") || "0").trim() || "0";
  const notes = String(formData.get("notes") || "").trim() || null;

  const amount = calcCommission({ baseAmount, ratePct });

  await prisma.commissionEntry.create({
    data: {
      basis,
      saleBillId,
      ratePct,
      amount,
      notes,
    },
  });

  revalidatePath("/finance");
}

