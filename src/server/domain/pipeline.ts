import { cache } from "react";
import { prisma } from "@/lib/db";
import type { ShellFlow } from "@/lib/shell-flow";

export type StageSnapshot = {
  /** Items waiting for action at this stage. */
  queue: number;
  /** Subset of the queue that has breached its SLA / due date. */
  alert: number;
};

export type PipelineSnapshot = ShellFlow;

/**
 * One batched read of every "work waiting here" queue in the order-to-cash
 * chain. Counts only — safe to call from any server component.
 *
 * Deduped per request so the shell and the page it renders share one round
 * trip to the database.
 */
export const getPipelineSnapshot = cache(async function getPipelineSnapshot(
  now = new Date(),
): Promise<PipelineSnapshot> {
  const [
    greyOpen,
    greyUnprogrammed,
    programsDraft,
    programsAtMill,
    qcPending,
    qcFailedNoRf,
    stockActive,
    stockReserved,
    provisionalOpen,
    awaitingDelivery,
    dispatchedUnpaidApprox,
    overdueApprox,
    millRfOpen,
    millRfOverdue,
    weaverHigh,
    grQcPending,
  ] = await Promise.all([
    prisma.greyPurchaseOrder.count({ where: { status: "OPEN" } }),
    prisma.greyPurchaseOrder.count({
      where: { status: "OPEN", programs: { none: {} } },
    }),
    prisma.millProgram.count({ where: { status: "DRAFT" } }),
    prisma.millProgram.count({
      where: {
        status: { in: ["SENT_TO_MILL", "IN_PROCESS"] },
        lots: { none: {} },
      },
    }),
    prisma.lot.count({
      where: {
        origin: "PROGRAM",
        movements: { none: {} },
        qualityChecks: { none: {} },
      },
    }),
    prisma.lot.count({
      where: { qualityGrade: "REJECT", millReturns: { none: {} } },
    }),
    prisma.lot.count({ where: { active: true } }),
    prisma.lot.count({ where: { active: true, reserved: { gt: 0 } } }),
    prisma.saleBill.count({
      where: { type: "PROVISIONAL", status: "ISSUED" },
    }),
    prisma.saleBill.count({
      where: {
        type: "SALE",
        status: "ISSUED",
        dispatches: { none: { status: "DISPATCHED" } },
      },
    }),
    prisma.saleBill.count({
      where: {
        type: "SALE",
        status: "ISSUED",
        dispatches: { some: { status: "DISPATCHED" } },
      },
    }),
    prisma.saleBill.count({
      where: {
        type: "SALE",
        status: "ISSUED",
        creditStartsAt: { not: null },
        dueDate: { lt: now },
        dispatches: { some: { status: "DISPATCHED" } },
      },
    }),
    prisma.millReturn.count({ where: { status: "OPEN" } }),
    prisma.millReturn.count({
      where: { status: "OPEN", dueAt: { lt: now } },
    }),
    prisma.lot.count({
      where: {
        defectType: "WEAVER",
        OR: [{ returnPriority: "HIGH" }, { qualityGrade: "REJECT" }],
      },
    }),
    prisma.salesReturn.count({ where: { status: "PENDING_QC" } }),
  ]);

  return {
    grey: { queue: greyOpen, alert: greyUnprogrammed },
    program: { queue: programsAtMill + programsDraft, alert: programsDraft },
    qc: { queue: qcPending + grQcPending, alert: qcFailedNoRf },
    stock: { queue: stockActive, alert: stockReserved },
    sale: { queue: provisionalOpen, alert: 0 },
    delivery: { queue: awaitingDelivery, alert: 0 },
    payment: { queue: dispatchedUnpaidApprox, alert: overdueApprox },
    millRfOpen,
    millRfOverdue,
    weaverHigh,
    grQcPending,
  };
});
