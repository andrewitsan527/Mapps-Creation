import type { DefectSeverity, DefectType, LotOrigin, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextMillRfNo } from "@/lib/doc-numbers";
import {
  colorScheme,
  finishNameOf,
  formatDec,
  goodsDescription,
  millNameOf,
  rollsDetailText,
  weaverNameOf,
  type LotGoods,
} from "@/server/domain/goods";
import { sendWhatsApp } from "@/server/whatsapp";

export const MILL_RETURN_SLA_MS = 24 * 60 * 60 * 1000;

export const lotForMillReturnInclude = {
  fabricType: { select: { name: true } },
  shade: {
    select: {
      name: true,
      code: true,
      colorFamily: { select: { name: true } },
    },
  },
  finishType: { select: { name: true } },
  mill: { select: { id: true, name: true, whatsapp: true, phone: true } },
  weaver: { select: { id: true, name: true, whatsapp: true, phone: true } },
  millMarka: { select: { code: true, label: true } },
  program: {
    select: {
      programNo: true,
      finishType: { select: { name: true } },
      mill: { select: { id: true, name: true, whatsapp: true, phone: true } },
      weaver: { select: { id: true, name: true, whatsapp: true, phone: true } },
    },
  },
  rolls: {
    select: {
      rollNo: true,
      lengthM: true,
      weightKg: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.LotInclude;

export type LotForMillReturn = Prisma.LotGetPayload<{
  include: typeof lotForMillReturnInclude;
}>;

export function primaryDefectFromChecklist(input: {
  checklistMill: boolean;
  checklistWeaver: boolean;
  checklistDying: boolean;
  checklistMinor: boolean;
}): DefectType {
  if (input.checklistMill) return "MILL";
  if (input.checklistWeaver) return "WEAVER";
  if (input.checklistDying) return "DYEING";
  if (input.checklistMinor) return "MINOR";
  return "NONE";
}

export function defectFlagsLabel(input: {
  checklistMill: boolean;
  checklistWeaver: boolean;
  checklistDying: boolean;
  checklistMinor: boolean;
  defectType?: DefectType | null;
}): string {
  const flags: string[] = [];
  if (input.checklistMill) flags.push("Mill");
  if (input.checklistWeaver) flags.push("Weaver");
  if (input.checklistDying) flags.push("Dyeing");
  if (input.checklistMinor) flags.push("Minor");
  if (flags.length === 0 && input.defectType && input.defectType !== "NONE") {
    return input.defectType;
  }
  return flags.length > 0 ? flags.join(", ") : "None";
}

/** Full fabric / goods message for mill RF WhatsApp. */
export function formatMillRfWhatsAppBody(input: {
  rfNo: string;
  lot: LotGoods;
  defects: string;
  severity?: DefectSeverity | string | null;
  remarks?: string | null;
  dueAt: Date;
  source: LotOrigin | string;
  markaPhotoUrl?: string | null;
}): string {
  const lot = input.lot;
  const lines = [
    `Mapps Creation — Mill RF ${input.rfNo}`,
    `Source: ${input.source === "SALES_RETURN" ? "Goods return QC" : "Program QC"}`,
    `Lot: ${lot.lotNumber}`,
    `Fabric: ${lot.fabricType.name}`,
    `Colour: ${colorScheme(lot)}`,
    finishNameOf(lot) !== "—" ? `Finish: ${finishNameOf(lot)}` : null,
    formatDec(lot.width) !== "—" ? `Width: ${formatDec(lot.width)}"` : null,
    formatDec(lot.gsm) !== "—" ? `GSM: ${formatDec(lot.gsm)}` : null,
    `Length: ${formatDec(lot.lengthM ?? lot.quantity)} ${lot.unit}`,
    formatDec(lot.weightKg) !== "—"
      ? `Weight: ${formatDec(lot.weightKg)} kg`
      : null,
    `Rolls: ${lot.rollCount ?? 1} (${rollsDetailText(lot)})`,
    millNameOf(lot) !== "—" ? `Mill: ${millNameOf(lot)}` : null,
    weaverNameOf(lot) !== "—" ? `Weaver: ${weaverNameOf(lot)}` : null,
    lot.marka ? `Marka: ${lot.marka}` : null,
    `Defects: ${input.defects}`,
    input.severity ? `Priority: ${input.severity}` : null,
    input.remarks ? `Remarks: ${input.remarks}` : null,
    `Send-by (SLA): ${input.dueAt.toLocaleString("en-IN")}`,
    input.markaPhotoUrl ? `Marka photo: ${input.markaPhotoUrl}` : null,
    "",
    goodsDescription(lot),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function millContact(lot: LotForMillReturn): {
  millId: string | null;
  whatsapp: string | null;
} {
  const mill = lot.mill ?? lot.program?.mill ?? null;
  return {
    millId: mill?.id ?? lot.millId ?? null,
    whatsapp: mill?.whatsapp ?? mill?.phone ?? null,
  };
}

/**
 * Create RF + WhatsApp mill when QC finds defects that must return to mill.
 * Always opens RF for MILL defect; also opens for any defect when `force` is true.
 * SLA dueAt = qcAt + 1 day.
 */
export async function openMillReturnAndNotify(input: {
  lotId: string;
  qualityCheckId: string;
  source: LotOrigin;
  defectType: DefectType;
  checklistMill: boolean;
  checklistWeaver: boolean;
  checklistDying: boolean;
  checklistMinor: boolean;
  severity?: DefectSeverity | null;
  remarks?: string | null;
  markaPhotoUrl?: string | null;
  /** Open RF for non-mill defects too (1-day send-to-mill window). */
  forAnyDefect?: boolean;
}) {
  const shouldOpen =
    input.checklistMill ||
    input.defectType === "MILL" ||
    (input.forAnyDefect && input.defectType !== "NONE");

  if (!shouldOpen) return null;

  const lot = await prisma.lot.findUniqueOrThrow({
    where: { id: input.lotId },
    include: lotForMillReturnInclude,
  });

  const { millId, whatsapp } = millContact(lot);
  if (!millId) {
    throw new Error("Lot has no connected mill — cannot open mill RF");
  }

  const qcAt = new Date();
  const dueAt = new Date(qcAt.getTime() + MILL_RETURN_SLA_MS);
  const rfNo = await nextMillRfNo();
  const defects = defectFlagsLabel(input);
  const goodsSummary = goodsDescription(lot as LotGoods);
  const body = formatMillRfWhatsAppBody({
    rfNo,
    lot: lot as LotGoods,
    defects,
    severity: input.severity,
    remarks: input.remarks,
    dueAt,
    source: input.source,
    markaPhotoUrl: input.markaPhotoUrl,
  });

  const rf = await prisma.millReturn.create({
    data: {
      rfNo,
      lotId: lot.id,
      millId,
      qualityCheckId: input.qualityCheckId,
      source: input.source,
      status: "OPEN",
      qcAt,
      dueAt,
      goodsSummary,
      remarks: input.remarks,
      whatsappSent: false,
    },
  });

  let whatsappSent = false;
  const notifyMillNow =
    input.checklistMill || input.defectType === "MILL";
  if (notifyMillNow && whatsapp) {
    await sendWhatsApp({
      to: whatsapp,
      template: "qc_return",
      entityType: "MillReturn",
      entityId: rf.id,
      variables: {
        rfNo,
        lotNumber: lot.lotNumber,
        defectType: defects,
        severity: String(input.severity ?? "MEDIUM"),
        remarks: input.remarks ?? "-",
        body,
        mill: millNameOf(lot as LotGoods),
        fabric: lot.fabricType.name,
        colour: colorScheme(lot as LotGoods),
        length: `${formatDec(lot.lengthM ?? lot.quantity)} ${lot.unit}`,
        dueAt: dueAt.toLocaleString("en-IN"),
      },
      mediaUrl: input.markaPhotoUrl ?? undefined,
    });
    whatsappSent = true;
    await prisma.millReturn.update({
      where: { id: rf.id },
      data: { whatsappSent: true },
    });
    await prisma.qualityCheck.update({
      where: { id: input.qualityCheckId },
      data: { whatsappSent: true },
    });
  }

  return { rf, whatsappSent, dueAt };
}

/** Mark RF sent (physical dispatch to mill) and optionally re-notify. */
export async function markMillReturnSent(input: {
  lotId: string;
  remarks?: string | null;
  resendWhatsApp?: boolean;
}) {
  const open = await prisma.millReturn.findFirst({
    where: { lotId: input.lotId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      mill: { select: { whatsapp: true, phone: true, name: true } },
      lot: { include: lotForMillReturnInclude },
    },
  });

  if (open) {
    await prisma.millReturn.update({
      where: { id: open.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        remarks: input.remarks ?? open.remarks,
      },
    });

    if (input.resendWhatsApp) {
      const to = open.mill.whatsapp ?? open.mill.phone;
      if (to) {
        const body = formatMillRfWhatsAppBody({
          rfNo: open.rfNo,
          lot: open.lot as LotGoods,
          defects: open.lot.defectType,
          severity: open.lot.returnPriority,
          remarks: input.remarks ?? open.remarks,
          dueAt: open.dueAt,
          source: open.source,
        });
        await sendWhatsApp({
          to,
          template: "qc_return",
          entityType: "MillReturn",
          entityId: open.id,
          variables: {
            rfNo: open.rfNo,
            lotNumber: open.lot.lotNumber,
            defectType: open.lot.defectType,
            remarks: input.remarks ?? "Goods sent to mill",
            body,
            status: "SENT",
          },
        });
        await prisma.millReturn.update({
          where: { id: open.id },
          data: { whatsappSent: true },
        });
      }
    }
    return open;
  }

  // Fallback: no RF yet — open one as SENT after notifying
  const lot = await prisma.lot.findUniqueOrThrow({
    where: { id: input.lotId },
    include: lotForMillReturnInclude,
  });
  const { millId, whatsapp } = millContact(lot);
  if (!millId) throw new Error("No mill on lot");

  const qcAt = new Date();
  const dueAt = new Date(qcAt.getTime() + MILL_RETURN_SLA_MS);
  const rfNo = await nextMillRfNo();
  const rf = await prisma.millReturn.create({
    data: {
      rfNo,
      lotId: lot.id,
      millId,
      source: lot.origin,
      status: "SENT",
      qcAt,
      dueAt,
      sentAt: qcAt,
      goodsSummary: goodsDescription(lot as LotGoods),
      remarks: input.remarks,
      whatsappSent: false,
    },
  });

  if (whatsapp) {
    const body = formatMillRfWhatsAppBody({
      rfNo,
      lot: lot as LotGoods,
      defects: "MILL",
      remarks: input.remarks,
      dueAt,
      source: lot.origin,
    });
    await sendWhatsApp({
      to: whatsapp,
      template: "qc_return",
      entityType: "MillReturn",
      entityId: rf.id,
      variables: {
        rfNo,
        lotNumber: lot.lotNumber,
        defectType: "MILL",
        remarks: input.remarks ?? "Return to mill",
        body,
      },
    });
    await prisma.millReturn.update({
      where: { id: rf.id },
      data: { whatsappSent: true },
    });
  }

  return rf;
}
