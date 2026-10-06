"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type QualityCheckResult = "pass" | "fail";
export type QualityCheckGrade = "A" | "B" | "C" | "REJECT";
export type QualityCheckDefect = "MILL" | "WEAVER" | "DYEING" | "MINOR";

export type QualityCheckLineRecord = {
  id: string;
  rolls: string;
  codeNo: string;
  colour: string;
};

export type QualityCheckProgramLine = {
  id: string;
  rolls: number;
  codeNo: string;
  colour: string;
};

export type QualityCheckProgram = {
  id: string;
  srNo: string;
  date: string;
  dateOfIssue: string;
  mill: string;
  knitter: string;
  challanNo: string;
  item: string;
  typeOfFinish: string;
  gsm: string;
  width: string;
  programmedRolls: number;
  lines: QualityCheckProgramLine[];
};

export type QualityCheckWork = {
  id: string;
  srNo: string;
  date: string;
  programId: string;
  gpNo: string;
  mill: string;
  knitterChallanNo: string;
  challanNo: string;
  lotNo: string;
  item: string;
  rolls: number;
  greyKg: string;
  finishedKg: string;
  rate: string;
};

export type QualityCheckRecord = {
  id: string;
  srNo: string;
  date: string;
  finishedWorkId: string;
  programId: string;
  knitterChallanNo: string;
  lines: QualityCheckLineRecord[];
  qcRolls: number;
  result: QualityCheckResult;
  grade: QualityCheckGrade | "";
  defectType: QualityCheckDefect | "";
  remarks: string;
  createdAt: string;
};

export type QualityCheckLineInput = {
  rolls: string;
  codeNo: string;
  colour: string;
};

export type QualityCheckInput = {
  qcDate: string;
  finishedWorkId: string;
  lines: QualityCheckLineInput[];
  result: QualityCheckResult;
  grade: string;
  defectType: string;
  remarks: string;
};

export type QualityCheckSaveResult = {
  record: QualityCheckRecord;
  fail: { created: boolean; srNo: string } | null;
};

const PASS_GRADES = new Set(["A", "B", "C"]);
const DEFECTS = new Set(["MILL", "WEAVER", "DYEING", "MINOR"]);

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Enter a date.");
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function decText(value: { toString(): string } | null | undefined) {
  if (value == null) return "";
  return value.toString();
}

