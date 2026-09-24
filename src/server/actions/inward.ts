"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { programQtySummary } from "@/server/domain/mill-inward";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function nextInwardNo() {
  const count = await prisma.millInward.count();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INW-${stamp}-${String(count + 1).padStart(3, "0")}`;
}

export async function createMillInward(formData: FormData) {
  await requireUser();
  const programId = String(formData.get("programId") || "");
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const dateRaw = String(formData.get("inwardDate") || "").trim();

  if (!programId) throw new Error("Program required");

  const quantity = Number(quantityRaw);
  if (!quantityRaw || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Inward quantity must be greater than 0");
  }

  const program = await prisma.millProgram.findUniqueOrThrow({
    where: { id: programId },
    select: {
      id: true,
      status: true,
      greyOrder: { select: { quantity: true, unit: true } },
      inwards: { select: { quantity: true } },
    },
  });

  if (program.status === "CLOSED" || program.status === "CANCELLED") {
    throw new Error("Cannot inward a closed or cancelled program");
  }
  if (program.status === "DRAFT") {
    throw new Error("Send the program to the mill before inward");
  }

  const summary = programQtySummary(program);
  if (summary.remaining != null && quantity > summary.remaining + 1e-9) {
    throw new Error(
      `Quantity exceeds remaining (${summary.remaining} ${summary.unit})`,
    );
  }

  await prisma.millInward.create({
    data: {
      inwardNo: await nextInwardNo(),
      programId,
      inwardDate: dateRaw ? new Date(dateRaw) : new Date(),
      quantity: String(quantity),
      unit: summary.unit,
      remarks,
    },
  });

  if (program.status === "SENT_TO_MILL") {
    await prisma.millProgram.update({
      where: { id: programId },
      data: { status: "IN_PROCESS" },
    });
  }

  revalidatePath("/qc");
  revalidatePath("/programs");
  revalidatePath("/inward");
}
