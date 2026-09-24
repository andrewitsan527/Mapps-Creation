export function programQtySummary(input: {
  greyOrder?: { quantity: { toString(): string } | number | string | null; unit: string } | null;
  inwards: { quantity: { toString(): string } | number | string }[];
}) {
  const unit = input.greyOrder?.unit || "m";
  const plannedRaw = input.greyOrder?.quantity;
  const planned =
    plannedRaw == null || plannedRaw === ""
      ? null
      : Number(typeof plannedRaw === "object" ? plannedRaw.toString() : plannedRaw);
  const received = input.inwards.reduce((sum, row) => {
    const n = Number(
      typeof row.quantity === "object" ? row.quantity.toString() : row.quantity,
    );
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const remaining =
    planned != null && Number.isFinite(planned)
      ? Math.max(0, planned - received)
      : null;
  return { unit, planned, received, remaining };
}

/** Mill inward with no QualityCheck row. Lot/stock is not proof of inspection. */
export async function countPendingInwardQc(
  db: {
    millInward: {
      count: (args: {
        where: { programId: string; qualityChecks: { none: object } };
      }) => Promise<number>;
    };
  },
  programId: string,
) {
  return db.millInward.count({
    where: { programId, qualityChecks: { none: {} } },
  });
}
