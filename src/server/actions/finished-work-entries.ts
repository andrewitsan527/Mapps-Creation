"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type FinishedWorkRollRecord = {
  id: string;
  greyKg: string;
  finishedKg: string;
};

export type FinishedWorkLineRecord = {
  id: string;
  itemId: string;
  itemName: string;
  lotNo: string;
  rate: string;
  rolls: string;
  greyKg: string;
  finishedKg: string;
  amount: number;
  rollRows: FinishedWorkRollRecord[];
};

export type FinishedWorkRecord = {
  id: string;
  srNo: string;
  date: string;
  millId: string;
  gpNo: string;
  mill: string;
  knitterChallanNo: string;
  challanNo: string;
  lotNo: string;
  item: string;
  rolls: string;
  greyKg: string;
  finishedKg: string;
  rate: string;
  shortageKg: number;
  shortagePct: number;
  amount: number;
  uniformRate: boolean;
  lines: FinishedWorkLineRecord[];
};

export type FinishedWorkLineInput = {
  itemId: string;
  lotNo: string;
  rate: string;
  rollCount: string;
  greyKg: string;
  finishedKg: string;
  rolls: { greyKg: string; finishedKg: string }[];
};

export type FinishedWorkInput = {
  workDate: string;
  millId: string;
  gpNo: string;
  knitterChallanNo: string;
  challanNo: string;
  lines: FinishedWorkLineInput[];
};

export type FinishedWorkSaveResult = {
  record: FinishedWorkRecord;
  linkWarning: string | null;
};

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function asDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Enter date.");
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function decText(value: { toString(): string } | null | undefined) {
  if (value == null) return "";
  return value.toString();
}

function decNum(value: { toString(): string } | null | undefined) {
  return num(decText(value));
}

