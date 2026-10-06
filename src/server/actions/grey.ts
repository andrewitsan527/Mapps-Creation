"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
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
  const fabricNotes = String(formData.get("fabricNotes") || "").trim() || null;
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const unit = "kg";
  const dyeingRateRaw = String(formData.get("dyeingRate") || "").trim();
  const whatsappNote = String(formData.get("whatsappNote") || "").trim() || null;

  await prisma.greyPurchaseOrder.create({
    data: {
      poNumber: await nextPoNumber(),
      fabricNotes,
      quantity: quantityRaw ? quantityRaw : null,
      unit,
      dyeingRate: dyeingRateRaw ? dyeingRateRaw : null,
      whatsappNote,
      status: "OPEN",
    },
  });

  revalidatePath("/grey");
  revalidatePath("/programs");
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
