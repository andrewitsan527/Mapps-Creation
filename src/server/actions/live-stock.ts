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

export type SelectableStockRoll = {
  id: string;
  rollNo: string;
  finishedKg: string | null;
  qualityState: string;
  reference: string;
};

type CodeLine = {
  qcId: string;
  finishedWorkEntryRollId: string | null;
  codeNo: string;
};

function pairKey(qcId: string, rollId: string) {
  return `${qcId}\u0000${rollId}`;
}

/** Exact trimmed code, or null when the QC lines disagree. Missing lines stay unset. */
function codesByStockPair(lines: CodeLine[]) {
  const codeByPair = new Map<string, string | null>();
  for (const line of lines) {
    if (!line.finishedWorkEntryRollId) continue;
    const key = pairKey(line.qcId, line.finishedWorkEntryRollId);
    const code = line.codeNo.trim();
    const previous = codeByPair.get(key);
    if (previous === undefined) codeByPair.set(key, code);
    else if (previous !== code) codeByPair.set(key, null);
  }
  return codeByPair;
}

function settledCode(
  codes: Map<string, string | null>,
  qcId: string,
  rollId: string | null,
) {
  if (!rollId) return "";
  const value = codes.get(pairKey(qcId, rollId));
  return value?.trim() ? value.trim() : "";
}

function stockReference(qcSrNo: string, challanNo: string, finishedSrNo: string) {
  const parts: string[] = [];
  if (qcSrNo.trim()) parts.push(`QC ${qcSrNo.trim()}`);
  if (challanNo.trim()) parts.push(challanNo.trim());
  else if (finishedSrNo.trim()) parts.push(finishedSrNo.trim());
  return parts.join(" · ");
}

function rollOrder(a: string, b: string) {
  const left = a.trim();
  const right = b.trim();
  const leftNo = Number(left);
  const rightNo = Number(right);
  if (left !== "" && right !== "" && Number.isFinite(leftNo) && Number.isFinite(rightNo)) {
    return leftNo - rightNo;
  }
  return left.localeCompare(right, undefined, { numeric: true });
}

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

  const codeByPair = codesByStockPair(lines);

  return rolls.map((roll) => ({
    id: roll.id,
    rollNo: roll.rollNo,
    item: roll.finishedWorkEntryRoll?.line.item?.itemName.trim() ?? "",
    code: settledCode(codeByPair, roll.qualityCheckEntryId, roll.finishedWorkEntryRollId),
    colour: roll.colour,
    finishedKg: roll.finishedWorkEntryRoll ? roll.finishedWorkEntryRoll.finishedKg.toString() : null,
    qualityState: roll.qualityState,
    status: roll.status,
  }));
}

export async function listSelectableStockRolls(input: {
  itemId: string;
  colourCode: string;
  billId?: string;
}): Promise<SelectableStockRoll[]> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const itemId = input.itemId.trim();
  const colourCode = input.colourCode.trim();
  const billId = input.billId?.trim() ?? "";
  if (!itemId || !colourCode) return [];

  const rolls = await prisma.liveStockRoll.findMany({
    where: {
      finishedWorkEntryRoll: { line: { itemId } },
      OR: [
        { status: "available" },
        ...(billId
          ? [{ salesRolls: { some: { line: { billId } } } }]
          : []),
      ],
    },
    select: {
      id: true,
      rollNo: true,
      qualityState: true,
      qualityCheckEntryId: true,
      finishedWorkEntryRollId: true,
      qualityCheckEntry: { select: { srNo: true } },
      finishedWorkEntryRoll: {
        select: {
          finishedKg: true,
          line: {
            select: {
              entry: { select: { srNo: true, challanNo: true } },
            },
          },
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
  const codeByPair = codesByStockPair(lines);

  return rolls
    .filter(
      (roll) =>
        settledCode(codeByPair, roll.qualityCheckEntryId, roll.finishedWorkEntryRollId) ===
        colourCode,
    )
    .map((roll) => {
      const finished = roll.finishedWorkEntryRoll;
      return {
        id: roll.id,
        rollNo: roll.rollNo,
        finishedKg: finished ? finished.finishedKg.toString() : null,
        qualityState: roll.qualityState,
        reference: stockReference(
          roll.qualityCheckEntry.srNo,
          finished?.line.entry.challanNo ?? "",
          finished?.line.entry.srNo ?? "",
        ),
      };
    })
    .sort((a, b) => rollOrder(a.rollNo, b.rollNo) || a.id.localeCompare(b.id));
}
