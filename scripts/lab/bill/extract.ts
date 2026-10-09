import path from "node:path";
import { requestGeminiJson } from "../shared/gemini.ts";
import type { LabDocument } from "../shared/prepare.ts";

export type BillExtraction = {
  billNo: string | null;
  billDate: string | null;
  knitter: string | null;
  mill: string | null;
  agent: string | null;
  item: string | null;
  quantityRolls: number | null;
  quantityKg: number | null;
  rate: number | null;
  amount: number | null;
  remark: string | null;
  freight: number | null;
  sgst: number | null;
  cgst: number | null;
  netAmount: number | null;
};

const FIELDS = [
  "billNo",
  "billDate",
  "knitter",
  "mill",
  "agent",
  "item",
  "quantityRolls",
  "quantityKg",
  "rate",
  "amount",
  "remark",
  "freight",
  "sgst",
  "cgst",
  "netAmount",
] as const;

const TEXT_FIELDS = new Set([
  "billNo",
  "billDate",
  "knitter",
  "mill",
  "agent",
  "item",
  "remark",
]);

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const responseSchema = {
  type: "OBJECT",
  properties: Object.fromEntries(
    FIELDS.map((field) => [
      field,
      {
        type: TEXT_FIELDS.has(field) ? "STRING" : "NUMBER",
        nullable: true,
      },
    ]),
  ),
  required: [...FIELDS],
};

const PROMPT = `Extract one grey-purchase bill from this document.
Bills from different clients use different layouts. Identify each field by its label, heading, or meaning. Do not assume a field sits in a fixed place on the page.

Return JSON with exactly these fields:
- billNo: the bill or invoice number
- billDate: the bill date, as YYYY-MM-DD when the printed date can be read
- knitter: the knitter, weaver, or supplier named as the knitter
- mill: the mill
- agent: the agent or broker
- item: the fabric or goods description
- quantityRolls: the number of rolls or takas
- quantityKg: the quantity in kilograms
- rate: the printed rate
- amount: the printed goods or taxable amount for the item
- remark: remarks or notes
- freight: the freight amount
- sgst: the SGST amount
- cgst: the CGST amount
- netAmount: the printed net or payable amount

Use null for any field that is not printed. Do not guess, calculate, or fill a missing value from another field. Keep the document's own numbers. Do not include currency symbols or thousands separators.`;

function textOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.toLowerCase() === "null") return null;
  return text;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[,₹\s]/g, "").trim();
  if (!cleaned || cleaned.toLowerCase() === "null") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: unknown) {
  const text = textOrNull(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const local = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!local) return text;
  const day = local[1].padStart(2, "0");
  const month = local[2].padStart(2, "0");
  return `${local[3]}-${month}-${day}`;
}

function normalize(value: unknown): BillExtraction {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    billNo: textOrNull(source.billNo),
    billDate: dateOrNull(source.billDate),
    knitter: textOrNull(source.knitter),
    mill: textOrNull(source.mill),
    agent: textOrNull(source.agent),
    item: textOrNull(source.item),
    quantityRolls: numberOrNull(source.quantityRolls),
    quantityKg: numberOrNull(source.quantityKg),
    rate: numberOrNull(source.rate),
    amount: numberOrNull(source.amount),
    remark: textOrNull(source.remark),
    freight: numberOrNull(source.freight),
    sgst: numberOrNull(source.sgst),
    cgst: numberOrNull(source.cgst),
    netAmount: numberOrNull(source.netAmount),
  };
}

export async function extractBill(document: LabDocument): Promise<BillExtraction> {
  const mimeType = MIME[document.extension];
  if (!mimeType) {
    throw new Error(`Unsupported file type "${document.extension}". Use PDF, JPG, JPEG, or PNG.`);
  }
  const extracted = await requestGeminiJson({
    prompt: PROMPT,
    filePath: document.filePath,
    mimeType,
    responseSchema,
  });
  return normalize(extracted);
}

export function printBillReport(filePath: string, bill: BillExtraction) {
  const missing = FIELDS.filter((field) => bill[field] === null);
  console.log(`Document type: bill`);
  console.log(`Selected file: ${path.resolve(filePath)}`);
  console.log("");
  console.log("Extracted fields");
  for (const field of FIELDS) {
    if (bill[field] !== null) console.log(`${field}: ${bill[field]}`);
  }
  console.log("");
  console.log(missing.length === 0 ? "Missing fields: none" : "Missing fields");
  for (const field of missing) console.log(`- ${field}`);
  console.log("");
  console.log("Raw JSON");
  console.log(JSON.stringify(bill, null, 2));
}
