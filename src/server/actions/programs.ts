"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendWhatsApp } from "@/server/whatsapp";

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
  const millId = String(formData.get("millId") || "");
  const weaverId = String(formData.get("weaverId") || "") || null;
  const greyOrderId = String(formData.get("greyOrderId") || "") || null;
  const fabricTypeId = String(formData.get("fabricTypeId") || "");
  const shadeId = String(formData.get("shadeId") || "");
  const finishTypeId = String(formData.get("finishTypeId") || "") || null;
  const width = String(formData.get("width") || "").trim() || null;
  const gsm = String(formData.get("gsm") || "").trim() || null;
  const feelFallNotes = String(formData.get("feelFallNotes") || "").trim() || null;
  const extraMods = String(formData.get("extraMods") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!millId || !fabricTypeId || !shadeId) {
    throw new Error("Mill, fabric type and shade are required");
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
  const program = await prisma.millProgram.findUniqueOrThrow({
    where: { id },
    include: {
      mill: true,
      fabricType: true,
      shade: { include: { colorFamily: true } },
      finishType: true,
    },
  });

  if (!program.mill.whatsapp) {
    throw new Error("Mill has no WhatsApp number — update party master");
  }

  const body = [
    "Mapps Creation — Mill program",
    `Program: ${program.programNo}`,
    `Mill: ${program.mill.name}`,
    `Fabric: ${program.fabricType.name}`,
    `Colour: ${program.shade.colorFamily.name} / ${program.shade.name}`,
    `GSM: ${program.gsm?.toString() ?? "-"}`,
    `Width: ${program.width?.toString() ?? "-"}`,
    `Finish: ${program.finishType?.name ?? "-"}`,
    program.feelFallNotes ? `Feel / fall: ${program.feelFallNotes}` : null,
    program.extraMods ? `Extra process: ${program.extraMods}` : null,
    program.remarks ? `Remarks: ${program.remarks}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendWhatsApp({
    to: program.mill.whatsapp,
    template: "mill_program",
    entityType: "MillProgram",
    entityId: program.id,
    variables: {
      programNo: program.programNo,
      fabric: program.fabricType.name,
      color: `${program.shade.colorFamily.name} / ${program.shade.name}`,
      gsm: program.gsm?.toString() ?? "-",
      width: program.width?.toString() ?? "-",
      finish: program.finishType?.name ?? "-",
      remarks: program.remarks ?? "-",
      body,
    },
  });

  await prisma.millProgram.update({
    where: { id },
    data: { status: "SENT_TO_MILL", sentAt: new Date() },
  });

  revalidatePath("/programs");
}
