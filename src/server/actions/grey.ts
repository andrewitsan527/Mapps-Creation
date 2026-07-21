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

async function nextPoNumber() {
  const count = await prisma.greyPurchaseOrder.count();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `GREY-${stamp}-${String(count + 1).padStart(3, "0")}`;
}

export async function createGreyPo(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") || "");
  const fabricNotes = String(formData.get("fabricNotes") || "").trim() || null;
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const unit = String(formData.get("unit") || "m");
  const whatsappNote = String(formData.get("whatsappNote") || "").trim() || null;

  if (!supplierId) throw new Error("Supplier required");

  const supplier = await prisma.party.findUniqueOrThrow({ where: { id: supplierId } });
  const po = await prisma.greyPurchaseOrder.create({
    data: {
      poNumber: await nextPoNumber(),
      supplierId,
      fabricNotes,
      quantity: quantityRaw ? quantityRaw : null,
      unit,
      whatsappNote,
      status: "OPEN",
    },
  });

  if (supplier.whatsapp) {
    await sendWhatsApp({
      to: supplier.whatsapp,
      template: "mill_program",
      entityType: "GreyPurchaseOrder",
      entityId: po.id,
      variables: {
        poNumber: po.poNumber,
        note: whatsappNote || fabricNotes || "Grey purchase order created",
      },
    });
  }

  revalidatePath("/grey");
}

export async function addGreyBill(formData: FormData) {
  await requireUser();
  const orderId = String(formData.get("orderId") || "");
  const billNo = String(formData.get("billNo") || "").trim();
  const amount = String(formData.get("amount") || "0");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!orderId || !billNo) throw new Error("Order and bill number required");

  await prisma.greyPurchaseBill.create({
    data: { orderId, billNo, amount, notes },
  });
  revalidatePath("/grey");
}
