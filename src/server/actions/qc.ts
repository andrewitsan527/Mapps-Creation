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
import { nextProgramLotNo } from "@/lib/doc-numbers";
import {
  openMillReturnAndNotify,
  primaryDefectFromChecklist,
} from "@/server/domain/mill-return";
import {
  countPendingInwardQc,
  programQtySummary,
} from "@/server/domain/mill-inward";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function submitQc(formData: FormData) {
  const user = await requireUser();
  const millInwardId = String(formData.get("millInwardId") || "") || null;
  const lotId = String(formData.get("lotId") || "") || null;
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

  if (!millInwardId && !lotId) throw new Error("Mill inward or lot required");

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

  if (millInwardId) {
    await submitInwardQc({
      userId: user.id,
      millInwardId,
      passed,
      grade,
      remarks,
      severity,
      defectType,
      checklistWeaver,
      checklistMill,
      checklistDying,
      checklistMinor,
    });
  } else if (lotId) {
    await submitLegacyLotQc({
      userId: user.id,
      lotId,
      passed,
      grade,
      remarks,
      severity,
      defectType,
      checklistWeaver,
      checklistMill,
      checklistDying,
      checklistMinor,
    });
  }

  revalidatePath("/qc");
  revalidatePath("/programs");
  revalidatePath("/stock");
  revalidatePath("/returns");
  revalidatePath("/dashboard");
}

async function submitInwardQc(input: {
  userId: string;
  millInwardId: string;
  passed: boolean;
  grade: QualityGrade;
  remarks: string | null;
  severity: DefectSeverity | null;
  defectType: "NONE" | "MILL" | "WEAVER" | "DYEING" | "MINOR";
  checklistWeaver: boolean;
  checklistMill: boolean;
  checklistDying: boolean;
  checklistMinor: boolean;
}) {
  const inward = await prisma.millInward.findUniqueOrThrow({
    where: { id: input.millInwardId },
    include: {
      lot: { select: { id: true } },
      qualityChecks: { select: { id: true } },
      program: true,
    },
  });

  if (inward.lot) {
    throw new Error("This mill inward already has a lot");
  }
  if (inward.qualityChecks.length > 0) {
    throw new Error("This mill inward has already been inspected");
  }

  const program = inward.program;
  const qty = toDecimal(inward.quantity);
  const unit = inward.unit || "m";

  const qc = await prisma.$transaction(async (tx) => {
    const check = await tx.qualityCheck.create({
      data: {
        millInwardId: inward.id,
        inspectorId: input.userId,
        passed: input.passed,
        defectType: input.defectType,
        severity: input.severity,
        grade: input.passed ? input.grade : "REJECT",
        remarks: input.remarks,
        checklistWeaver: input.checklistWeaver,
        checklistMill: input.checklistMill,
        checklistDying: input.checklistDying,
        checklistMinor: input.checklistMinor,
      },
    });

    if (input.passed) {
      const lot = await tx.lot.create({
        data: {
          lotNumber: await nextProgramLotNo(),
          origin: "PROGRAM",
          fabricTypeId: program.fabricTypeId,
          qualityId: program.qualityId,
          codeId: program.codeId,
          colourId: program.colourId,
          finishTypeId: program.finishTypeId,
          programId: program.id,
          millInwardId: inward.id,
          greyOrderId: program.greyOrderId,
          millId: program.millId,
          weaverId: program.weaverId,
          width: program.width,
          gsm: program.gsm,
          quantity: qty,
          lengthM: unit === "m" ? qty : null,
          weightKg: unit === "kg" ? qty : null,
          rollCount: 1,
          onHand: 0,
          reserved: 0,
          unit,
          qualityGrade: input.grade,
          defectType: "NONE",
          active: true,
        },
      });

      await tx.qualityCheck.update({
        where: { id: check.id },
        data: { lotId: lot.id },
      });

      await applyStockMovement(tx, {
        lotId: lot.id,
        type: StockMovementType.IN,
        quantity: qty,
        referenceType: "QualityCheck",
        referenceId: check.id,
        notes: "QC pass inward",
        createdById: input.userId,
      });

      const programQty = await tx.millProgram.findUnique({
        where: { id: program.id },
        select: {
          greyOrder: { select: { quantity: true, unit: true } },
          inwards: { select: { quantity: true } },
        },
      });
      const remaining = programQty
        ? programQtySummary(programQty).remaining
        : null;
      const pendingQc = await countPendingInwardQc(tx, program.id);
      if (pendingQc === 0 && (remaining == null || remaining <= 0)) {
        await tx.millProgram.update({
          where: { id: program.id },
          data: { status: "CLOSED" },
        });
      } else {
        await tx.millProgram.update({
          where: { id: program.id },
          data: { status: "RETURNED" },
        });
      }
    }

    return check;
  });

  if (!input.passed) {
    await openMillReturnAndNotify({
      millInwardId: inward.id,
      qualityCheckId: qc.id,
      source: "PROGRAM",
      defectType: input.defectType,
      checklistMill: input.checklistMill,
      checklistWeaver: input.checklistWeaver,
      checklistDying: input.checklistDying,
      checklistMinor: input.checklistMinor,
      severity: input.severity,
      remarks: input.remarks,
      forAnyDefect: true,
    });
  }
}

