import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  GreyBillExtract,
  GreyChallanExtract,
  GreyUploadReview,
} from "../lib/grey-upload-check.ts";
import { extractBill } from "../../scripts/lab/bill/extract.ts";
import { extractChallan } from "../../scripts/lab/challan/extract.ts";

export type { GreyUploadReview };

const SUPPORTED = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

function text(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function prefer(primary: string | null, fallback: string | null) {
  const first = primary?.trim() ?? "";
  if (first) return first;
  return fallback?.trim() ?? "";
}

function extensionOf(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED.has(extension)) {
    throw new Error(
      `Unsupported file type "${extension || "(none)"}" for ${fileName}. Use PDF, JPG, JPEG, or PNG.`,
    );
  }
  return extension;
}

async function withTempDocument<T>(
  kind: "bill" | "challan",
  fileName: string,
  bytes: Buffer,
  run: (document: { kind: "bill" | "challan"; filePath: string; extension: string }) => Promise<T>,
) {
  const extension = extensionOf(fileName);
  const dir = await mkdtemp(path.join(tmpdir(), "mapps-grey-upload-"));
  try {
    const filePath = path.join(dir, `${kind}${extension}`);
    await writeFile(filePath, bytes);
    return await run({ kind, filePath, extension });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractGreyBillFile(input: {
  fileName: string;
  bytes: Buffer;
}): Promise<GreyBillExtract> {
  const bill = await withTempDocument("bill", input.fileName, input.bytes, extractBill);
  return {
    billNo: text(bill.billNo),
    billDate: text(bill.billDate),
    knitter: text(bill.knitter),
    mill: text(bill.mill),
    agent: text(bill.agent),
    item: text(bill.item),
    quantityRolls: text(bill.quantityRolls),
    quantityKg: text(bill.quantityKg),
    rate: text(bill.rate),
    remark: text(bill.remark),
    freight: text(bill.freight),
    sgst: text(bill.sgst),
    cgst: text(bill.cgst),
    netAmount: text(bill.netAmount),
  };
}

export async function extractGreyChallanFile(input: {
  fileName: string;
  bytes: Buffer;
}): Promise<GreyChallanExtract> {
  const { challan, unreadable, rowWeights } = await withTempDocument(
    "challan",
    input.fileName,
    input.bytes,
    extractChallan,
  );
  return {
    challanNo: text(challan.challanNo),
    quantityRolls: text(challan.quantityRolls),
    quantityKg: text(challan.quantityKg),
    slots: rowWeights.map((weight) => (weight == null ? "" : String(weight))),
    unreadable,
  };
}

export async function extractGreyUpload(input: {
  billName: string;
  billBytes: Buffer;
  challanName: string;
  challanBytes: Buffer;
}): Promise<GreyUploadReview> {
  const billExtension = extensionOf(input.billName);
  const challanExtension = extensionOf(input.challanName);
  const dir = await mkdtemp(path.join(tmpdir(), "mapps-grey-upload-"));
  try {
    const billPath = path.join(dir, `bill${billExtension}`);
    const challanPath = path.join(dir, `challan${challanExtension}`);
    await writeFile(billPath, input.billBytes);
    await writeFile(challanPath, input.challanBytes);
    const bill = await extractBill({
      kind: "bill",
      filePath: billPath,
      extension: billExtension,
    });
    const { challan, unreadable } = await extractChallan({
      kind: "challan",
      filePath: challanPath,
      extension: challanExtension,
    });
    const notes = [...unreadable];
    if (bill.knitter && challan.knitter && bill.knitter.trim() !== challan.knitter.trim()) {
      notes.push("Bill knitter and challan knitter differ. The bill value is shown and can be edited.");
    }
    if (bill.mill && challan.mill && bill.mill.trim() !== challan.mill.trim()) {
      notes.push("Bill mill and challan mill differ. The bill value is shown and can be edited.");
    }
    if (bill.item && challan.item && bill.item.trim() !== challan.item.trim()) {
      notes.push("Bill item and challan item differ. The bill value is shown and can be edited.");
    }
    const remarks = [bill.remark, challan.remark].filter((value): value is string => Boolean(value?.trim()));
    return {
      billNo: text(bill.billNo),
      billDate: text(bill.billDate),
      challanNo: text(challan.challanNo),
      challanDate: text(challan.challanDate),
      knitter: prefer(bill.knitter, challan.knitter),
      mill: prefer(bill.mill, challan.mill),
      agent: text(bill.agent),
      item: prefer(bill.item, challan.item),
      totalRolls: text(challan.quantityRolls ?? bill.quantityRolls),
      totalKg: text(challan.quantityKg ?? bill.quantityKg),
      rate: text(bill.rate),
      amount: text(bill.amount),
      freight: text(bill.freight),
      cgst: text(bill.cgst),
      sgst: text(bill.sgst),
      netAmount: text(bill.netAmount),
      remarks: remarks.join(" · "),
      weights: challan.rolls.map((roll) => String(roll.weightKg)),
      notes,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
