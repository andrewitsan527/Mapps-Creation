"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type MillProgramStatus = "draft" | "saved" | "sent";

export type MillProgramLineRecord = {
  id: string;
  rolls: string;
  codeNo: string;
  colour: string;
};

export type MillProgramRecord = {
  id: string;
  srNo: string;
  date: string;
  millId: string;
  millName: string;
  itemLabel: string;
  knitterName: string;
  challanNo: string;
  inwardId: string;
  inwardSrNo: string;
  dateOfIssue: string;
  typeOfFinish: string;
  gsm: string;
  width: string;
  lines: MillProgramLineRecord[];
  programmedRolls: number;
  originalRolls: number;
  status: MillProgramStatus;
  sentAt: string | null;
};

export type MillProgramSource = {
  id: string;
  srNo: string;
  millId: string;
  mill: string;
  item: string;
  knitter: string;
  challanNo: string;
  dateOfIssue: string | null;
  rollCount: number;
};

export type MillProgramLineInput = {
  rolls: string;
  codeNo: string;
  colour: string;
};

export type MillProgramInput = {
  programDate: string;
  millId: string;
  millInwardEntryId: string;
  itemLabel: string;
  typeOfFinish: string;
  gsm: string;
  width: string;
  status: MillProgramStatus;
  lines: MillProgramLineInput[];
};

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function asDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Enter a date.");
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function decNum(value: { toString(): string } | null | undefined) {
  if (value == null) return 0;
  return num(value.toString());
}

function isBlankLine(line: MillProgramLineInput) {
  return !line.rolls.trim() && !line.codeNo.trim() && !line.colour.trim();
}

