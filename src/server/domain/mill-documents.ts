import { prisma } from "@/lib/db";
import { renderMillInwardPdf } from "@/server/pdf/mill-inward-pdf";
import { renderMillProgramPdf } from "@/server/pdf/mill-program-pdf";
import {
  newSentDocumentToken,
  writeSentDocument,
  type SentDocumentKind,
} from "@/server/sent-documents";

const millSelect = {
  millName: true,
  address: true,
  cityName: true,
  mobileNo: true,
} as const;

type MillRow = {
  millName: string;
  address: string | null;
  cityName: string | null;
  mobileNo: string | null;
} | null;

function millOf(mill: MillRow) {
  return {
    name: mill?.millName ?? "",
    address: mill?.address?.trim() ?? "",
    city: mill?.cityName?.trim() ?? "",
    mobile: mill?.mobileNo?.trim() ?? "",
  };
}

function decNum(value: { toString(): string } | null | undefined) {
  if (value == null) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

function safeName(value: string) {
  return value.replace(/[^\w.-]+/g, "_");
}

export type StoredPdf = {
  kind: SentDocumentKind;
  storageKey: string;
  accessToken: string;
  fileName: string;
  byteSize: number;
  recipient: string;
};

async function store(
  kind: SentDocumentKind,
  entityId: string,
  fileName: string,
  recipient: string,
  bytes: Buffer,
): Promise<StoredPdf> {
  const storageKey = await writeSentDocument({ kind, entityId, bytes });
  return {
    kind,
    storageKey,
    accessToken: newSentDocumentToken(),
    fileName,
    byteSize: bytes.length,
    recipient,
  };
}

export async function storeMillInwardPdf(id: string, sentAt: Date) {
  const entry = await prisma.millInwardEntry.findUniqueOrThrow({
    where: { id },
    include: {
      mill: { select: millSelect },
      knitter: { select: { knitterName: true } },
      greyBill: { select: { challanNo: true, billNo: true, agent: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { item: { select: { itemName: true } } },
      },
      rolls: { orderBy: { sortOrder: "asc" } },
    },
  });
  const rollWeights = entry.rolls
    .filter((roll) => roll.weightKg != null)
    .map((roll) => decNum(roll.weightKg));
  const rollKg = rollWeights.reduce((sum, weight) => sum + weight, 0);
  const itemRolls = entry.items.reduce((sum, item) => sum + decNum(item.rolls), 0);
  const totalRolls = rollWeights.length > 0 ? rollWeights.length : itemRolls;
  const totalKg = rollKg > 0 ? rollKg : decNum(entry.quantityKg);
  const mill = millOf(entry.mill);
  const items = entry.items.map((item) => ({
    name: item.item?.itemName ?? "",
    rolls: decNum(item.rolls),
    qtyKg: decNum(item.qtyKg),
  }));
  if (items.length === 1 && !items[0].rolls && !items[0].qtyKg) {
    items[0] = { ...items[0], rolls: totalRolls, qtyKg: totalKg };
  }

  const bytes = await renderMillInwardPdf({
    srNo: entry.srNo,
    inwardDate: entry.inwardDate,
    dateOfIssue: entry.dateOfIssue,
    sentAt,
    sourceType: entry.sourceType === "GREY_PURCHASE" ? "GREY_PURCHASE" : "MANUAL",
    mill,
    knitterName: entry.knitter?.knitterName ?? "",
    challanNo: entry.greyBill?.challanNo.trim() ?? "",
    billNo: entry.greyBill?.billNo.trim() ?? "",
    agent: entry.greyBill?.agent?.trim() ?? "",
    items,
    rollWeights,
    totalRolls,
    totalKg,
    remarks: entry.remarks?.trim() ?? "",
  });

  return store(
    "MILL_INWARD",
    entry.id,
    `Mill-Inward-${safeName(entry.srNo)}.pdf`,
    mill.mobile,
    bytes,
  );
}

export async function storeMillProgramPdf(id: string, sentAt: Date) {
  const program = await prisma.millProgramEntry.findUniqueOrThrow({
    where: { id },
    include: {
      mill: { select: millSelect },
      lines: { orderBy: { sortOrder: "asc" } },
      millInwardEntry: {
        include: {
          mill: { select: millSelect },
          knitter: { select: { knitterName: true } },
          greyBill: { select: { challanNo: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            include: { item: { select: { itemName: true } } },
          },
          rolls: { select: { weightKg: true } },
        },
      },
    },
  });
  const inward = program.millInwardEntry;
  const inwardRolls = inward
    ? inward.rolls.length > 0
      ? inward.rolls.length
      : inward.items.reduce((sum, item) => sum + decNum(item.rolls), 0)
    : 0;
  const mill = millOf(program.mill ?? inward?.mill ?? null);

  const bytes = await renderMillProgramPdf({
    srNo: program.srNo,
    programDate: program.programDate,
    sentAt,
    mill,
    inwardSrNo: inward?.srNo ?? "",
    dateOfIssue: inward?.dateOfIssue ?? null,
    knitterName: inward?.knitter?.knitterName ?? "",
    challanNo: inward?.greyBill?.challanNo.trim() ?? "",
    itemLabel: inward
      ? inward.items
          .map((item) => item.item?.itemName.trim() ?? "")
          .filter(Boolean)
          .join(" · ")
      : "",
    inwardRolls,
    typeOfFinish: program.typeOfFinish,
    gsm: program.gsm,
    width: program.width,
    lines: program.lines
      .filter((line) => line.rolls != null)
      .map((line) => ({
        rolls: line.rolls ?? 0,
        colour: line.colour,
      })),
  });

  return store(
    "MILL_PROGRAM",
    program.id,
    `Mill-Program-${safeName(program.srNo)}.pdf`,
    mill.mobile,
    bytes,
  );
}
