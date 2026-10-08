"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type QualityCheckResult = "pass" | "fail" | "without_qc" | "mixed" | "draft";
export type RollDecision = "pass" | "fail";
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
  physicalRolls: QcPhysicalRoll[];
  draft: QcDraft | null;
};

export type QcPhysicalRoll = {
  id: string;
  rollNo: number;
  itemName: string;
  codeNo: string;
  colour: string;
  finishedKg: string;
  stockState: "open" | "without_qc";
};

export type QcDraft = {
  id: string;
  date: string;
  grade: string;
  defectType: string;
  remarks: string;
  decisions: { finishedWorkEntryRollId: string; decision: RollDecision }[];
};

export type WithoutQcGroup = {
  finishedWorkId: string;
  knitterChallanNo: string;
  itemName: string;
  colour: string;
  rolls: number;
  totalKg: string;
  rollIds: string[];
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
  status: "draft" | "submitted";
};

export type QualityCheckRollInput = {
  finishedWorkEntryRollId: string;
  decision: RollDecision;
};

export type QualityCheckInput = {
  qcDate: string;
  finishedWorkId: string;
  rolls: QualityCheckRollInput[];
  grade: string;
  defectType: string;
  remarks: string;
  mode: "draft" | "submit" | "without_qc";
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
      physicalRolls: [],
      draft: null,
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
    physicalRolls: [],
    draft: null,
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
  status: string;
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
    status: row.status === "draft" ? "draft" : "submitted",
    result:
      row.status === "draft"
        ? "draft"
        : row.result === "pass" ||
            row.result === "fail" ||
            row.result === "without_qc" ||
            row.result === "mixed"
          ? row.result
          : "fail",
    grade: grade as QualityCheckGrade | "",
    defectType: defect as QualityCheckDefect | "",
    remarks: row.remarks,
    createdAt: row.createdAt.toISOString(),
  };
}

type Tx = Prisma.TransactionClient;

type Physical = {
  id: string;
  rollNo: number;
  itemName: string;
  codeNo: string;
  colour: string;
  finishedKg: string;
  stockState: "open" | "without_qc";
};

function colourQueue(lines: { rolls: number | null; codeNo: string; colour: string }[]) {
  const queue: { codeNo: string; colour: string }[] = [];
  for (const line of lines) {
    const count = line.rolls ?? 0;
    for (let i = 0; i < count; i++) {
      queue.push({ codeNo: line.codeNo, colour: line.colour });
    }
  }
  return queue;
}

function kgText(value: { toString(): string }) {
  return value.toString();
}

