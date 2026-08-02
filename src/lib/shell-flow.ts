import type { StageKey } from "@/lib/flow";

/** Lightweight shape the shell needs — keep out of Prisma modules for client safety. */
export type ShellFlow = Record<StageKey, { queue: number; alert: number }> & {
  millRfOpen: number;
  millRfOverdue: number;
  weaverHigh: number;
  grQcPending: number;
};
