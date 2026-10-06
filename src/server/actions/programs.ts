"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProgramCardData } from "@/server/domain/program-card";
import {
  countPendingInwardQc,
  programQtySummary,
} from "@/server/domain/mill-inward";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function nextProgramNo() {
  const count = await prisma.millProgram.count();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `PROG-${stamp}-${String(count + 1).padStart(3, "0")}`;
}

export async function createProgram(formData: FormData) {
  await requireUser();
  const greyOrderId = String(formData.get("greyOrderId") || "") || null;
  const width = String(formData.get("width") || "").trim() || null;
  const gsm = String(formData.get("gsm") || "").trim() || null;
  const feelFallNotes = String(formData.get("feelFallNotes") || "").trim() || null;
  const extraMods = String(formData.get("extraMods") || "").trim() || null;
  let remarks = String(formData.get("remarks") || "").trim() || null;

  if (greyOrderId) {
    const grey = await prisma.greyPurchaseOrder.findUniqueOrThrow({
      where: { id: greyOrderId },
      select: { fabricNotes: true },
    });
    if (!remarks && grey.fabricNotes) {
      remarks = grey.fabricNotes;
    }
  }

  await prisma.millProgram.create({
    data: {
      programNo: await nextProgramNo(),
      greyOrderId,
      width,
      gsm,
      feelFallNotes,
      extraMods,
      remarks,
      status: "DRAFT",
    },
  });

  revalidatePath("/programs");
}

export async function sendProgramWhatsApp(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const program = await getProgramCardData(id);
  if (!program) throw new Error("Program not found");

  await prisma.millProgram.update({
    where: { id },
    data: { status: "SENT_TO_MILL", sentAt: new Date() },
  });

  revalidatePath("/programs");
  revalidatePath(`/programs/${id}/card`);
}

export async function completeMillReturn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Program required");

  const program = await prisma.millProgram.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      status: true,
      greyOrder: { select: { quantity: true, unit: true } },
      inwards: { select: { quantity: true } },
    },
  });

  if (program.status === "CLOSED" || program.status === "CANCELLED") {
    throw new Error("Program is already closed");
  }
  if (program.status === "DRAFT") {
    throw new Error("Send the program to the mill before completing mill return");
  }

  const summary = programQtySummary(program);
  if (summary.planned == null) {
    throw new Error("Program has no planned quantity");
  }

  const pendingQc = await countPendingInwardQc(prisma, id);
  if (pendingQc > 0) {
    throw new Error(
      `Cannot complete mill return: ${pendingQc} inward(s) are still pending QC.`,
    );
  }

  const difference = summary.planned - summary.received;
  if (difference < -1e-9) {
    throw new Error("Received quantity exceeds planned quantity");
  }

  await prisma.millProgram.update({
    where: { id },
    data: {
      status: "CLOSED",
      returnCompletedAt: new Date(),
      shortageQty: String(Math.max(0, difference)),
    },
  });

  revalidatePath("/programs");
  revalidatePath("/qc");
  revalidatePath("/inward");
}