function itemLabel(items: { item: { itemName: string } | null }[]) {
  return items
    .map((row) => row.item?.itemName.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function programmedRolls(lines: { rolls: number | null }[]) {
  return lines.reduce((sum, line) => sum + (line.rolls ?? 0), 0);
}

function nextNumber(srNos: string[], iso: string) {
  const stamp = dateStamp(iso);
  const used = srNos
    .filter((srNo) => srNo.endsWith(`-${stamp}`))
    .map((srNo) => Number(srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function isUnique(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

const programInclude = {
  mill: { select: { millName: true } },
  lines: { orderBy: { sortOrder: "asc" as const } },
  millInwardEntry: {
    include: {
      knitter: { select: { knitterName: true } },
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
  programDate: Date;
  millId: string | null;
  typeOfFinish: string;
  gsm: string;
  width: string;
  mill: { millName: string } | null;
  lines: { id: string; rolls: number | null; codeNo: string; colour: string }[];
  millInwardEntry: {
    knitterId: string | null;
    dateOfIssue: Date | null;
    knitter: { knitterName: string } | null;
    greyBill: { billNo: string; challanNo: string } | null;
    items: { item: { itemName: string } | null }[];
  } | null;
};

function programView(program: ProgramRow): QualityCheckProgram {
  const inward = program.millInwardEntry;
  const bill = inward?.greyBill;
  return {
    id: program.id,
    srNo: program.srNo,
    date: isoDate(program.programDate),
    dateOfIssue: inward?.dateOfIssue ? isoDate(inward.dateOfIssue) : "",
    mill: program.mill?.millName ?? "",
    knitter: inward?.knitter?.knitterName ?? "",
    challanNo: bill?.challanNo.trim() ?? "",
    item: inward ? itemLabel(inward.items) : "",
    typeOfFinish: program.typeOfFinish,
    gsm: program.gsm,
    width: program.width,
    programmedRolls: programmedRolls(program.lines),
    lines: program.lines.map((line) => ({
      id: line.id,
      rolls: line.rolls ?? 0,
      codeNo: line.codeNo,
      colour: line.colour,
    })),
  };
}

type WorkRow = {
  id: string;
  srNo: string;
  workDate: Date;
  millProgramEntryId: string | null;
  gpNo: string;
  knitterChallanNo: string;
  challanNo: string;
  lotNo: string;
  rolls: number;
  greyKg: { toString(): string };
  finishedKg: { toString(): string };
  rate: { toString(): string };
  mill?: { millName: string } | null;
  millProgramEntry: ProgramRow | null;
  lines?: { item: { itemName: string } | null }[];
};

function workView(row: WorkRow): QualityCheckWork {
  if (!row.millProgramEntry) {
    return {
      id: row.id,
      srNo: row.srNo,
      date: isoDate(row.workDate),
      programId: "",
      gpNo: row.gpNo,
      mill: row.mill?.millName ?? "",
      knitterChallanNo: row.knitterChallanNo,
      challanNo: row.challanNo,
      lotNo: row.lotNo,
      item: (row.lines ?? [])
        .map((line) => line.item?.itemName.trim() ?? "")
        .filter(Boolean)
        .join(" · "),
      rolls: row.rolls,
      greyKg: decText(row.greyKg),
      finishedKg: decText(row.finishedKg),
      rate: decText(row.rate),
    };
  }
  const program = programView(row.millProgramEntry);
  return {
    id: row.id,
    srNo: row.srNo,
    date: isoDate(row.workDate),
    programId: row.millProgramEntryId ?? "",
    gpNo: row.millProgramEntry.millInwardEntry?.greyBill?.billNo.trim() || row.gpNo,
    mill: program.mill,
    knitterChallanNo: program.challanNo || row.knitterChallanNo,
    challanNo: row.challanNo,
    lotNo: row.lotNo,
    item: program.item,
    rolls: row.rolls,
    greyKg: decText(row.greyKg),
    finishedKg: decText(row.finishedKg),
    rate: decText(row.rate),
  };
}

const qcInclude = {
  lines: { orderBy: { sortOrder: "asc" as const } },
} as const;

type QcRow = {
  id: string;
  srNo: string;
  qcDate: Date;
  finishedWorkId: string;
  millProgramEntryId: string;
  knitterChallanNo: string;
  result: string;
  grade: string;
  defectType: string;
  remarks: string;
  createdAt: Date;
  lines: { id: string; rolls: number; codeNo: string; colour: string }[];
};

function qcView(row: QcRow): QualityCheckRecord {
  const grade = PASS_GRADES.has(row.grade) || row.grade === "REJECT" ? row.grade : "";
  const defect = DEFECTS.has(row.defectType) ? row.defectType : "";
  return {
    id: row.id,
    srNo: row.srNo,
    date: isoDate(row.qcDate),
    finishedWorkId: row.finishedWorkId,
    programId: row.millProgramEntryId,
    knitterChallanNo: row.knitterChallanNo,
    lines: row.lines.map((line) => ({
      id: line.id,
      rolls: String(line.rolls),
      codeNo: line.codeNo,
      colour: line.colour,
    })),
    qcRolls: row.lines.reduce((sum, line) => sum + line.rolls, 0),
    result: row.result === "pass" ? "pass" : "fail",
    grade: grade as QualityCheckGrade | "",
    defectType: defect as QualityCheckDefect | "",
    remarks: row.remarks,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseLines(lines: QualityCheckLineInput[]) {
  const filled = lines.filter(
    (line) => line.rolls.trim() || line.codeNo.trim() || line.colour.trim(),
  );
  if (filled.length === 0) {
    throw new Error("Enter at least one QC received row.");
  }
  return filled.map((line) => {
    const rolls = Number(line.rolls);
    if (!Number.isFinite(rolls) || !Number.isInteger(rolls) || rolls <= 0) {
      throw new Error(
        "Each QC row must have a whole number of rolls greater than zero.",
      );
    }
    if (!line.codeNo.trim() || !line.colour.trim()) {
      throw new Error("Enter code no. and colour on every QC row.");
    }
    return {
      rolls,
      codeNo: line.codeNo.trim(),
      colour: line.colour.trim(),
    };
  });
}

function decision(input: QualityCheckInput) {
  if (input.result === "pass") {
    if (!PASS_GRADES.has(input.grade)) {
      throw new Error("Select a grade for PASS.");
    }
    return { result: "pass" as const, grade: input.grade, defectType: "" };
  }
  if (input.result !== "fail") {
    throw new Error("Select PASS or FAIL.");
  }
  if (!DEFECTS.has(input.defectType)) {
    throw new Error("Select a defect type for FAIL.");
  }
  return { result: "fail" as const, grade: "REJECT", defectType: input.defectType };
}

type Tx = Prisma.TransactionClient;

async function allocatedRolls(tx: Tx, programId: string, excludeQcId?: string) {
  const lines = await tx.qualityCheckEntryLine.findMany({
    where: {
      qc: {
        millProgramEntryId: programId,
        ...(excludeQcId ? { id: { not: excludeQcId } } : {}),
      },
    },
    select: { rolls: true },
  });
  return lines.reduce((sum, line) => sum + line.rolls, 0);
}

async function nextQcSrNo(tx: Tx, iso: string) {
  const rows = await tx.qualityCheckEntry.findMany({
    where: { srNo: { endsWith: `-${dateStamp(iso)}` } },
    select: { srNo: true },
  });
  return nextNumber(
    rows.map((row) => row.srNo),
    iso,
  );
}

async function nextInwardSrNo(tx: Tx, iso: string) {
  const rows = await tx.millInwardEntry.findMany({
    where: { srNo: { endsWith: `-${dateStamp(iso)}` } },
    select: { srNo: true },
  });
  return nextNumber(
    rows.map((row) => row.srNo),
    iso,
  );
}

async function ensureQcReturn(
  tx: Tx,
  qc: {
    id: string;
    srNo: string;
    qcDate: Date;
    remarks: string;
    grade: string;
    defectType: string;
    knitterChallanNo: string;
  },
  work: WorkRow,
  lines: { rolls: number; codeNo: string; colour: string }[],
) {
  const existing = await tx.millInwardEntry.findUnique({
    where: { qualityCheckId: qc.id },
    select: { srNo: true },
  });
  if (existing) return { created: false, srNo: existing.srNo };

  const program = work.millProgramEntry;
  if (!program) {
    throw new Error("Mill Program for this QC is missing. QC Return was not created.");
  }
  const inward = program.millInwardEntry;
  const millName = program.mill?.millName.trim() ?? "";
  const itemName = inward ? itemLabel(inward.items) : "";
  if (!millName || !itemName) {
    throw new Error("Mill or item is missing. QC Return was not created.");
  }

  const billChallan = inward?.greyBill?.challanNo.trim() ?? "";
  const codes = [...new Set(lines.map((line) => line.codeNo.trim()).filter(Boolean))];
  const colours = [...new Set(lines.map((line) => line.colour.trim()).filter(Boolean))];
  const date = isoDate(qc.qcDate);
  const created = await tx.millInwardEntry.create({
    data: {
      srNo: await nextInwardSrNo(tx, date),
      inwardDate: qc.qcDate,
      dateOfIssue: null,
      knitterId: inward?.knitterId ?? null,
      millId: program.millId,
      quantityKg: decText(work.finishedKg),
      remarks: qc.remarks,
      status: "pending",
      sourceType: "QC_RETURN",
      qualityCheckId: qc.id,
      sendNote: "",
      returnItemName: itemName,
      returnKnitterChallanNo: qc.knitterChallanNo || billChallan || work.knitterChallanNo,
      returnChallanNo: work.challanNo.trim() || billChallan,
      returnCode: codes.join(" · "),
      returnColour: colours.join(" · "),
      returnFailedRolls: lines.reduce((sum, line) => sum + line.rolls, 0),
      returnGrade: qc.grade,
      returnDefectType: qc.defectType,
      returnQcSrNo: qc.srNo,
      returnFinishedWorkSrNo: work.srNo,
      returnProgramSrNo: program.srNo,
      returnLines: {
        create: lines.map((line, index) => ({
          sortOrder: index,
          rolls: line.rolls,
          codeNo: line.codeNo,
          colour: line.colour,
        })),
      },
    },
    select: { srNo: true },
  });
  return { created: true, srNo: created.srNo };
}

async function writeQc(
  tx: Tx,
  id: string | null,
  input: QualityCheckInput,
): Promise<QualityCheckSaveResult> {
  if (!input.finishedWorkId.trim()) {
    throw new Error("Select a valid Finished Work record.");
  }
  const work = await tx.finishedWorkEntry.findUnique({
    where: { id: input.finishedWorkId },
    include: { millProgramEntry: { include: programInclude } },
  });
  if (!work) throw new Error("Select a valid Finished Work record.");
  if (!work.millProgramEntry) {
    throw new Error("No matching Mill Program for this challan.");
  }

  const lines = parseLines(input.lines);
  const choice = decision(input);
  const received = lines.reduce((sum, line) => sum + line.rolls, 0);
  const programmed = programmedRolls(work.millProgramEntry.lines);
  const allocated = await allocatedRolls(tx, work.millProgramEntry.id, id ?? undefined);
  const available = programmed - allocated;
  if (received > available) {
    throw new Error(
      `QC'd rolls (${received}) exceed remaining programmed rolls (${available}).`,
    );
  }

  const shown = programView(work.millProgramEntry);
  const knitterChallanNo = shown.challanNo || work.knitterChallanNo;
  if (!knitterChallanNo.trim()) {
    throw new Error("Knitter Challan No. is required.");
  }

  const lineData = lines.map((line, index) => ({
    sortOrder: index,
    rolls: line.rolls,
    codeNo: line.codeNo,
    colour: line.colour,
  }));

  let saved: QcRow;
  if (!id) {
    const date = asDate(input.qcDate);
    saved = await tx.qualityCheckEntry.create({
      data: {
        srNo: await nextQcSrNo(tx, input.qcDate),
        qcDate: date,
        finishedWorkId: work.id,
        millProgramEntryId: work.millProgramEntry.id,
        knitterChallanNo,
        result: choice.result,
        grade: choice.grade,
        defectType: choice.defectType,
        remarks: input.remarks,
        lines: { create: lineData },
      },
      include: qcInclude,
    });
  } else {
    await tx.qualityCheckEntryLine.deleteMany({ where: { qcId: id } });
    saved = await tx.qualityCheckEntry.update({
      where: { id },
      data: {
        finishedWorkId: work.id,
        millProgramEntryId: work.millProgramEntry.id,
        knitterChallanNo,
        result: choice.result,
        grade: choice.grade,
        defectType: choice.defectType,
        remarks: input.remarks,
        lines: { create: lineData },
      },
      include: qcInclude,
    });
  }

  await syncPassStock(tx, saved.id, choice.result === "pass", lines);

  const fail =
    choice.result === "fail"
      ? await ensureQcReturn(tx, saved, work, lines)
      : null;
  return { record: qcView(saved), fail };
}

async function syncPassStock(
  tx: Tx,
  qcId: string,
  pass: boolean,
  lines: { rolls: number; colour: string }[],
) {
  await tx.liveStockRoll.deleteMany({ where: { qualityCheckEntryId: qcId } });
  if (!pass) return;
  const rows: {
    qualityCheckEntryId: string;
    colour: string;
    rollNo: string;
    status: string;
  }[] = [];
  let rollNo = 0;
  for (const line of lines) {
    const colour = line.colour.trim();
    for (let i = 0; i < line.rolls; i++) {
      rollNo += 1;
      rows.push({
        qualityCheckEntryId: qcId,
        colour,
        rollNo: String(rollNo),
        status: "available",
      });
    }
  }
  if (rows.length > 0) {
    await tx.liveStockRoll.createMany({ data: rows });
  }
}

async function commit(
  id: string | null,
  input: QualityCheckInput,
): Promise<QualityCheckSaveResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) => writeQc(tx, id, input));
      revalidatePath("/quality-check");
      revalidatePath("/live-stock");
      if (result.fail?.created) revalidatePath("/mill-inward");
      return result;
    } catch (error) {
      if (!isUnique(error) || attempt === 1) throw error;
    }
  }
  throw new Error("Could not save the QC.");
}

export async function listQualityCheckWorks(): Promise<QualityCheckWork[]> {
  await requireUser();
  const rows = await prisma.finishedWorkEntry.findMany({
    include: {
      mill: { select: { millName: true } },
      millProgramEntry: { include: programInclude },
      lines: {
        orderBy: { sortOrder: "asc" as const },
        include: { item: { select: { itemName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => workView(row));
}

export async function listQualityCheckPrograms(): Promise<QualityCheckProgram[]> {
  await requireUser();
  const rows = await prisma.millProgramEntry.findMany({
    include: programInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => programView(row));
}

export async function listQualityChecks(): Promise<QualityCheckRecord[]> {
  await requireUser();
  const rows = await prisma.qualityCheckEntry.findMany({
    include: qcInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => qcView(row));
}

export async function createQualityCheck(
  input: QualityCheckInput,
): Promise<QualityCheckSaveResult> {
  await requireUser();
  return commit(null, input);
}

export async function updateQualityCheck(
  id: string,
  input: QualityCheckInput,
): Promise<QualityCheckSaveResult> {
  await requireUser();
  const existing = await prisma.qualityCheckEntry.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("QC record not found.");
  return commit(id, input);
}
