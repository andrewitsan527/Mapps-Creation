"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { greyPoPdfUrl } from "@/lib/pdf-urls";
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
  const notify = String(formData.get("notifyWhatsapp") || "") === "true";

  if (!supplierId) throw new Error("Supplier required");

  const supplier = await prisma.party.findUniqueOrThrow({
    where: { id: supplierId },
  });
  if (notify && !supplier.whatsapp) {
    throw new Error(
      "Supplier has no WhatsApp number — open Masters → Suppliers, add WhatsApp, then retry",
    );
  }

  const quantityLabel = quantityRaw ? `${quantityRaw} ${unit}` : "-";
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

  if (notify && supplier.whatsapp) {
    const pdfUrl = greyPoPdfUrl(po.id);
    const body = [
      `${COMPANY.shortName} — Grey purchase order`,
      `PO: ${po.poNumber}`,
      `Supplier: ${supplier.name}`,
      `Quantity: ${quantityLabel}`,
      fabricNotes ? `Fabric: ${fabricNotes}` : null,
      whatsappNote ? `Note: ${whatsappNote}` : null,
      "",
      `PDF: ${pdfUrl}`,
      `Contact: ${COMPANY.phone}`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const { shareUrl } = await sendWhatsApp({
      to: supplier.whatsapp,
      template: "grey_purchase_order",
      entityType: "GreyPurchaseOrder",
      entityId: po.id,
      variables: {
        poNumber: po.poNumber,
        supplier: supplier.name,
        quantity: quantityLabel,
        note: whatsappNote || fabricNotes || "Grey purchase order created",
        pdfUrl,
        body,
      },
    });

    revalidatePath("/grey");
    revalidatePath("/messages");
    return { shareUrl, pdfUrl, poNumber: po.poNumber };
  }

  revalidatePath("/grey");
  revalidatePath("/messages");
  return { poNumber: po.poNumber };
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
