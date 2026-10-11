"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type LiveStockRollRow = {
  id: string;
  rollNo: string;
  item: string;
  /** Trimmed QC snapshot. Empty means the code is unresolved. */
  code: string;
  colour: string;
  /** Finished kilograms from the related roll. Null when that roll is missing. */
  finishedKg: string | null;
  qualityState: string;
  status: string;
};

export async function listLiveStock(): Promise<LiveStockRollRow[]> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const rolls = await prisma.liveStockRoll.findMany({
    where: { status: "available" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      rollNo: true,
      colour: true,
      status: true,
      qualityState: true,
      qualityCheckEntryId: true,
      finishedWorkEntryRollId: true,
      finishedWorkEntryRoll: {
        select: {
          finishedKg: true,
          line: { select: { item: { select: { itemName: true } } } },
        },
      },
    },
  });

  const qcIds = [...new Set(rolls.map((roll) => roll.qualityCheckEntryId))];
  const rollIds = [
    ...new Set(
      rolls
        .map((roll) => roll.finishedWorkEntryRollId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const lines =
    qcIds.length === 0 || rollIds.length === 0
      ? []
      : await prisma.qualityCheckEntryLine.findMany({
          where: {
            qcId: { in: qcIds },
            finishedWorkEntryRollId: { in: rollIds },
          },
          select: { qcId: true, finishedWorkEntryRollId: true, codeNo: true },
        });

  const codeByPair = new Map<string, string | null>();
  for (const line of lines) {
    if (!line.finishedWorkEntryRollId) continue;
    const key = `${line.qcId}\u0000${line.finishedWorkEntryRollId}`;
    const code = line.codeNo.trim();
    const previous = codeByPair.get(key);
    if (previous === undefined) codeByPair.set(key, code);
    else if (previous !== code) codeByPair.set(key, null);
  }

  return rolls.map((roll) => {
    const pair = roll.finishedWorkEntryRollId
      ? codeByPair.get(`${roll.qualityCheckEntryId}\u0000${roll.finishedWorkEntryRollId}`)
      : undefined;
    return {
      id: roll.id,
      rollNo: roll.rollNo,
      item: roll.finishedWorkEntryRoll?.line.item?.itemName.trim() ?? "",
      code: pair?.trim() ? pair.trim() : "",
      colour: roll.colour,
      finishedKg: roll.finishedWorkEntryRoll ? roll.finishedWorkEntryRoll.finishedKg.toString() : null,
      qualityState: roll.qualityState,
      status: roll.status,
    };
  });
}