async function loadWorks(): Promise<QualityCheckWork[]> {
  const rows = await prisma.finishedWorkEntry.findMany({
    include: {
      mill: { select: { millName: true } },
      millProgramEntry: { include: programInclude },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: { select: { itemName: true } },
          rollRows: { orderBy: { sortOrder: "asc" } },
        },
      },
      qualityChecks: {
        where: { status: "draft" },
        include: { lines: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const rollIds = rows.flatMap((row) =>
    row.lines.flatMap((line) => line.rollRows.map((roll) => roll.id)),
  );
  const [stock, returned] = await Promise.all([
    prisma.liveStockRoll.findMany({
      where: { finishedWorkEntryRollId: { in: rollIds } },
      select: { finishedWorkEntryRollId: true, status: true, qualityState: true },
    }),
    prisma.millInwardEntryReturnLine.findMany({
      where: { finishedWorkEntryRollId: { in: rollIds } },
      select: { finishedWorkEntryRollId: true },
    }),
  ]);
  const stockByRoll = new Map(
    stock
      .filter((row) => row.finishedWorkEntryRollId)
      .map((row) => [row.finishedWorkEntryRollId as string, row]),
  );
  const returnedIds = new Set(
    returned.map((row) => row.finishedWorkEntryRollId).filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => {
    const base = workView(row);
    const queue = colourQueue(row.millProgramEntry?.lines ?? []);
    let display = 0;
    const physicalRolls: QcPhysicalRoll[] = [];
    for (const line of row.lines) {
      for (const roll of line.rollRows) {
        display += 1;
        const held = stockByRoll.get(roll.id);
        const blocked =
          returnedIds.has(roll.id) ||
          (held != null &&
            (held.status !== "available" || held.qualityState === "PASSED"));
        if (blocked) continue;
        const paint = queue[display - 1];
        physicalRolls.push({
          id: roll.id,
          rollNo: display,
          itemName: line.item?.itemName ?? "",
          codeNo: paint?.codeNo ?? "",
          colour: paint?.colour ?? "",
          finishedKg: kgText(roll.finishedKg),
          stockState: held?.qualityState === "WITHOUT_QC" ? "without_qc" : "open",
        });
      }
    }
    const draftRow = row.qualityChecks[0];
    const draft: QcDraft | null = draftRow
      ? {
          id: draftRow.id,
          date: isoDate(draftRow.qcDate),
          grade: draftRow.grade,
          defectType: draftRow.defectType,
          remarks: draftRow.remarks,
          decisions: draftRow.lines
            .filter((line) => line.finishedWorkEntryRollId)
            .map((line) => ({
              finishedWorkEntryRollId: line.finishedWorkEntryRollId as string,
              decision: line.decision === "fail" ? "fail" : "pass",
            })),
        }
      : null;
    return { ...base, physicalRolls, draft };
  });
}

export async function listQualityCheckWorks(): Promise<QualityCheckWork[]> {
  await requireUser();
  const works = await loadWorks();
  return works.filter((work) => work.physicalRolls.length > 0);
}

export async function listWithoutQcGroups(): Promise<WithoutQcGroup[]> {
  await requireUser();
  const works = await loadWorks();
  const groups: WithoutQcGroup[] = [];
  for (const work of works) {
    const buckets = new Map<string, WithoutQcGroup>();
    for (const roll of work.physicalRolls) {
      if (roll.stockState !== "without_qc") continue;
      const key = `${roll.itemName}||${roll.colour}`;
      const current = buckets.get(key) ?? {
        finishedWorkId: work.id,
        knitterChallanNo: work.knitterChallanNo,
        itemName: roll.itemName,
        colour: roll.colour,
        rolls: 0,
        totalKg: "0",
        rollIds: [],
      };
      current.rolls += 1;
      current.totalKg = String(Number(current.totalKg) + Number(roll.finishedKg || 0));
      current.rollIds.push(roll.id);
      buckets.set(key, current);
    }
    groups.push(...buckets.values());
  }
  return groups;
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

async function nextQcSrNo(tx: Tx, iso: string) {
  const rows = await tx.qualityCheckEntry.findMany({
    where: { srNo: { endsWith: `-${dateStamp(iso)}` } },
    select: { srNo: true },
  });
  return nextNumber(rows.map((row) => row.srNo), iso);
}

async function nextInwardSrNo(tx: Tx, iso: string) {
  const rows = await tx.millInwardEntry.findMany({
    where: { srNo: { endsWith: `-${dateStamp(iso)}` } },
    select: { srNo: true },
  });
  return nextNumber(rows.map((row) => row.srNo), iso);
}

async function rollsForSubmit(tx: Tx, workId: string, selected: Set<string>) {
  const work = await tx.finishedWorkEntry.findUnique({
    where: { id: workId },
    include: {
      millProgramEntry: { include: programInclude },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: { select: { itemName: true } },
          rollRows: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!work) throw new Error("Select a valid Finished Work record.");
  if (!work.millProgramEntry) {
    throw new Error("No matching Mill Program for this challan.");
  }
  const queue = colourQueue(work.millProgramEntry.lines);
  let display = 0;
  const rolls: (Physical & { finishedKgValue: { toString(): string } })[] = [];
  for (const line of work.lines) {
    for (const roll of line.rollRows) {
      display += 1;
      if (!selected.has(roll.id)) continue;
      const stock = await tx.liveStockRoll.findUnique({
        where: { finishedWorkEntryRollId: roll.id },
      });
      const returned = await tx.millInwardEntryReturnLine.findFirst({
        where: { finishedWorkEntryRollId: roll.id },
        select: { id: true },
      });
      if (returned) throw new Error("A selected roll has already failed QC.");
      if (stock && stock.status !== "available") {
        throw new Error("A selected roll is no longer available.");
      }
      if (stock && stock.qualityState === "PASSED") {
        throw new Error("A selected roll has already passed QC.");
      }
      const paint = queue[display - 1];
      rolls.push({
        id: roll.id,
        rollNo: display,
        itemName: line.item?.itemName ?? "",
        codeNo: paint?.codeNo ?? "",
        colour: paint?.colour ?? "",
        finishedKg: kgText(roll.finishedKg),
        finishedKgValue: roll.finishedKg,
        stockState: stock?.qualityState === "WITHOUT_QC" ? "without_qc" : "open",
      });
    }
  }
  if (rolls.length !== selected.size) {
    throw new Error("Select rolls from this Finished Work only.");
  }
  return { work, rolls };
}

async function writeStock(
  tx: Tx,
  qcId: string,
  roll: { id: string; rollNo: number; colour: string },
  qualityState: "PASSED" | "WITHOUT_QC",
) {
  const existing = await tx.liveStockRoll.findUnique({
    where: { finishedWorkEntryRollId: roll.id },
  });
  const data = {
    colour: roll.colour || "—",
    rollNo: String(roll.rollNo),
    status: "available",
    qualityState,
    qualityCheckEntryId: qcId,
    finishedWorkEntryRollId: roll.id,
  };
  if (existing) {
    await tx.liveStockRoll.update({ where: { id: existing.id }, data });
    return;
  }
  await tx.liveStockRoll.create({ data });
}

async function ensureReturn(
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
  work: {
    srNo: string;
    challanNo: string;
    knitterChallanNo: string;
    finishedKg: { toString(): string };
    millProgramEntry: ProgramRow;
  },
  failed: { rolls: number; codeNo: string; colour: string; finishedKg: { toString(): string }; finishedWorkEntryRollId: string }[],
) {
  const existing = await tx.millInwardEntry.findUnique({
    where: { qualityCheckId: qc.id },
    select: { srNo: true },
  });
  if (existing) return { created: false, srNo: existing.srNo };
  const program = work.millProgramEntry;
  const inward = program.millInwardEntry;
  const millName = program.mill?.millName.trim() ?? "";
  const names = inward ? itemLabel(inward.items) : "";
  if (!millName || !names) {
    throw new Error("Mill or item is missing. QC Return was not created.");
  }
  const billChallan = inward?.greyBill?.challanNo.trim() ?? "";
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
      returnItemName: names,
      returnKnitterChallanNo: qc.knitterChallanNo || billChallan || work.knitterChallanNo,
      returnChallanNo: work.challanNo.trim() || billChallan,
      returnCode: [...new Set(failed.map((row) => row.codeNo).filter(Boolean))].join(" · "),
      returnColour: [...new Set(failed.map((row) => row.colour).filter(Boolean))].join(" · "),
      returnFailedRolls: failed.length,
      returnGrade: qc.grade,
      returnDefectType: qc.defectType,
      returnQcSrNo: qc.srNo,
      returnFinishedWorkSrNo: work.srNo,
      returnProgramSrNo: program.srNo,
      returnLines: {
        create: failed.map((line, index) => ({
          sortOrder: index,
          rolls: 1,
          codeNo: line.codeNo,
          colour: line.colour,
          finishedKg: line.finishedKg.toString(),
          finishedWorkEntryRollId: line.finishedWorkEntryRollId,
        })),
      },
    },
    select: { srNo: true },
  });
  return { created: true, srNo: created.srNo };
}

async function writeQc(tx: Tx, input: QualityCheckInput): Promise<QualityCheckSaveResult> {
  if (!input.finishedWorkId.trim()) throw new Error("Select a valid Finished Work record.");
  const selected = new Set(input.rolls.map((row) => row.finishedWorkEntryRollId));
  if (selected.size === 0) throw new Error("No rolls are available for QC.");
  const { work, rolls } = await rollsForSubmit(tx, input.finishedWorkId, selected);
  const decisions = new Map(input.rolls.map((row) => [row.finishedWorkEntryRollId, row.decision]));
  const mode = input.mode;
  const planned = rolls.map((roll) => ({
    ...roll,
    decision: mode === "without_qc" ? "pass" as const : (decisions.get(roll.id) === "fail" ? "fail" as const : "pass" as const),
  }));
  const fails = planned.filter((roll) => mode !== "without_qc" && roll.decision === "fail");
  const passes = planned.filter((roll) => mode === "without_qc" || roll.decision === "pass");
  if (mode === "submit" && fails.length > 0 && !DEFECTS.has(input.defectType)) {
    throw new Error("Select a defect type for FAIL.");
  }
  if (mode === "submit" && passes.length > 0 && fails.length === 0 && !PASS_GRADES.has(input.grade)) {
    throw new Error("Select a grade for PASS.");
  }
  if (mode === "submit" && passes.length > 0 && fails.length > 0 && input.grade && !PASS_GRADES.has(input.grade)) {
    throw new Error("Select a grade for PASS.");
  }

  const shown = programView(work.millProgramEntry!);
  const knitterChallanNo = shown.challanNo || work.knitterChallanNo;
  if (!knitterChallanNo.trim()) throw new Error("Knitter Challan No. is required.");

  const result =
    mode === "draft"
      ? ""
      : mode === "without_qc"
        ? "without_qc"
        : fails.length === 0
          ? "pass"
          : passes.length === 0
            ? "fail"
            : "mixed";
  const grade = mode === "without_qc" || mode === "draft" ? input.grade : fails.length && !passes.length ? "REJECT" : input.grade;
  const defectType = fails.length ? input.defectType : "";

  const lineData = planned.map((roll, index) => ({
    sortOrder: index,
    rolls: 1,
    codeNo: roll.codeNo,
    colour: roll.colour,
    decision: mode === "without_qc" ? "without_qc" : roll.decision,
    finishedWorkEntryRollId: roll.id,
  }));

  const draft = await tx.qualityCheckEntry.findFirst({
    where: { finishedWorkId: work.id, status: "draft" },
    select: { id: true },
  });
  const date = asDate(input.qcDate);
  let savedId = draft?.id ?? "";
  if (!draft) {
    const saved = await tx.qualityCheckEntry.create({
      data: {
        srNo: await nextQcSrNo(tx, input.qcDate),
        qcDate: date,
        finishedWorkId: work.id,
        millProgramEntryId: work.millProgramEntry!.id,
        knitterChallanNo,
        status: mode === "draft" ? "draft" : "submitted",
        result,
        grade,
        defectType,
        remarks: input.remarks,
        lines: { create: lineData },
      },
      include: qcInclude,
    });
    savedId = saved.id;
    if (mode === "draft") {
      return { record: qcView({ ...saved, status: saved.status }), fail: null };
    }
  } else {
    await tx.qualityCheckEntryLine.deleteMany({ where: { qcId: draft.id } });
    await tx.qualityCheckEntry.update({
      where: { id: draft.id },
      data: {
        qcDate: date,
        millProgramEntryId: work.millProgramEntry!.id,
        knitterChallanNo,
        status: mode === "draft" ? "draft" : "submitted",
        result,
        grade,
        defectType,
        remarks: input.remarks,
        lines: { create: lineData },
      },
    });
  }

  if (mode === "draft") {
    const saved = await tx.qualityCheckEntry.findUniqueOrThrow({
      where: { id: savedId },
      include: qcInclude,
    });
    return { record: qcView(saved), fail: null };
  }

  const qualityState = mode === "without_qc" ? "WITHOUT_QC" : "PASSED";
  for (const roll of planned) {
    if (mode === "without_qc" || roll.decision === "pass") {
      await writeStock(tx, savedId, roll, qualityState);
    } else {
      await tx.liveStockRoll.deleteMany({ where: { finishedWorkEntryRollId: roll.id } });
    }
  }

  let fail: { created: boolean; srNo: string } | null = null;
  if (fails.length > 0) {
    const header = await tx.qualityCheckEntry.findUniqueOrThrow({ where: { id: savedId } });
    fail = await ensureReturn(
      tx,
      header,
      { ...work, millProgramEntry: work.millProgramEntry! },
      fails.map((roll) => ({
        rolls: 1,
        codeNo: roll.codeNo,
        colour: roll.colour,
        finishedKg: roll.finishedKgValue,
        finishedWorkEntryRollId: roll.id,
      })),
    );
  }

  const saved = await tx.qualityCheckEntry.findUniqueOrThrow({
    where: { id: savedId },
    include: qcInclude,
  });
  return { record: qcView(saved), fail };
}

export async function saveQualityCheck(input: QualityCheckInput): Promise<QualityCheckSaveResult> {
  await requireUser();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) => writeQc(tx, input));
      revalidatePath("/quality-check");
      if (input.mode !== "draft") {
        revalidatePath("/live-stock");
        if (result.fail?.created) revalidatePath("/mill-inward");
      }
      return result;
    } catch (error) {
      if (!isUnique(error) || attempt === 1) throw error;
    }
  }
  throw new Error("Could not save the QC.");
}
