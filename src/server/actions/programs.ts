"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { requireMillWeaverLink } from "@/lib/parties";
import {
  getProgramCardData,
  programCardPublicUrl,
} from "@/server/domain/program-card";
import { sendWhatsApp } from "@/server/whatsapp";
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
  let millId = String(formData.get("millId") || "");
  let weaverId = String(formData.get("weaverId") || "") || null;
  const greyOrderId = String(formData.get("greyOrderId") || "") || null;
  const fabricTypeId = String(formData.get("fabricTypeId") || "");
  const shadeId = String(formData.get("shadeId") || "");
  const finishTypeId = String(formData.get("finishTypeId") || "") || null;
  const width = String(formData.get("width") || "").trim() || null;
  const gsm = String(formData.get("gsm") || "").trim() || null;
  const feelFallNotes = String(formData.get("feelFallNotes") || "").trim() || null;
  const extraMods = String(formData.get("extraMods") || "").trim() || null;
  let remarks = String(formData.get("remarks") || "").trim() || null;

  if (!fabricTypeId || !shadeId) {
    throw new Error("Fabric type and shade are required");
  }

  if (greyOrderId) {
    const grey = await prisma.greyPurchaseOrder.findUniqueOrThrow({
      where: { id: greyOrderId },
      select: {
        supplierId: true,
        millId: true,
        fabricNotes: true,
        supplier: { select: { type: true } },
        mill: { select: { type: true } },
      },
    });
    if (grey.supplier.type !== "WEAVER") {
      throw new Error("Grey purchase weaver is invalid");
    }
    weaverId = grey.supplierId;
    if (grey.millId) {
      if (grey.mill?.type !== "MILL") {
        throw new Error("Grey purchase mill is invalid");
      }
      millId = grey.millId;
    }
    if (!remarks && grey.fabricNotes) {
      remarks = grey.fabricNotes;
    }
  }

  if (!millId) {
    throw new Error("Mill is required");
  }

  const mill = await prisma.party.findUniqueOrThrow({ where: { id: millId } });
  if (mill.type !== "MILL") {
    throw new Error("Program mill must be a Mill party");
  }

  if (weaverId) {
    const weaver = await prisma.party.findUniqueOrThrow({
      where: { id: weaverId },
    });
    if (weaver.type !== "WEAVER") {
      throw new Error("Program weaver must be a Weaver");
    }
    await requireMillWeaverLink(millId, weaverId);
  }

  await prisma.millProgram.create({
    data: {
      programNo: await nextProgramNo(),
      millId,
      weaverId,
      greyOrderId,
      fabricTypeId,
      shadeId,
      finishTypeId,
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

  if (!program.mill.whatsapp) {
    throw new Error("Mill has no WhatsApp number — update party master");
  }

  const cardUrl = programCardPublicUrl(program.id);
  const shadeLabel = `${program.shade.colorFamily.name} / ${program.shade.name}`;
  const hex = program.shade.hex?.toUpperCase() ?? "see card";

  const body = [
    `${COMPANY.shortName} — Mill program card`,
    `Program: ${program.programNo}`,
    `Mill: ${program.mill.name}`,
    `Fabric: ${program.fabricType.name}`,
    `Colour: ${shadeLabel}`,
    `Colour hex: ${hex}`,
    `GSM: ${program.gsm ?? "-"}`,
    `Width: ${program.width ?? "-"}`,
    `Finish: ${program.finishType?.name ?? "-"}`,
    program.feelFallNotes ? `Feel / fall: ${program.feelFallNotes}` : null,
    program.extraMods ? `Extra process: ${program.extraMods}` : null,
    program.remarks ? `Remarks: ${program.remarks}` : null,
    "",
    `Open / print / PDF card: ${cardUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  await sendWhatsApp({
    to: program.mill.whatsapp,
    template: "mill_program",
    entityType: "MillProgram",
    entityId: program.id,
    variables: {
      programNo: program.programNo,
      fabric: program.fabricType.name,
      color: shadeLabel,
      hex,
      gsm: program.gsm ?? "-",
      width: program.width ?? "-",
      finish: program.finishType?.name ?? "-",
      remarks: program.remarks ?? "-",
      cardUrl,
      body,
    },
  });

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
