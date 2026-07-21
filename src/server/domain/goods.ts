import type { Decimal } from "@prisma/client/runtime/library";

export const lotGoodsInclude = {
  fabricType: { select: { id: true, name: true } },
  shade: {
    select: {
      id: true,
      name: true,
      code: true,
      colorFamily: { select: { id: true, name: true } },
    },
  },
  finishType: { select: { id: true, name: true } },
  mill: { select: { id: true, name: true, whatsapp: true } },
  weaver: { select: { id: true, name: true, whatsapp: true } },
  program: {
    select: {
      id: true,
      programNo: true,
      width: true,
      gsm: true,
      finishType: { select: { name: true } },
      mill: { select: { id: true, name: true } },
      weaver: { select: { id: true, name: true } },
    },
  },
  rolls: {
    select: {
      id: true,
      rollNo: true,
      lengthM: true,
      weightKg: true,
      notes: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export type LotGoods = {
  lotNumber: string;
  rollNumber?: string | null;
  marka?: string | null;
  width?: Decimal | number | string | null;
  gsm?: Decimal | number | string | null;
  quantity: Decimal | number | string;
  lengthM?: Decimal | number | string | null;
  weightKg?: Decimal | number | string | null;
  rollCount?: number | null;
  unit: string;
  qualityGrade?: string | null;
  origin?: string | null;
  returnPriority?: string | null;
  fabricType: { name: string };
  shade: {
    name: string;
    code?: string | null;
    colorFamily: { name: string };
  };
  finishType?: { name: string } | null;
  mill?: { name: string } | null;
  weaver?: { name: string } | null;
  program?: {
    programNo: string;
    finishType?: { name: string } | null;
    mill?: { name: string } | null;
    weaver?: { name: string } | null;
  } | null;
  rolls?: Array<{
    rollNo: string;
    lengthM: Decimal | number | string;
    weightKg?: Decimal | number | string | null;
  }>;
};

type DecLike = Decimal | number | string | { toString(): string } | null | undefined;

function num(v: DecLike): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(typeof v === "object" ? v.toString() : v);
  return Number.isFinite(n) ? n : null;
}

export function formatDec(v: DecLike, digits = 2): string {
  const n = num(v);
  if (n === null) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function rollsDetailText(lot: LotGoods): string {
  if (lot.rolls && lot.rolls.length > 0) {
    return lot.rolls
      .map((r) => {
        const w = num(r.weightKg);
        return w !== null
          ? `${r.rollNo}:${formatDec(r.lengthM)}m/${formatDec(w)}kg`
          : `${r.rollNo}:${formatDec(r.lengthM)}m`;
      })
      .join(", ");
  }
  if (lot.rollNumber) return lot.rollNumber;
  return `${lot.rollCount ?? 1} roll(s)`;
}

export function colorScheme(lot: LotGoods): string {
  return `${lot.shade.colorFamily.name} / ${lot.shade.name}${
    lot.shade.code ? ` (${lot.shade.code})` : ""
  }`;
}

export function millNameOf(lot: LotGoods): string {
  return lot.mill?.name ?? lot.program?.mill?.name ?? "—";
}

export function weaverNameOf(lot: LotGoods): string {
  return lot.weaver?.name ?? lot.program?.weaver?.name ?? "—";
}

export function finishNameOf(lot: LotGoods): string {
  return lot.finishType?.name ?? lot.program?.finishType?.name ?? "—";
}

/** One-line goods identity for dropdowns and compact lists. */
export function lotLabel(lot: LotGoods, available?: number | string | null): string {
  const avail =
    available !== undefined && available !== null
      ? ` · avail ${formatDec(available)}`
      : "";
  const returnTag =
    lot.origin === "SALES_RETURN"
      ? `GR${lot.qualityGrade ? `-${lot.qualityGrade}` : ""}${
          lot.returnPriority ? `/${lot.returnPriority}` : ""
        }`
      : lot.qualityGrade && lot.qualityGrade !== "A"
        ? `grade ${lot.qualityGrade}`
        : null;
  return [
    lot.lotNumber,
    returnTag,
    lot.fabricType.name,
    colorScheme(lot),
    `${formatDec(lot.lengthM ?? lot.quantity)}m`,
    `${lot.rollCount ?? 1}r`,
    millNameOf(lot) !== "—" ? `mill ${millNameOf(lot)}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
    .concat(avail);
}

/** Multi-line description frozen onto a bill line. */
export function goodsDescription(lot: LotGoods): string {
  const parts = [
    `Lot ${lot.lotNumber}`,
    lot.fabricType.name,
    colorScheme(lot),
    finishNameOf(lot) !== "—" ? `Finish ${finishNameOf(lot)}` : null,
    num(lot.width) !== null ? `W ${formatDec(lot.width)}"` : null,
    num(lot.gsm) !== null ? `GSM ${formatDec(lot.gsm)}` : null,
    `Len ${formatDec(lot.lengthM ?? lot.quantity)} ${lot.unit}`,
    num(lot.weightKg) !== null ? `Wt ${formatDec(lot.weightKg)} kg` : null,
    `Rolls ${lot.rollCount ?? 1}`,
    rollsDetailText(lot) ? `Detail ${rollsDetailText(lot)}` : null,
    millNameOf(lot) !== "—" ? `Mill ${millNameOf(lot)}` : null,
    weaverNameOf(lot) !== "—" ? `Weaver ${weaverNameOf(lot)}` : null,
    lot.marka ? `Marka ${lot.marka}` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function snapshotBillLine(lot: LotGoods) {
  return {
    lotNumber: lot.lotNumber,
    fabricName: lot.fabricType.name,
    colorFamily: lot.shade.colorFamily.name,
    shadeName: lot.shade.name,
    shadeCode: lot.shade.code ?? null,
    finishName: finishNameOf(lot) === "—" ? null : finishNameOf(lot),
    millName: millNameOf(lot) === "—" ? null : millNameOf(lot),
    weaverName: weaverNameOf(lot) === "—" ? null : weaverNameOf(lot),
    width: lot.width ?? null,
    gsm: lot.gsm ?? null,
    marka: lot.marka ?? null,
    rollNumber: lot.rollNumber ?? null,
    rollCount: lot.rollCount ?? 1,
    weightKg: lot.weightKg ?? null,
    lengthM: lot.lengthM ?? lot.quantity,
    rollsDetail: rollsDetailText(lot),
    description: goodsDescription(lot),
  };
}

export type BillLineGoods = {
  lotNumber?: string | null;
  fabricName?: string | null;
  colorFamily?: string | null;
  shadeName?: string | null;
  shadeCode?: string | null;
  finishName?: string | null;
  millName?: string | null;
  weaverName?: string | null;
  width?: Decimal | number | string | null;
  gsm?: Decimal | number | string | null;
  marka?: string | null;
  rollNumber?: string | null;
  rollCount?: number | null;
  weightKg?: Decimal | number | string | null;
  lengthM?: Decimal | number | string | null;
  rollsDetail?: string | null;
  description?: string | null;
  quantity: Decimal | number | string;
  unit: string;
  rate?: Decimal | number | string | null;
  amount?: Decimal | number | string | null;
};

export function formatBillWhatsAppBody(input: {
  billNo: string;
  partyName: string;
  total: Decimal | number | string;
  lines: BillLineGoods[];
  vehicleNo?: string | null;
}): string {
  const lines = input.lines
    .map((l, i) => {
      const color = [l.colorFamily, l.shadeName].filter(Boolean).join("/");
      return [
        `${i + 1}. ${l.lotNumber ?? "Lot"}`,
        l.fabricName,
        color || null,
        l.finishName ? `Finish ${l.finishName}` : null,
        num(l.width) !== null ? `W ${formatDec(l.width)}` : null,
        num(l.gsm) !== null ? `GSM ${formatDec(l.gsm)}` : null,
        `Qty ${formatDec(l.quantity)} ${l.unit}`,
        l.rollCount ? `${l.rollCount} rolls` : null,
        l.rollsDetail ? `(${l.rollsDetail})` : null,
        l.millName ? `Mill ${l.millName}` : null,
        l.weaverName ? `Weaver ${l.weaverName}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    })
    .join("\n");

  return [
    `Sale bill ${input.billNo}`,
    `Party: ${input.partyName}`,
    input.vehicleNo ? `Vehicle: ${input.vehicleNo}` : null,
    "",
    "Goods:",
    lines,
    "",
    `Total: ₹${formatDec(input.total)}`,
  ]
    .filter((x) => x !== null)
    .join("\n");
}

/** Parse "45, 48.5, 50" or "R1:45, R2:48" into roll rows. */
export function parseRollLengths(raw: string): Array<{
  rollNo: string;
  lengthM: string;
}> {
  const text = raw.trim();
  if (!text) return [];

  return text
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, idx) => {
      const labeled = part.match(/^([^:]+)\s*:\s*([\d.]+)$/);
      if (labeled) {
        return { rollNo: labeled[1].trim(), lengthM: labeled[2] };
      }
      return { rollNo: `R${idx + 1}`, lengthM: part };
    });
}
