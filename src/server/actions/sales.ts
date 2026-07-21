"use server";

import { revalidatePath } from "next/cache";
import { BillStatus, BillType, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { applyStockMovement, lotAvailable, toDecimal } from "@/server/domain/stock";
import {
  addDays,
  calcTds,
  effectiveInterestRate,
} from "@/server/domain/finance";
import {
  formatBillWhatsAppBody,
  lotGoodsInclude,
  snapshotBillLine,
} from "@/server/domain/goods";
import { sendWhatsApp } from "@/server/whatsapp";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function nextBillNo(type: BillType) {
  const count = await prisma.saleBill.count({ where: { type } });
  const prefix = type === "PROVISIONAL" ? "PROV" : "SALE";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${stamp}-${String(count + 1).padStart(3, "0")}`;
}

async function loadLotForSale(lotId: string) {
  return prisma.lot.findUniqueOrThrow({
    where: { id: lotId },
    include: lotGoodsInclude,
  });
}

function lineCreateFromLot(
  lot: Awaited<ReturnType<typeof loadLotForSale>>,
  qty: ReturnType<typeof toDecimal>,
  rate: string,
  lineAmount: ReturnType<typeof toDecimal>,
) {
  const snap = snapshotBillLine(lot);
  return {
    lotId: lot.id,
    ...snap,
    quantity: qty,
    unit: lot.unit,
    rate,
    amount: lineAmount,
  };
}

export async function createProvisionalBill(formData: FormData) {
  const user = await requireUser();
  const partyId = String(formData.get("partyId") || "");
  const lotId = String(formData.get("lotId") || "");
  const quantity = String(formData.get("quantity") || "").trim();
  const rate = String(formData.get("rate") || "0").trim() || "0";
  const gstPct = String(formData.get("gstPct") || "5").trim() || "5";
  const tdsPct = String(formData.get("tdsPct") || "0").trim() || "0";
  const notes = String(formData.get("notes") || "").trim() || null;
  const notify = String(formData.get("notifyWhatsapp") || "") === "true";

  if (!partyId || !lotId || !quantity) {
    throw new Error("Party, lot and quantity required");
  }

  const [lot, party] = await Promise.all([
    loadLotForSale(lotId),
    prisma.party.findUniqueOrThrow({ where: { id: partyId } }),
  ]);
  if (notify && !party.whatsapp) {
    throw new Error(
      "Client has no WhatsApp number — update party master or untick WhatsApp",
    );
  }
  const qty = toDecimal(quantity);
  const available = lotAvailable(lot.onHand, lot.reserved);
  if (available.lt(qty)) {
    throw new Error(`Only ${available} ${lot.unit} available on ${lot.lotNumber}`);
  }

  const lineAmount = qty.mul(toDecimal(rate));
  const gstAmount = lineAmount.mul(toDecimal(gstPct)).div(100);
  const { tdsAmount } = calcTds({ amount: lineAmount.plus(gstAmount), tdsPct });
  const total = lineAmount.plus(gstAmount);

  let billId = "";
  let billNo = "";
  await prisma.$transaction(async (tx) => {
    const bill = await tx.saleBill.create({
      data: {
        billNo: await nextBillNo("PROVISIONAL"),
        type: "PROVISIONAL",
        status: "ISSUED",
        partyId,
        subtotal: lineAmount,
        gstPct,
        gstAmount,
        tdsPct,
        tdsAmount,
        total,
        notes,
        lines: { create: lineCreateFromLot(lot, qty, rate, lineAmount) },
      },
    });
    billId = bill.id;
    billNo = bill.billNo;

    await applyStockMovement(tx, {
      lotId,
      type: StockMovementType.RESERVE,
      quantity: qty,
      referenceType: "SaleBill",
      referenceId: bill.id,
      notes: "Provisional reserve",
      createdById: user.id,
    });
  });

  if (notify && party.whatsapp) {
    const body = formatBillWhatsAppBody({
      billNo,
      partyName: party.name,
      total,
      lines: [
        {
          ...snapshotBillLine(lot),
          quantity: qty,
          unit: lot.unit,
        },
      ],
    });
    await sendWhatsApp({
      to: party.whatsapp,
      template: "provisional_bill",
      entityType: "SaleBill",
      entityId: billId,
      variables: {
        billNo,
        total: total.toString(),
        body,
      },
    });
  }

  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/dispatch");
  revalidatePath("/messages");
}

export async function createDirectSaleBill(formData: FormData) {
  const user = await requireUser();
  const partyId = String(formData.get("partyId") || "");
  const lotId = String(formData.get("lotId") || "");
  const quantity = String(formData.get("quantity") || "").trim();
  const rate = String(formData.get("rate") || "0").trim() || "0";
  const gstPct = String(formData.get("gstPct") || "5").trim() || "5";
  const tdsPct = String(formData.get("tdsPct") || "0").trim() || "0";
  const notes = String(formData.get("notes") || "").trim() || null;
  const notify = String(formData.get("notifyWhatsapp") || "") === "true";

  if (!partyId || !lotId || !quantity) {
    throw new Error("Party, lot and quantity required");
  }

  const [lot, party] = await Promise.all([
    loadLotForSale(lotId),
    prisma.party.findUniqueOrThrow({ where: { id: partyId } }),
  ]);
  const qty = toDecimal(quantity);
  const available = lotAvailable(lot.onHand, lot.reserved);
  if (available.lt(qty)) {
    throw new Error(`Only ${available} ${lot.unit} available on ${lot.lotNumber}`);
  }

  const lineAmount = qty.mul(toDecimal(rate));
  const gstAmount = lineAmount.mul(toDecimal(gstPct)).div(100);
  const { tdsAmount } = calcTds({ amount: lineAmount.plus(gstAmount), tdsPct });
  const total = lineAmount.plus(gstAmount);

  let billId = "";
  let billNo = "";
  await prisma.$transaction(async (tx) => {
    const bill = await tx.saleBill.create({
      data: {
        billNo: await nextBillNo("SALE"),
        type: "SALE",
        status: "ISSUED",
        partyId,
        paymentTermsDays: party.paymentTermsDays,
        interestRatePct: effectiveInterestRate(party.interestRatePct),
        // Due date starts at physical dispatch, not bill creation.
        dueDate: null,
        subtotal: lineAmount,
        gstPct,
        gstAmount,
        tdsPct,
        tdsAmount,
        total,
        notes,
        lines: { create: lineCreateFromLot(lot, qty, rate, lineAmount) },
      },
      include: { lines: true },
    });
    billId = bill.id;
    billNo = bill.billNo;

    await applyStockMovement(tx, {
      lotId,
      type: StockMovementType.RESERVE,
      quantity: qty,
      referenceType: "SaleBill",
      referenceId: bill.id,
      notes: "Sale reserve pending delivery",
      createdById: user.id,
    });
  });

  if (notify && party.whatsapp) {
    const body = formatBillWhatsAppBody({
      billNo,
      partyName: party.name,
      total,
      lines: [
        {
          ...snapshotBillLine(lot),
          quantity: qty,
          unit: lot.unit,
        },
      ],
    });
    await sendWhatsApp({
      to: party.whatsapp,
      template: "sale_bill",
      entityType: "SaleBill",
      entityId: billId,
      variables: {
        billNo,
        total: total.toString(),
        body,
      },
    });
  }

  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/dispatch");
}

export async function cancelProvisionalBill(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const provisional = await prisma.saleBill.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  if (provisional.type !== "PROVISIONAL" || provisional.status !== "ISSUED") {
    throw new Error("Only issued provisional bills can be cancelled");
  }

  await prisma.$transaction(async (tx) => {
    for (const line of provisional.lines) {
      if (!line.lotId) continue;
      await applyStockMovement(tx, {
        lotId: line.lotId,
        type: StockMovementType.RELEASE,
        quantity: line.quantity,
        referenceType: "SaleBill",
        referenceId: provisional.id,
        notes: "Cancel provisional — release reserve",
        createdById: user.id,
      });
    }
    await tx.saleBill.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  });

  revalidatePath("/sales");
  revalidatePath("/stock");
}

export async function convertProvisionalToSale(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const provisional = await prisma.saleBill.findUniqueOrThrow({
    where: { id },
    include: { lines: true, party: true },
  });

  if (provisional.type !== "PROVISIONAL" || provisional.status === "CONVERTED") {
    throw new Error("Only open provisional bills can be converted");
  }

  let saleId = "";
  let saleNo = "";
  await prisma.$transaction(async (tx) => {
    const sale = await tx.saleBill.create({
      data: {
        billNo: await nextBillNo("SALE"),
        type: "SALE",
        status: "ISSUED",
        partyId: provisional.partyId,
        billDate: new Date(),
        paymentTermsDays: provisional.party.paymentTermsDays,
        interestRatePct: effectiveInterestRate(
          provisional.party.interestRatePct,
        ),
        dueDate: null,
        subtotal: provisional.subtotal,
        gstPct: provisional.gstPct,
        gstAmount: provisional.gstAmount,
        tdsPct: provisional.tdsPct,
        tdsAmount: provisional.tdsAmount,
        total: provisional.total,
        notes: provisional.notes,
        provisionalId: provisional.id,
        lines: {
          create: provisional.lines.map((l) => ({
            lotId: l.lotId,
            lotNumber: l.lotNumber,
            fabricName: l.fabricName,
            colorFamily: l.colorFamily,
            shadeName: l.shadeName,
            shadeCode: l.shadeCode,
            finishName: l.finishName,
            millName: l.millName,
            weaverName: l.weaverName,
            width: l.width,
            gsm: l.gsm,
            marka: l.marka,
            rollNumber: l.rollNumber,
            rollCount: l.rollCount,
            weightKg: l.weightKg,
            lengthM: l.lengthM,
            rollsDetail: l.rollsDetail,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            rate: l.rate,
            amount: l.amount,
          })),
        },
      },
    });
    saleId = sale.id;
    saleNo = sale.billNo;

    await tx.saleBill.update({
      where: { id: provisional.id },
      data: { status: "CONVERTED" as BillStatus },
    });
  });

  if (provisional.party.whatsapp) {
    const body = formatBillWhatsAppBody({
      billNo: saleNo,
      partyName: provisional.party.name,
      total: provisional.total,
      lines: provisional.lines,
    });
    await sendWhatsApp({
      to: provisional.party.whatsapp,
      template: "sale_bill",
      entityType: "SaleBill",
      entityId: saleId,
      variables: {
        billNo: saleNo,
        total: provisional.total.toString(),
        body,
      },
    });
  }

  revalidatePath("/sales");
  revalidatePath("/dispatch");
}

/**
 * Deliver goods against a sale bill: stock OUT + WhatsApp sale bill to party.
 * Sale bill is the customer document (no separate challan workflow).
 */
export async function deliverSaleBill(formData: FormData) {
  const user = await requireUser();
  const saleBillId = String(formData.get("saleBillId") || "");
  const vehicleNo = String(formData.get("vehicleNo") || "").trim() || null;
  const driverName = String(formData.get("driverName") || "").trim() || null;
  const driverPhone = String(formData.get("driverPhone") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const notify = String(formData.get("notifyWhatsapp") || "") === "true";

  if (!saleBillId) throw new Error("Sale bill required");

  const bill = await prisma.saleBill.findUniqueOrThrow({
    where: { id: saleBillId },
    include: {
      lines: true,
      party: true,
      dispatches: true,
    },
  });

  if (bill.type !== "SALE" || bill.status === "CANCELLED") {
    throw new Error("Deliver only from issued sale bills");
  }
  if (bill.dispatches.some((d) => d.status === "DISPATCHED")) {
    throw new Error("Already delivered");
  }

  const count = await prisma.dispatch.count();
  const dispatchNo = `DLV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(3, "0")}`;

  let dispatchId = "";
  const dispatchedAt = new Date();
  const paymentTermsDays =
    bill.paymentTermsDays ?? bill.party.paymentTermsDays;
  const interestRatePct = effectiveInterestRate(
    bill.interestRatePct ?? bill.party.interestRatePct,
  );
  await prisma.$transaction(async (tx) => {
    const dispatch = await tx.dispatch.create({
      data: {
        challanNo: dispatchNo,
        partyId: bill.partyId,
        saleBillId: bill.id,
        vehicleNo,
        driverName,
        driverPhone,
        notes,
        status: "DISPATCHED",
        dispatchedAt,
        whatsappSent: false,
        lines: {
          create: bill.lines
            .filter((l) => l.lotId)
            .map((l) => ({
              lotId: l.lotId!,
              quantity: l.quantity,
              lotNumber: l.lotNumber,
              fabricName: l.fabricName,
              shadeName: l.shadeName,
              rollsDetail: l.rollsDetail,
            })),
        },
      },
    });
    dispatchId = dispatch.id;

    await tx.saleBill.update({
      where: { id: bill.id },
      data: {
        paymentTermsDays,
        interestRatePct,
        creditStartsAt: dispatchedAt,
        dueDate: addDays(dispatchedAt, paymentTermsDays),
        preDueReminderSentAt: null,
        dueReminderSentAt: null,
      },
    });

    for (const line of bill.lines) {
      if (!line.lotId) continue;
      const lot = await tx.lot.findUniqueOrThrow({ where: { id: line.lotId } });
      const qty = toDecimal(line.quantity);
      if (toDecimal(lot.reserved).gte(qty)) {
        await applyStockMovement(tx, {
          lotId: line.lotId,
          type: StockMovementType.RELEASE,
          quantity: qty,
          referenceType: "Dispatch",
          referenceId: dispatch.id,
          notes: "Release sale reserve",
          createdById: user.id,
        });
      }
      await applyStockMovement(tx, {
        lotId: line.lotId,
        type: StockMovementType.OUT,
        quantity: qty,
        referenceType: "Dispatch",
        referenceId: dispatch.id,
        notes: "Delivered to party",
        createdById: user.id,
      });
    }
  });

  if (notify && bill.party.whatsapp) {
    const body = formatBillWhatsAppBody({
      billNo: bill.billNo,
      partyName: bill.party.name,
      total: bill.total,
      lines: bill.lines,
      vehicleNo,
    });
    await sendWhatsApp({
      to: bill.party.whatsapp,
      template: "sale_bill",
      entityType: "SaleBill",
      entityId: bill.id,
      variables: {
        billNo: bill.billNo,
        total: bill.total.toString(),
        body,
      },
    });
    await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { whatsappSent: true },
    });
  }

  revalidatePath("/dispatch");
  revalidatePath("/sales");
  revalidatePath(`/sales/${bill.id}`);
  revalidatePath("/stock");
  revalidatePath("/payments");
  revalidatePath("/messages");
}

/** @deprecated use deliverSaleBill */
export async function createDispatch(formData: FormData) {
  return deliverSaleBill(formData);
}
