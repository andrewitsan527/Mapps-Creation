import {
  Prisma,
  StockMovementType,
  type PrismaClient,
} from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function toDecimal(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value.toString());
}

/** Live availability for a single lot: onHand - reserved */
export function lotAvailable(onHand: Prisma.Decimal | number, reserved: Prisma.Decimal | number) {
  return toDecimal(onHand).minus(toDecimal(reserved));
}

/**
 * Append-only stock movement that keeps Lot.onHand / Lot.reserved in sync.
 * Always call inside a transaction for multi-step bill/dispatch flows.
 */
export async function applyStockMovement(
  db: Db,
  input: {
    lotId: string;
    type: StockMovementType;
    quantity: number | string | Prisma.Decimal;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdById?: string;
  },
) {
  const qty = toDecimal(input.quantity);
  if (qty.lte(0)) {
    throw new Error("Stock movement quantity must be positive");
  }

  const lot = await db.lot.findUniqueOrThrow({ where: { id: input.lotId } });
  let onHand = toDecimal(lot.onHand);
  let reserved = toDecimal(lot.reserved);

  switch (input.type) {
    case "IN":
    case "RETURN":
      onHand = onHand.plus(qty);
      break;
    case "OUT": {
      const available = onHand.minus(reserved);
      if (available.lt(qty)) {
        throw new Error(`Insufficient available stock on lot ${lot.lotNumber}`);
      }
      onHand = onHand.minus(qty);
      break;
    }
    case "RESERVE": {
      const available = onHand.minus(reserved);
      if (available.lt(qty)) {
        throw new Error(`Cannot reserve — only ${available} available on ${lot.lotNumber}`);
      }
      reserved = reserved.plus(qty);
      break;
    }
    case "RELEASE": {
      if (reserved.lt(qty)) {
        throw new Error(`Cannot release more than reserved on ${lot.lotNumber}`);
      }
      reserved = reserved.minus(qty);
      break;
    }
    case "ADJUST":
      // ADJUST quantity is the new onHand target delta: notes should explain; positive = add
      onHand = onHand.plus(qty);
      break;
    default:
      throw new Error(`Unsupported movement type: ${input.type}`);
  }

  if (onHand.lt(0) || reserved.lt(0) || reserved.gt(onHand)) {
    throw new Error("Stock state would become invalid");
  }

  await db.stockMovement.create({
    data: {
      lotId: input.lotId,
      type: input.type,
      quantity: qty,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
      createdById: input.createdById,
    },
  });

  return db.lot.update({
    where: { id: input.lotId },
    data: { onHand, reserved },
  });
}

/** Aggregate live stock by fabric + shade (+ optional GSM/width filters). */
export async function getAvailability(
  db: Db,
  filters: {
    fabricTypeId?: string;
    shadeId?: string;
    colorFamilyId?: string;
    gsm?: number;
    width?: number;
    qualityGrade?: string;
    godownId?: string;
  },
) {
  const lots = await db.lot.findMany({
    where: {
      active: true,
      ...(filters.fabricTypeId ? { fabricTypeId: filters.fabricTypeId } : {}),
      ...(filters.shadeId ? { shadeId: filters.shadeId } : {}),
      ...(filters.godownId ? { godownId: filters.godownId } : {}),
      ...(filters.qualityGrade
        ? { qualityGrade: filters.qualityGrade as never }
        : {}),
      ...(filters.colorFamilyId
        ? { shade: { colorFamilyId: filters.colorFamilyId } }
        : {}),
      ...(filters.gsm != null ? { gsm: filters.gsm } : {}),
      ...(filters.width != null ? { width: filters.width } : {}),
    },
    include: {
      fabricType: true,
      shade: { include: { colorFamily: true } },
      godown: true,
      location: true,
    },
    orderBy: [{ fabricType: { name: "asc" } }, { shade: { name: "asc" } }],
  });

  const groups = new Map<
    string,
    {
      fabricTypeId: string;
      fabricTypeName: string;
      shadeId: string;
      shadeName: string;
      colorFamilyName: string;
      gsm: string | null;
      width: string | null;
      unit: string;
      onHand: Prisma.Decimal;
      reserved: Prisma.Decimal;
      available: Prisma.Decimal;
      lots: typeof lots;
    }
  >();

  for (const lot of lots) {
    const key = [
      lot.fabricTypeId,
      lot.shadeId,
      lot.gsm?.toString() ?? "",
      lot.width?.toString() ?? "",
      lot.unit,
    ].join("|");

    const existing = groups.get(key);
    const onHand = toDecimal(lot.onHand);
    const reserved = toDecimal(lot.reserved);
    const available = onHand.minus(reserved);

    if (!existing) {
      groups.set(key, {
        fabricTypeId: lot.fabricTypeId,
        fabricTypeName: lot.fabricType.name,
        shadeId: lot.shadeId,
        shadeName: lot.shade.name,
        colorFamilyName: lot.shade.colorFamily.name,
        gsm: lot.gsm?.toString() ?? null,
        width: lot.width?.toString() ?? null,
        unit: lot.unit,
        onHand,
        reserved,
        available,
        lots: [lot],
      });
    } else {
      existing.onHand = existing.onHand.plus(onHand);
      existing.reserved = existing.reserved.plus(reserved);
      existing.available = existing.available.plus(available);
      existing.lots.push(lot);
    }
  }

  return Array.from(groups.values()).map((g) => ({
    ...g,
    onHand: g.onHand.toNumber(),
    reserved: g.reserved.toNumber(),
    available: g.available.toNumber(),
  }));
}
