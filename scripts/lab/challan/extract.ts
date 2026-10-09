import path from "node:path";
import { requestGeminiJson } from "../shared/gemini.ts";
import type { LabDocument } from "../shared/prepare.ts";

export type ChallanRoll = {
  srNo: number;
  rollNo: string;
  weightKg: number;
};

export type ChallanExtraction = {
  challanNo: string | null;
  challanDate: string | null;
  knitter: string | null;
  mill: string | null;
  agent: string | null;
  item: string | null;
  quantityRolls: number | null;
  quantityKg: number | null;
  rolls: ChallanRoll[];
  remark: string | null;
};

const FIELDS = [
  "challanNo",
  "challanDate",
  "knitter",
  "mill",
  "agent",
  "item",
  "quantityRolls",
  "quantityKg",
  "remark",
] as const;

const TEXT_FIELDS = new Set([
  "challanNo",
  "challanDate",
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
  properties: {
    ...Object.fromEntries(
      FIELDS.map((field) => [
        field,
        {
          type: TEXT_FIELDS.has(field) ? "STRING" : "NUMBER",
          nullable: true,
        },
      ]),
    ),
    rolls: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          srNo: { type: "NUMBER" },
          rollNo: { type: "STRING" },
          weightKg: { type: "NUMBER" },
        },
        required: ["srNo", "rollNo", "weightKg"],
      },
    },
  },
  required: [...FIELDS, "rolls"],
};

const PROMPT = `Extract one delivery challan from this document.
Challans from different clients use different layouts. Identify each field by its label, heading, or meaning. Do not assume a field sits in a fixed place on the page.

Return JSON with exactly these fields:
- challanNo: the challan number
- challanDate: the challan date, as YYYY-MM-DD when the printed date can be read
- knitter: the knitter, weaver, or supplier named as the knitter
- mill: the mill
- agent: the agent or broker
- item: the fabric or goods description
- quantityRolls: the printed total number of rolls or takas
- quantityKg: the printed total quantity in kilograms
- rolls: every individual roll or taka row printed on the document, in printed order, including rows that continue in another column or on another page
- remark: remarks or notes

Each roll object must contain:
- srNo: the printed serial number for that row
- rollNo: the exact Taka No. or Roll No. printed for that row, as a string. Keep every digit and any leading zeros. Do not turn it into a number.
- weightKg: the exact individual weight printed for that row. Do not round it.

Extract every printed roll row. Do not skip rows and do not add rows that are not printed. If a roll row cannot be read reliably, omit that row instead of guessing its number or weight. Use null for any header field that is not printed. Do not guess, calculate, or fill a missing value from another field. Keep the document's own numbers. Do not include currency symbols or thousands separators.`;

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const local = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!local) return text;
  const day = local[1].padStart(2, "0");
  const month = local[2].padStart(2, "0");
  return `${local[3]}-${month}-${day}`;
}

function rollNoText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return textOrNull(value);
}

function normalizeRolls(value: unknown) {
  const rolls: ChallanRoll[] = [];
  const unreadable: string[] = [];
  const rowWeights: Array<number | null> = [];
  if (!Array.isArray(value)) return { rolls, unreadable, rowWeights };
  value.forEach((row, index) => {
    const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const srNo = numberOrNull(source.srNo);
    const rollNo = rollNoText(source.rollNo);
    const weightKg = numberOrNull(source.weightKg);
    if (weightKg === null) {
      unreadable.push(`Row ${index + 1} weight could not be read.`);
      rowWeights.push(null);
      return;
    }
    rowWeights.push(weightKg);
    if (srNo === null || rollNo === null) {
      unreadable.push(
        `Row ${index + 1} weight was read, but its roll number was not. The weight stays on this row.`,
      );
    }
    rolls.push({ srNo: srNo ?? index + 1, rollNo: rollNo ?? "", weightKg });
  });
  return { rolls, unreadable, rowWeights };
}

function normalize(value: unknown): {
  challan: ChallanExtraction;
  unreadable: string[];
  rowWeights: Array<number | null>;
} {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const { rolls, unreadable, rowWeights } = normalizeRolls(source.rolls);
  return {
    challan: {
      challanNo: textOrNull(source.challanNo),
      challanDate: dateOrNull(source.challanDate),
      knitter: textOrNull(source.knitter),
      mill: textOrNull(source.mill),
      agent: textOrNull(source.agent),
      item: textOrNull(source.item),
      quantityRolls: numberOrNull(source.quantityRolls),
      quantityKg: numberOrNull(source.quantityKg),
      rolls,
      remark: textOrNull(source.remark),
    },
    unreadable,
    rowWeights,
  };
}

export async function extractChallan(
  document: LabDocument,
): Promise<{ challan: ChallanExtraction; unreadable: string[]; rowWeights: Array<number | null> }> {
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

export function printChallanReport(
  filePath: string,
  challan: ChallanExtraction,
  unreadable: string[] = [],
) {
  const missing = FIELDS.filter((field) => challan[field] === null);
  const weightSum = challan.rolls.reduce((sum, roll) => sum + roll.weightKg, 0);
  const countMatches = challan.quantityRolls !== null && challan.rolls.length === challan.quantityRolls;
  const weightDifference = challan.quantityKg === null ? null : Math.abs(weightSum - challan.quantityKg);
  const weightMatches = weightDifference !== null && weightDifference <= 0.001;
  console.log("Document type: challan");
  console.log(`Selected file: ${path.resolve(filePath)}`);
  console.log("");
  console.log("Extracted fields");
  for (const field of FIELDS) {
    if (challan[field] !== null) console.log(`${field}: ${challan[field]}`);
  }
  console.log(`rolls: ${challan.rolls.length}`);
  console.log("");
  console.log(missing.length === 0 ? "Missing fields: none" : "Missing fields");
  for (const field of missing) console.log(`- ${field}`);
  console.log("");
  console.log(`Extracted roll count: ${challan.rolls.length}`);
  console.log(`Calculated total KG: ${weightSum}`);
  console.log(
    countMatches
      ? "Roll count validation: passed"
      : `Roll count validation: failed. Extracted ${challan.rolls.length} rolls, quantityRolls is ${challan.quantityRolls ?? "missing"}.`,
  );
  console.log(
    weightMatches
      ? `Weight validation: passed. Difference ${weightDifference} KG.`
      : `Weight validation: failed. Calculated ${weightSum} KG, quantityKg is ${challan.quantityKg ?? "missing"}.`,
  );
  console.log(unreadable.length === 0 ? "Unreadable rolls: none" : "Unreadable rolls");
  for (const problem of unreadable) console.log(`- ${problem}`);
  console.log("");
  console.log("Raw JSON");
  console.log(JSON.stringify(challan, null, 2));
}