function parsePositiveRolls(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function itemLabel(
  items: { item: { itemName: string } | null }[],
) {
  return items
    .map((row) => row.item?.itemName.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function sourceRollCount(
  rolls: { weightKg: { toString(): string } | null }[],
  items: { rolls: { toString(): string } | null }[],
) {
  if (rolls.length > 0) return rolls.length;
  const fromItems = items.reduce((sum, item) => sum + decNum(item.rolls), 0);
  return fromItems > 0 ? fromItems : 0;
}

function lineRolls(lines: { rolls: number | null }[]) {
  return lines.reduce((sum, line) => sum + (line.rolls ?? 0), 0);
}

async function nextSrNo(isoDate: string) {
  const stamp = dateStamp(isoDate);
  const rows = await prisma.millProgramEntry.findMany({
    where: { srNo: { endsWith: `-${stamp}` } },
    select: { srNo: true },
  });
  const used = rows
    .map((row) => Number(row.srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

const inwardInclude = {
  mill: { select: { millName: true } },
  knitter: { select: { knitterName: true } },
  greyBill: { select: { challanNo: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: { item: { select: { itemName: true } } },
  },
  rolls: { select: { weightKg: true } },
};

type InwardRow = {
  id: string;
  srNo: string;
  millId: string | null;
  mill: { millName: string } | null;
  knitter: { knitterName: string } | null;
  greyBill: { challanNo: string } | null;
  dateOfIssue: Date | null;
  items: { rolls: { toString(): string } | null; item: { itemName: string } | null }[];
  rolls: { weightKg: { toString(): string } | null }[];
};

function toSource(row: InwardRow): MillProgramSource {
  return {
    id: row.id,
    srNo: row.srNo,
    millId: row.millId ?? "",
    mill: row.mill?.millName ?? "",
    item: itemLabel(row.items),
    knitter: row.knitter?.knitterName ?? "",
    challanNo: row.greyBill?.challanNo ?? "",
    dateOfIssue: row.dateOfIssue ? isoDate(row.dateOfIssue) : null,
    rollCount: sourceRollCount(row.rolls, row.items),
  };
}

const programInclude = {
  mill: { select: { millName: true } },
  lines: { orderBy: { sortOrder: "asc" as const } },
  millInwardEntry: { include: inwardInclude },
};

type ProgramRow = {
  id: string;
  srNo: string;
  programDate: Date;
  millId: string | null;
  mill: { millName: string } | null;
  millInwardEntryId: string | null;
  millInwardEntry: InwardRow | null;
  typeOfFinish: string;
  gsm: string;
  width: string;
  status: string;
  sentAt: Date | null;
  lines: {
    id: string;
    rolls: number | null;
    codeNo: string;
    colour: string;
  }[];
};

function asStatus(value: string): MillProgramStatus {
  if (value === "draft" || value === "sent" || value === "saved") return value;
  return "saved";
}

function toRecord(row: ProgramRow): MillProgramRecord {
  const inward = row.millInwardEntry;
  return {
    id: row.id,
    srNo: row.srNo,
    date: isoDate(row.programDate),
    millId: row.millId ?? "",
    millName: row.mill?.millName ?? inward?.mill?.millName ?? "",
    itemLabel: inward ? itemLabel(inward.items) : "",
    knitterName: inward?.knitter?.knitterName ?? "",
    challanNo: inward?.greyBill?.challanNo ?? "",
    inwardId: row.millInwardEntryId ?? "",
    inwardSrNo: inward?.srNo ?? "",
    dateOfIssue: inward?.dateOfIssue ? isoDate(inward.dateOfIssue) : "",
    typeOfFinish: row.typeOfFinish,
    gsm: row.gsm,
    width: row.width,
    lines: row.lines.map((line) => ({
      id: line.id,
      rolls: line.rolls == null ? "" : String(line.rolls),
      codeNo: line.codeNo,
      colour: line.colour,
    })),
    programmedRolls: lineRolls(row.lines),
    originalRolls: inward ? sourceRollCount(inward.rolls, inward.items) : 0,
    status: asStatus(row.status),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
  };
}

async function allocatedRolls(inwardId: string, excludeId?: string) {
  const programs = await prisma.millProgramEntry.findMany({
    where: {
      millInwardEntryId: inwardId,
      status: { not: "draft" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { lines: { select: { rolls: true } } },
  });
  return programs.reduce((sum, program) => sum + lineRolls(program.lines), 0);
}

async function assertSaved(input: MillProgramInput, excludeId?: string) {
  if (!input.millId.trim() || !input.itemLabel.trim()) {
    throw new Error("Select mill and item.");
  }
  if (!input.millInwardEntryId.trim()) {
    throw new Error("Select a Mill Inward source.");
  }
  if (!input.typeOfFinish.trim() || !input.gsm.trim() || !input.width.trim()) {
    throw new Error("Enter type of finish, GSM and width.");
  }
  const mill = await prisma.mill.findUnique({
    where: { id: input.millId },
    select: { id: true },
  });
  if (!mill) throw new Error("Select mill and item.");
  const inward = await prisma.millInwardEntry.findUnique({
    where: { id: input.millInwardEntryId },
    include: inwardInclude,
  });
  if (!inward) throw new Error("Select a Mill Inward source.");
  if (inward.millId !== input.millId || itemLabel(inward.items) !== input.itemLabel.trim()) {
    throw new Error("Select mill and item.");
  }
  const filled = input.lines.filter((line) => !isBlankLine(line));
  if (filled.length === 0) throw new Error("Enter at least one program row.");
  const parsed: number[] = [];
  for (const line of filled) {
    const rolls = parsePositiveRolls(line.rolls);
    if (rolls === null) {
      throw new Error(
        "Each program row must have a whole number of rolls greater than zero.",
      );
    }
    if (!line.codeNo.trim() || !line.colour.trim()) {
      throw new Error("Enter code no. and colour on every program row.");
    }
    parsed.push(rolls);
  }
  const programmed = parsed.reduce((sum, rolls) => sum + rolls, 0);
  const available = sourceRollCount(inward.rolls, inward.items);
  const remaining = available - (await allocatedRolls(inward.id, excludeId));
  if (programmed > remaining) {
    throw new Error(
      `Programmed rolls (${programmed}) exceed available rolls (${remaining}).`,
    );
  }
}

function storedLines(input: MillProgramInput) {
  const lines =
    input.status === "draft" ? input.lines : input.lines.filter((line) => !isBlankLine(line));
  return lines.map((line, index) => ({
    sortOrder: index,
    rolls: parsePositiveRolls(line.rolls),
    codeNo: line.codeNo.trim(),
    colour: line.colour.trim(),
  }));
}

function headerData(input: MillProgramInput, sentAt: Date | null) {
  return {
    programDate: asDate(input.programDate),
    millId: input.millId.trim() || null,
    millInwardEntryId: input.millInwardEntryId.trim() || null,
    typeOfFinish: input.typeOfFinish.trim(),
    gsm: input.gsm.trim(),
    width: input.width.trim(),
    status: input.status,
    sentAt,
    lines: { create: storedLines(input) },
  };
}

async function sentAtFor(
  status: MillProgramStatus,
  existingSentAt: Date | null,
) {
  if (status !== "sent") return null;
  return existingSentAt ?? new Date();
}

export async function listMillProgramSources(): Promise<MillProgramSource[]> {
  await requireUser();
  const rows = await prisma.millInwardEntry.findMany({
    include: inwardInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSource).filter((row) => row.rollCount > 0);
}

export async function listMillPrograms(): Promise<MillProgramRecord[]> {
  await requireUser();
  const rows = await prisma.millProgramEntry.findMany({
    include: programInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toRecord(row));
}

export async function createMillProgram(
  input: MillProgramInput,
): Promise<MillProgramRecord> {
  await requireUser();
  if (input.status !== "draft") await assertSaved(input);
  else await assertDraftRefs(input);
  const data = headerData(input, await sentAtFor(input.status, null));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const row = await prisma.millProgramEntry.create({
        data: { ...data, srNo: await nextSrNo(input.programDate) },
        include: programInclude,
      });
      revalidatePath("/mill-program");
      return toRecord(row);
    } catch (error) {
      const unique =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002";
      if (!unique || attempt === 1) throw error;
    }
  }
  throw new Error("Could not save the mill program.");
}

async function assertDraftRefs(input: MillProgramInput) {
  if (input.millId.trim()) {
    const mill = await prisma.mill.findUnique({
      where: { id: input.millId },
      select: { id: true },
    });
    if (!mill) throw new Error("Select mill and item.");
  }
  if (input.millInwardEntryId.trim()) {
    const inward = await prisma.millInwardEntry.findUnique({
      where: { id: input.millInwardEntryId },
      select: { id: true, millId: true },
    });
    if (!inward) throw new Error("Select a Mill Inward source.");
    if (input.millId.trim() && inward.millId !== input.millId) {
      throw new Error("Select mill and item.");
    }
  }
}

export async function updateMillProgram(
  id: string,
  input: MillProgramInput,
): Promise<MillProgramRecord> {
  await requireUser();
  const existing = await prisma.millProgramEntry.findUnique({
    where: { id },
    select: { id: true, sentAt: true },
  });
  if (!existing) throw new Error("Mill program not found.");
  if (input.status !== "draft") await assertSaved(input, id);
  else await assertDraftRefs(input);
  const data = headerData(input, await sentAtFor(input.status, existing.sentAt));
  const row = await prisma.$transaction(async (tx) => {
    await tx.millProgramEntryLine.deleteMany({ where: { programId: id } });
    return tx.millProgramEntry.update({
      where: { id },
      data,
      include: programInclude,
    });
  });
  revalidatePath("/mill-program");
  return toRecord(row);
}