async function submitLegacyLotQc(input: {
  userId: string;
  lotId: string;
  passed: boolean;
  grade: QualityGrade;
  remarks: string | null;
  severity: DefectSeverity | null;
  defectType: "NONE" | "MILL" | "WEAVER" | "DYEING" | "MINOR";
  checklistWeaver: boolean;
  checklistMill: boolean;
  checklistDying: boolean;
  checklistMinor: boolean;
}) {
  const lot = await prisma.lot.findUniqueOrThrow({
    where: { id: input.lotId },
  });

  if (lot.origin !== "PROGRAM") {
    throw new Error("Program QC only — use Goods return for MCSR lots");
  }

  const qc = await prisma.$transaction(async (tx) => {
    const check = await tx.qualityCheck.create({
      data: {
        lotId: input.lotId,
        inspectorId: input.userId,
        passed: input.passed,
        defectType: input.defectType,
        severity: input.severity,
        grade: input.passed ? input.grade : "REJECT",
        remarks: input.remarks,
        checklistWeaver: input.checklistWeaver,
        checklistMill: input.checklistMill,
        checklistDying: input.checklistDying,
        checklistMinor: input.checklistMinor,
      },
    });

    if (input.passed) {
      await applyStockMovement(tx, {
        lotId: input.lotId,
        type: StockMovementType.IN,
        quantity: lot.quantity,
        referenceType: "QualityCheck",
        referenceId: input.lotId,
        notes: "QC pass inward",
        createdById: input.userId,
      });
      await tx.lot.update({
        where: { id: input.lotId },
        data: {
          qualityGrade: input.grade,
          defectType: "NONE",
          active: true,
        },
      });
      if (lot.programId) {
        const program = await tx.millProgram.findUnique({
          where: { id: lot.programId },
          select: {
            greyOrder: { select: { quantity: true, unit: true } },
            inwards: { select: { quantity: true } },
          },
        });
        const remaining = program
          ? programQtySummary(program).remaining
          : null;
        const pendingQc = await countPendingInwardQc(tx, lot.programId);
        if (
          pendingQc === 0 &&
          (remaining == null || remaining <= 0)
        ) {
          await tx.millProgram.update({
            where: { id: lot.programId },
            data: { status: "CLOSED" },
          });
        }
      }
    } else {
      await tx.lot.update({
        where: { id: input.lotId },
        data: {
          defectType: input.defectType,
          qualityGrade: "REJECT",
          returnPriority: input.severity,
          active: input.defectType === "WEAVER" || input.checklistWeaver,
        },
      });
    }

    return check;
  });

  if (!input.passed) {
    await openMillReturnAndNotify({
      lotId: input.lotId,
      qualityCheckId: qc.id,
      source: "PROGRAM",
      defectType: input.defectType,
      checklistMill: input.checklistMill,
      checklistWeaver: input.checklistWeaver,
      checklistDying: input.checklistDying,
      checklistMinor: input.checklistMinor,
      severity: input.severity,
      remarks: input.remarks,
      forAnyDefect: true,
    });
  }
}
