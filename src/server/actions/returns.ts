"use server";

import { revalidatePath } from "next/cache";
import {
  DefectSeverity,
  QualityGrade,
  StockMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { applyStockMovement, toDecimal } from "@/server/domain/stock";
import { parseRollLengths } from "@/server/domain/goods";
import { nextMcsrLotNo } from "@/lib/doc-numbers";
import { saveReturnMarkaPhoto } from "@/server/uploads";
import {
  markMillReturnSent,
  openMillReturnAndNotify,
  primaryDefectFromChecklist,
} from "@/server/domain/mill-return";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function revalidateReturns() {
  revalidatePath("/returns");
  revalidatePath("/stock");
  revalidatePath("/sales");
  revalidatePath("/qc");
  revalidatePath("/dashboard");
}

/**
 * Goods return intake — tracked primarily by sale bill (stickers often lost).
 * Creates MCSR lot (pending QC) + return document. Stock IN only after GR QC.
 */
export async function intakeGoodsReturn(formData: FormData) {
  await requireUser();
  const saleBillId = String(formData.get("saleBillId") || "");
  const saleBillLineId = String(formData.get("saleBillLineId") || "");
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const rollsRaw = String(formData.get("rollLengths") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;
  const priority = (String(formData.get("priority") || "MEDIUM") ||
    "MEDIUM") as DefectSeverity;
  const millMarkaId = String(formData.get("millMarkaId") || "");
  const originalLotRef =
    String(formData.get("originalLotRef") || "").trim() || null;

  if (!saleBillId || !saleBillLineId || !millMarkaId) {
    throw new Error("Sale bill, goods line, and verified mill marka required");
  }

  const bill = await prisma.saleBill.findUniqueOrThrow({
    where: { id: saleBillId },
    include: {
      party: true,
      lines: {
        where: { id: saleBillLineId },
        include: {
          lot: {
            include: {
              fabricType: true,
              shade: true,
              finishType: true,
              mill: true,
              weaver: true,
              rolls: true,
            },
          },
        },
      },
    },
  });

  if (bill.type !== "SALE") throw new Error("Goods return only against sale bills");
  const line = bill.lines[0];
  if (!line) throw new Error("Bill line not found on this bill");

  const lotInclude = {
    fabricType: true,
    shade: true,
    finishType: true,
    mill: true,
    weaver: true,
  } as const;

  const lookedUp = originalLotRef
    ? await prisma.lot.findFirst({
        where: {
          OR: [{ id: originalLotRef }, { lotNumber: originalLotRef }],
        },
        include: lotInclude,
      })
    : null;

  const sourceLot = lookedUp ?? line.lot;

  if (!sourceLot && !line.fabricName) {
    throw new Error("Cannot resolve fabric from bill — pick a line with lot history");
  }

  let fabricTypeId = sourceLot?.fabricTypeId;
  let shadeId = sourceLot?.shadeId;
  if (!fabricTypeId && line.fabricName) {
    const ft = await prisma.fabricType.findFirst({
      where: { name: line.fabricName },
    });
    fabricTypeId = ft?.id;
  }
  if (!shadeId && line.shadeName) {
    const sh = await prisma.shade.findFirst({
      where: {
        name: line.shadeName,
        ...(line.colorFamily
          ? { colorFamily: { name: line.colorFamily } }
          : {}),
      },
    });
    shadeId = sh?.id;
  }
  if (!fabricTypeId || !shadeId) {
    throw new Error("Fabric / shade from bill could not be matched in masters");
  }

  const expectedMillId =
    sourceLot?.millId ??
    (
      await prisma.party.findFirst({
        where: {
          type: "MILL",
          active: true,
          ...(line.millName ? { name: line.millName } : { id: "__missing__" }),
        },
        select: { id: true },
      })
    )?.id;
  if (!expectedMillId) {
    throw new Error("The billed goods are not connected to a mill");
  }

  const verifiedMarka = await prisma.millMarka.findFirst({
    where: {
      id: millMarkaId,
      millId: expectedMillId,
      active: true,
      mill: { type: "MILL", active: true },
    },
    include: { mill: { select: { name: true } } },
  });
  if (!verifiedMarka) {
    throw new Error("Marka does not belong to the connected mill — return rejected");
  }

  const parsedRolls = parseRollLengths(rollsRaw);
  let totalLength = parsedRolls.reduce((s, r) => s + Number(r.lengthM || 0), 0);
  if (!totalLength && quantityRaw) totalLength = Number(quantityRaw);
  if (!totalLength || totalLength <= 0) {
    throw new Error("Enter return quantity (m) or roll lengths");
  }

  const qty = toDecimal(totalLength);
  const returnNo = await nextMcsrLotNo();
  const rollCount =
    parsedRolls.length > 0
      ? parsedRolls.length
      : Math.max(1, Number(formData.get("rollCount") || 1) || 1);

  await prisma.$transaction(async (tx) => {
    const newLot = await tx.lot.create({
      data: {
        lotNumber: returnNo,
        origin: "SALES_RETURN",
        returnPriority: priority,
        sourceSaleBillId: bill.id,
        parentLotId: sourceLot?.id ?? null,
        millMarkaId: verifiedMarka.id,
        fabricTypeId,
        shadeId,
        finishTypeId: sourceLot?.finishTypeId ?? null,
        millId: verifiedMarka.millId,
        weaverId: sourceLot?.weaverId ?? null,
        programId: sourceLot?.programId ?? null,
        width: sourceLot?.width ?? line.width,
        gsm: sourceLot?.gsm ?? line.gsm,
        quantity: qty,
        lengthM: qty,
        weightKg: null,
        rollCount,
        marka: verifiedMarka.code,
        unit: line.unit || "m",
        qualityGrade: "B",
        defectType: "NONE",
        onHand: 0,
        reserved: 0,
        active: false,
        rolls:
          parsedRolls.length > 0
            ? {
                create: parsedRolls.map((r, i) => ({
                  rollNo: r.rollNo,
                  lengthM: r.lengthM,
                  sortOrder: i,
                })),
              }
            : undefined,
      },
    });

    await tx.salesReturn.create({
      data: {
        returnNo,
        status: "PENDING_QC",
        priority,
        partyId: bill.partyId,
        saleBillId: bill.id,
        saleBillLineId: line.id,
        millMarkaId: verifiedMarka.id,
        originalLotId: sourceLot?.id ?? null,
        newLotId: newLot.id,
        quantity: qty,
        reason,
        restock: true,
      },
    });
  });

  revalidateReturns();
}

/**
 * GR QC report — checklist + remarks + grade → stock MCSR lot into return inventory.
 */
export async function submitGoodsReturnQc(formData: FormData) {
  const user = await requireUser();
  const returnId = String(formData.get("returnId") || "");
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const grade = (String(formData.get("grade") || "B") || "B") as QualityGrade;
  const accept = String(formData.get("accept") || "true") === "true";
  const priority = (String(formData.get("priority") || "") ||
    "") as DefectSeverity | "";

  const checklistWeaver = String(formData.get("checklistWeaver") || "") === "true";
  const checklistMill = String(formData.get("checklistMill") || "") === "true";
  const checklistDying = String(formData.get("checklistDying") || "") === "true";
  const checklistMinor = String(formData.get("checklistMinor") || "") === "true";
  const photoEntry = formData.get("markaPhoto");

  if (!returnId) throw new Error("Return required");
  if (!(photoEntry instanceof File) || photoEntry.size === 0) {
    throw new Error("A clear photo showing the mill marka is required");
  }

  const ret = await prisma.salesReturn.findUniqueOrThrow({
    where: { id: returnId },
    include: {
      newLot: true,
      millMarka: { include: { mill: { select: { id: true, name: true } } } },
    },
  });

  if (
    ret.status !== "PENDING_QC" ||
    !ret.newLotId ||
    !ret.newLot ||
    !ret.millMarka
  ) {
    throw new Error("Return is not awaiting GR QC");
  }
  if (
    ret.newLot.millId !== ret.millMarka.millId ||
    ret.newLot.marka !== ret.millMarka.code
  ) {
    throw new Error("Return marka no longer matches the connected mill");
  }

  const primaryDefect = primaryDefectFromChecklist({
    checklistMill,
    checklistWeaver,
    checklistDying,
    checklistMinor,
  });

  // Weaver defects always surface as HIGH on the operations desk.
  const severity = (
    checklistWeaver
      ? "HIGH"
      : priority || ret.priority || "MEDIUM"
  ) as DefectSeverity;
  const markaPhotoUrl = await saveReturnMarkaPhoto(photoEntry);

  // Mill defect → RF path, do not put into return inventory.
  const restock = accept && ret.restock && !checklistMill;

  const qc = await prisma.$transaction(async (tx) => {
    const check = await tx.qualityCheck.create({
      data: {
        lotId: ret.newLotId!,
        inspectorId: user.id,
        passed: restock,
        defectType:
          restock && primaryDefect === "NONE" ? "NONE" : primaryDefect,
        severity: primaryDefect === "NONE" && restock ? null : severity,
        grade: restock ? grade : "REJECT",
        remarks,
        photoUrl: markaPhotoUrl,
        checklistWeaver,
        checklistMill,
        checklistDying,
        checklistMinor,
      },
    });

    if (restock) {
      await applyStockMovement(tx, {
        lotId: ret.newLotId!,
        type: StockMovementType.RETURN,
        quantity: ret.quantity,
        referenceType: "SalesReturn",
        referenceId: ret.id,
        notes: remarks ?? "Goods return QC — into return inventory",
        createdById: user.id,
      });
      await tx.lot.update({
        where: { id: ret.newLotId! },
        data: {
          active: true,
          qualityGrade: grade,
          defectType: primaryDefect,
          returnPriority: severity,
        },
      });
      await tx.salesReturn.update({
        where: { id: ret.id },
        data: {
          status: "IN_STOCK",
          qualityGrade: grade,
          priority: severity,
          reason: remarks ?? ret.reason,
          markaPhotoUrl,
        },
      });
    } else {
      await tx.lot.update({
        where: { id: ret.newLotId! },
        data: {
          active: checklistWeaver && !checklistMill,
          qualityGrade: "REJECT",
          defectType: primaryDefect === "NONE" ? "MINOR" : primaryDefect,
          returnPriority: severity,
        },
      });
      await tx.salesReturn.update({
        where: { id: ret.id },
        data: {
          status: "CLOSED",
          qualityGrade: "REJECT",
          priority: severity,
          restock: false,
          reason: remarks ?? ret.reason,
          markaPhotoUrl,
        },
      });
    }

    return check;
  });

  if (primaryDefect !== "NONE" || checklistMill) {
    await openMillReturnAndNotify({
      lotId: ret.newLotId!,
      qualityCheckId: qc.id,
      source: "SALES_RETURN",
      defectType: primaryDefect === "NONE" ? "MINOR" : primaryDefect,
      checklistMill,
      checklistWeaver,
      checklistDying,
      checklistMinor,
      severity,
      remarks,
      markaPhotoUrl,
      forAnyDefect: true,
    });
  }

  revalidateReturns();
}

/** Confirm physical send to mill (closes 1-day SLA) and WhatsApp mill. */
export async function returnLotToMill(formData: FormData) {
  await requireUser();
  const lotId = String(formData.get("lotId") || "");
  const remarks = String(formData.get("remarks") || "").trim() || null;

  await prisma.lot.update({
    where: { id: lotId },
    data: { defectType: "MILL", active: false },
  });

  await markMillReturnSent({
    lotId,
    remarks,
    resendWhatsApp: true,
  });

  revalidateReturns();
  revalidatePath("/dashboard");
  revalidatePath("/qc");
}
