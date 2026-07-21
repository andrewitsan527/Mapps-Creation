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
import { nextProgramLotNo } from "@/lib/doc-numbers";
import {
  openMillReturnAndNotify,
  primaryDefectFromChecklist,
} from "@/server/domain/mill-return";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createLotFromProgram(formData: FormData) {
  await requireUser();
  const programId = String(formData.get("programId") || "");
  const marka = String(formData.get("marka") || "").trim() || null;
  const rollNumber = String(formData.get("rollNumber") || "").trim() || null;
  const weightKgRaw = String(formData.get("weightKg") || "").trim();
  const widthRaw = String(formData.get("width") || "").trim();
  const gsmRaw = String(formData.get("gsm") || "").trim();
  const rollsRaw = String(formData.get("rollLengths") || "").trim();
  const quantityRaw = String(formData.get("quantity") || "").trim();

  if (!programId) throw new Error("Program required");

  const program = await prisma.millProgram.findUniqueOrThrow({
    where: { id: programId },
    include: { finishType: true },
  });

  const parsedRolls = parseRollLengths(rollsRaw);
  let totalLength = parsedRolls.reduce(
    (s, r) => s + Number(r.lengthM || 0),
    0,
  );
  if (!totalLength && quantityRaw) {
    totalLength = Number(quantityRaw);
  }
  if (!totalLength || !Number.isFinite(totalLength) || totalLength <= 0) {
    throw new Error("Enter total length (m) or per-roll lengths");
  }

  const rollCount =
    parsedRolls.length > 0
      ? parsedRolls.length
      : Math.max(1, Number(formData.get("rollCount") || 1) || 1);

  const quantity = toDecimal(totalLength);
  const weightKg = weightKgRaw ? toDecimal(weightKgRaw) : null;
  const width = widthRaw ? toDecimal(widthRaw) : program.width;
  const gsm = gsmRaw ? toDecimal(gsmRaw) : program.gsm;

  await prisma.lot.create({
    data: {
      lotNumber: await nextProgramLotNo(),
      origin: "PROGRAM",
      rollNumber:
        rollNumber ??
        (parsedRolls.length === 1 ? parsedRolls[0].rollNo : null),
      marka,
      fabricTypeId: program.fabricTypeId,
      shadeId: program.shadeId,
      finishTypeId: program.finishTypeId,
      programId: program.id,
      greyOrderId: program.greyOrderId,
      millId: program.millId,
      weaverId: program.weaverId,
      width,
      gsm,
      quantity,
      lengthM: quantity,
      weightKg,
      rollCount,
      onHand: 0,
      reserved: 0,
      unit: "m",
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

  await prisma.millProgram.update({
    where: { id: programId },
    data: { status: "RETURNED" },
  });

  revalidatePath("/qc");
  revalidatePath("/programs");
  revalidatePath("/stock");
}

export async function submitQc(formData: FormData) {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") || "");
  const passed = String(formData.get("passed") || "") === "true";
  const grade = (String(formData.get("grade") || "A") || "A") as QualityGrade;
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const severityRaw = String(formData.get("severity") || "") || null;

  const checklistWeaver =
    String(formData.get("checklistWeaver") || "") === "true";
  const checklistMill = String(formData.get("checklistMill") || "") === "true";
  const checklistDying =
    String(formData.get("checklistDying") || "") === "true";
  const checklistMinor =
    String(formData.get("checklistMinor") || "") === "true";

  if (!lotId) throw new Error("Lot required");

  const lot = await prisma.lot.findUniqueOrThrow({
    where: { id: lotId },
  });

  if (lot.origin !== "PROGRAM") {
    throw new Error("Program QC only — use Goods return for MCSR lots");
  }

  const defectType = passed
    ? "NONE"
    : primaryDefectFromChecklist({
        checklistMill,
        checklistWeaver,
        checklistDying,
        checklistMinor,
      });

  if (!passed && defectType === "NONE") {
    throw new Error("Select at least one defect (mill / weaver / dyeing / minor)");
  }

  const severity: DefectSeverity | null = passed
    ? null
    : checklistWeaver
      ? "HIGH"
      : severityRaw
        ? (severityRaw as DefectSeverity)
        : "MEDIUM";

  const qc = await prisma.$transaction(async (tx) => {
    const check = await tx.qualityCheck.create({
      data: {
        lotId,
        inspectorId: user.id,
        passed,
        defectType,
        severity,
        grade: passed ? grade : "REJECT",
        remarks,
        checklistWeaver,
        checklistMill,
        checklistDying,
        checklistMinor,
      },
    });

    if (passed) {
      await applyStockMovement(tx, {
        lotId,
        type: StockMovementType.IN,
        quantity: lot.quantity,
        referenceType: "QualityCheck",
        referenceId: lotId,
        notes: "QC pass inward",
        createdById: user.id,
      });
      await tx.lot.update({
        where: { id: lotId },
        data: { qualityGrade: grade, defectType: "NONE", active: true },
      });
      if (lot.programId) {
        await tx.millProgram.update({
          where: { id: lot.programId },
          data: { status: "CLOSED" },
        });
      }
    } else {
      // Mill defect → hold for RF. Weaver stays visible for priority follow-up.
      await tx.lot.update({
        where: { id: lotId },
        data: {
          defectType,
          qualityGrade: "REJECT",
          returnPriority: severity,
          active: defectType === "WEAVER" || checklistWeaver,
        },
      });
    }

    return check;
  });

  if (!passed) {
    await openMillReturnAndNotify({
      lotId,
      qualityCheckId: qc.id,
      source: "PROGRAM",
      defectType,
      checklistMill,
      checklistWeaver,
      checklistDying,
      checklistMinor,
      severity,
      remarks,
      forAnyDefect: true,
    });
  }

  revalidatePath("/qc");
  revalidatePath("/stock");
  revalidatePath("/returns");
  revalidatePath("/dashboard");
}