function itemLabel(items: { item: { itemName: string } | null }[]) {
  return items
    .map((row) => row.item?.itemName.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function calc(greyKg: number, finishedKg: number, rate: number) {
  const shortageKg = greyKg - finishedKg;
  const shortagePct = greyKg > 0 ? (shortageKg / greyKg) * 100 : 0;
  return { shortageKg, shortagePct, amount: finishedKg * rate };
}

const programInclude = {
  mill: { select: { millName: true } },
  millInwardEntry: {
    include: {
      greyBill: { select: { billNo: true, challanNo: true } },
      items: {
        orderBy: { sortOrder: "asc" as const },
        include: { item: { select: { itemName: true } } },
      },
    },
  },
} as const;

type ProgramRow = {
  id: string;
  srNo: string;
  mill: { millName: string } | null;
  millInwardEntry: {
    greyBill: { billNo: string; challanNo: string } | null;
    items: { itemId: string | null; item: { itemName: string } | null }[];
  } | null;
};

function programItems(program: ProgramRow) {
  const seen = new Set<string>();
  const items: { id: string; name: string }[] = [];
  for (const row of program.millInwardEntry?.items ?? []) {
    const name = row.item?.itemName.trim() ?? "";
    if (!row.itemId || !name || seen.has(row.itemId)) continue;
    seen.add(row.itemId);
    items.push({ id: row.itemId, name });
  }
  return items;
}

function programFields(program: ProgramRow) {
  const bill = program.millInwardEntry?.greyBill;
  return {
    programSrNo: program.srNo,
    mill: program.mill?.millName ?? "",
    item: program.millInwardEntry ? itemLabel(program.millInwardEntry.items) : "",
    billNo: bill?.billNo.trim() ?? "",
    billChallan: bill?.challanNo.trim() ?? "",
    items: programItems(program),
  };
}

async function nextSrNo(isoDate: string) {
  const stamp = dateStamp(isoDate);
  const rows = await prisma.finishedWorkEntry.findMany({
    where: { srNo: { endsWith: `-${stamp}` } },
    select: { srNo: true },
  });
  const used = rows
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function lineTouched(line: FinishedWorkLineInput) {
  return Boolean(
    line.itemId.trim() ||
      line.lotNo.trim() ||
      line.rate.trim() ||
      line.rollCount.trim() ||
      line.greyKg.trim() ||
      line.finishedKg.trim() ||
      line.rolls.some((roll) => roll.greyKg.trim() || roll.finishedKg.trim()),
  );
}

function parseKg(raw: string, kind: "grey" | "finished") {
  const label = kind === "grey" ? "Grey KG" : "Finished KG";
  if (!raw.trim()) {
    throw new Error(kind === "grey" ? "Enter grey KG." : "Enter finished KG.");
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return value;
}

type ResolvedLine = {
  itemId: string;
  lotNo: string;
  rate: string;
  rolls: number;
  greyKg: string;
  finishedKg: string;
  amount: string;
  rollRows: { greyKg: string; finishedKg: string }[];
};

async function resolveLines(input: FinishedWorkInput) {
  const active = input.lines.filter(lineTouched);
  const requested = [...new Set(active.map((line) => line.itemId.trim()).filter(Boolean))];
  const found = requested.length
    ? await prisma.item.findMany({
        where: { id: { in: requested } },
        select: { id: true },
      })
    : [];
  const allowed = new Set(found.map((item) => item.id));
  if (active.length === 0) throw new Error("Add at least one item.");

  const lines: ResolvedLine[] = [];
  for (const line of active) {
    if (!line.lotNo.trim()) throw new Error("Enter lot no.");
    if (!line.rate.trim()) throw new Error("Enter rate.");
    const rate = Number(line.rate);
    if (!Number.isFinite(rate) || rate < 0) throw new Error("Rate cannot be negative.");

    const rollRows: { greyKg: string; finishedKg: string }[] = [];
    let greyKg = 0;
    let finishedKg = 0;
    const enteredRolls = line.rolls.some((roll) => roll.greyKg.trim() || roll.finishedKg.trim());
    let rolls = 0;
    if (enteredRolls) {
      for (const roll of line.rolls) {
        if (!roll.greyKg.trim() && !roll.finishedKg.trim()) continue;
        const grey = parseKg(roll.greyKg, "grey");
        const finished = parseKg(roll.finishedKg, "finished");
        if (finished > grey) {
          throw new Error("Finished KG cannot be greater than Grey KG.");
        }
        greyKg += grey;
        finishedKg += finished;
        rollRows.push({ greyKg: String(grey), finishedKg: String(finished) });
      }
      if (rollRows.length === 0) throw new Error("Enter roll details.");
      rolls = rollRows.length;
    } else {
      if (line.rollCount.trim()) {
        const count = Number(line.rollCount);
        if (!Number.isInteger(count) || count < 0) {
          throw new Error("No. of rolls must be a whole number.");
        }
        rolls = count;
      }
      if (line.greyKg.trim()) greyKg = parseKg(line.greyKg, "grey");
      if (line.finishedKg.trim()) finishedKg = parseKg(line.finishedKg, "finished");
      if (finishedKg > greyKg) {
        throw new Error("Finished KG cannot be greater than Grey KG.");
      }
    }
    if (!line.itemId.trim() || !allowed.has(line.itemId)) {
      throw new Error("Select an item.");
    }
    lines.push({
      itemId: line.itemId.trim(),
      lotNo: line.lotNo.trim(),
      rate: String(rate),
      rolls,
      greyKg: String(greyKg),
      finishedKg: String(finishedKg),
      amount: String(finishedKg * rate),
      rollRows,
    });
  }

  const totalGrey = lines.reduce((sum, line) => sum + num(line.greyKg), 0);
  const totalFinished = lines.reduce((sum, line) => sum + num(line.finishedKg), 0);
  const totalAmount = lines.reduce((sum, line) => sum + num(line.amount), 0);
  const shortage = calc(totalGrey, totalFinished, 0);
  const rates = lines.map((line) => num(line.rate));
  const uniform = rates.every((rate) => rate === rates[0]);
  return {
    lines,
    lotNo: lines.map((line) => line.lotNo).join(" · "),
    rolls: lines.reduce((sum, line) => sum + line.rolls, 0),
    greyKg: String(totalGrey),
    finishedKg: String(totalFinished),
    rate: uniform ? lines[0].rate : "0",
    shortageKg: String(shortage.shortageKg),
    shortagePct: String(shortage.shortagePct),
    amount: String(totalAmount),
  };
}

async function resolveMillProgramLink(knitterChallanNo: string, millId: string) {
  const matches = await prisma.millProgramEntry.findMany({
    where: {
      millId,
      millInwardEntry: {
        greyBill: { challanNo: knitterChallanNo },
      },
    },
    select: { id: true },
  });
  if (matches.length === 1) {
    return { millProgramEntryId: matches[0].id, linkWarning: null };
  }
  if (matches.length === 0) {
    return {
      millProgramEntryId: null,
      linkWarning:
        "No Mill Program matched this Knitter Challan No. and mill, so none was linked.",
    };
  }
  return {
    millProgramEntryId: null,
    linkWarning:
      "More than one Mill Program matches this Knitter Challan No. and mill, so none was linked.",
  };
}

async function resolveHeader(input: FinishedWorkInput) {
  if (!input.workDate.trim()) throw new Error("Enter date.");
  if (!input.millId.trim()) throw new Error("Select a mill.");
  const mill = await prisma.mill.findUnique({
    where: { id: input.millId },
    select: { id: true, millName: true },
  });
  if (!mill || !mill.millName.trim()) throw new Error("Select a mill.");
  if (!input.gpNo.trim()) throw new Error("Enter GP No.");
  if (!input.knitterChallanNo.trim()) throw new Error("Enter knitter challan no.");
  if (!input.challanNo.trim()) throw new Error("Enter challan no.");
  return {
    workDate: asDate(input.workDate),
    millId: mill.id,
    gpNo: input.gpNo.trim(),
    knitterChallanNo: input.knitterChallanNo.trim(),
    challanNo: input.challanNo.trim(),
  };
}

function lineCreate(lines: ResolvedLine[]) {
  return lines.map((line, index) => ({
    sortOrder: index,
    itemId: line.itemId || null,
    lotNo: line.lotNo,
    rate: line.rate,
    rolls: line.rolls,
    greyKg: line.greyKg,
    finishedKg: line.finishedKg,
    amount: line.amount,
    rollRows: {
      create: line.rollRows.map((roll, rollIndex) => ({
        sortOrder: rollIndex,
        greyKg: roll.greyKg,
        finishedKg: roll.finishedKg,
      })),
    },
  }));
}

const entryInclude = {
  mill: { select: { millName: true } },
  millProgramEntry: { include: programInclude },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      item: { select: { itemName: true } },
      rollRows: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} as const;

type EntryRow = {
  id: string;
  srNo: string;
  workDate: Date;
  millId: string | null;
  mill: { millName: string } | null;
  millProgramEntryId: string | null;
  gpNo: string;
  knitterChallanNo: string;
  challanNo: string;
  lotNo: string;
  rolls: number;
  greyKg: { toString(): string };
  finishedKg: { toString(): string };
  rate: { toString(): string };
  shortageKg: { toString(): string };
  shortagePct: { toString(): string };
  amount: { toString(): string };
  millProgramEntry: ProgramRow | null;
  lines: {
    id: string;
    itemId: string | null;
    lotNo: string;
    rate: { toString(): string };
    rolls: number;
    greyKg: { toString(): string };
    finishedKg: { toString(): string };
    amount: { toString(): string };
    item: { itemName: string } | null;
    rollRows: {
      id: string;
      greyKg: { toString(): string };
      finishedKg: { toString(): string };
    }[];
  }[];
};

function toRecord(row: EntryRow): FinishedWorkRecord {
  const fields = row.millProgramEntry ? programFields(row.millProgramEntry) : null;
  const lineItem = row.lines
    .map((line) => line.item?.itemName.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
  const lineLot = row.lines
    .map((line) => line.lotNo.trim())
    .filter(Boolean)
    .join(" · ");
  const rates = row.lines.map((line) => decNum(line.rate));
  return {
    id: row.id,
    srNo: row.srNo,
    date: isoDate(row.workDate),
    millId: row.millId ?? "",
    gpNo: row.gpNo,
    mill: row.mill?.millName || fields?.mill || "",
    knitterChallanNo: row.knitterChallanNo,
    challanNo: row.challanNo,
    lotNo: lineLot || row.lotNo,
    item: lineItem || fields?.item || "",
    rolls: String(row.rolls),
    greyKg: decText(row.greyKg),
    finishedKg: decText(row.finishedKg),
    rate: decText(row.rate),
    shortageKg: decNum(row.shortageKg),
    shortagePct: decNum(row.shortagePct),
    amount: decNum(row.amount),
    uniformRate: rates.length === 0 || rates.every((rate) => rate === rates[0]),
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId ?? "",
      itemName: line.item?.itemName ?? "",
      lotNo: line.lotNo,
      rate: decText(line.rate),
      rolls: String(line.rolls),
      greyKg: decText(line.greyKg),
      finishedKg: decText(line.finishedKg),
      amount: decNum(line.amount),
      rollRows: line.rollRows.map((roll) => ({
        id: roll.id,
        greyKg: decText(roll.greyKg),
        finishedKg: decText(roll.finishedKg),
      })),
    })),
  };
}

export async function listFinishedWork(): Promise<FinishedWorkRecord[]> {
  await requireUser();
  const rows = await prisma.finishedWorkEntry.findMany({
    include: entryInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toRecord(row));
}

export async function createFinishedWork(
  input: FinishedWorkInput,
): Promise<FinishedWorkSaveResult> {
  await requireUser();
  const header = await resolveHeader(input);
  const resolved = await resolveLines(input);
  const link = await resolveMillProgramLink(header.knitterChallanNo, header.millId);
  const data = {
    workDate: header.workDate,
    millProgramEntryId: link.millProgramEntryId,
    millId: header.millId,
    gpNo: header.gpNo,
    knitterChallanNo: header.knitterChallanNo,
    challanNo: header.challanNo,
    lotNo: resolved.lotNo,
    rolls: resolved.rolls,
    greyKg: resolved.greyKg,
    finishedKg: resolved.finishedKg,
    rate: resolved.rate,
    shortageKg: resolved.shortageKg,
    shortagePct: resolved.shortagePct,
    amount: resolved.amount,
    lines: { create: lineCreate(resolved.lines) },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const row = await prisma.finishedWorkEntry.create({
        data: { ...data, srNo: await nextSrNo(input.workDate) },
        include: entryInclude,
      });
      revalidatePath("/finished-work");
      return { record: toRecord(row), linkWarning: link.linkWarning };
    } catch (error) {
      const unique =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002";
      if (!unique || attempt === 1) throw error;
    }
  }
  throw new Error("Could not save the finished work.");
}

export async function updateFinishedWork(
  id: string,
  input: FinishedWorkInput,
): Promise<FinishedWorkSaveResult> {
  await requireUser();
  const existing = await prisma.finishedWorkEntry.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Finished work not found.");
  const header = await resolveHeader(input);
  const resolved = await resolveLines(input);
  const link = await resolveMillProgramLink(header.knitterChallanNo, header.millId);
  const row = await prisma.$transaction(async (tx) => {
    await tx.finishedWorkEntryLine.deleteMany({ where: { entryId: id } });
    return tx.finishedWorkEntry.update({
      where: { id },
      data: {
        workDate: header.workDate,
        millProgramEntryId: link.millProgramEntryId,
        millId: header.millId,
        gpNo: header.gpNo,
        knitterChallanNo: header.knitterChallanNo,
        challanNo: header.challanNo,
        lotNo: resolved.lotNo,
        rolls: resolved.rolls,
        greyKg: resolved.greyKg,
        finishedKg: resolved.finishedKg,
        rate: resolved.rate,
        shortageKg: resolved.shortageKg,
        shortagePct: resolved.shortagePct,
        amount: resolved.amount,
        lines: { create: lineCreate(resolved.lines) },
      },
      include: entryInclude,
    });
  });
  revalidatePath("/finished-work");
  return { record: toRecord(row), linkWarning: link.linkWarning };
}
