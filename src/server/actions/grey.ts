"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { requireAgentWeaverLink, requireMillWeaverLink } from "@/lib/parties";
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
  const millId = String(formData.get("millId") || "");
  const agentId = String(formData.get("agentId") || "") || null;
  const fabricNotes = String(formData.get("fabricNotes") || "").trim() || null;
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const unit = String(formData.get("unit") || "m");
  const dyeingRateRaw = String(formData.get("dyeingRate") || "").trim();
  const whatsappNote = String(formData.get("whatsappNote") || "").trim() || null;
  const notify = String(formData.get("notifyWhatsapp") || "") === "true";

  if (!supplierId) throw new Error("Weaver required");
  if (!millId) throw new Error("Destination mill required");

  const supplier = await prisma.party.findUniqueOrThrow({
    where: { id: supplierId },
  });
  if (supplier.type !== "WEAVER") {
    throw new Error("Grey purchase must use a Weaver");
  }

  const mill = await prisma.party.findUniqueOrThrow({ where: { id: millId } });
  if (mill.type !== "MILL") {
    throw new Error("Destination mill must be a Mill party");
  }

  if (agentId) {
    const agent = await prisma.party.findUniqueOrThrow({
      where: { id: agentId },
    });
    if (agent.type !== "AGENT") {
      throw new Error("Grey agent must be an Agent party");
    }
    await requireAgentWeaverLink(agentId, supplierId);
  }

  await requireMillWeaverLink(millId, supplierId);

  if (notify && !supplier.whatsapp) {
    throw new Error(
      "Supplier has no WhatsApp number — update supplier master or untick WhatsApp",
    );
  }
  const po = await prisma.greyPurchaseOrder.create({
    data: {
      poNumber: await nextPoNumber(),
      supplierId,
      millId,
      agentId,
      fabricNotes,
      quantity: quantityRaw ? quantityRaw : null,
      unit,
      dyeingRate: dyeingRateRaw ? dyeingRateRaw : null,
      whatsappNote,
      status: "OPEN",
    },
  });

  if (notify && supplier.whatsapp) {
    await sendWhatsApp({
      to: supplier.whatsapp,
      template: "grey_purchase_order",
      entityType: "GreyPurchaseOrder",
      entityId: po.id,
      variables: {
        poNumber: po.poNumber,
        supplier: supplier.name,
        quantity: quantityRaw ? `${quantityRaw} ${unit}` : "-",
        note: whatsappNote || fabricNotes || "Grey purchase order created",
      },
    });
  }

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
