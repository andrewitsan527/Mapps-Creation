import { prisma } from "@/lib/db";

export type DocPrefix = "MCSR" | "MCLOT" | "MCSO" | "MCPO" | "RET" | "MCRF";

/** Sequential coded document / lot numbers: PREFIX-YYYYMMDD-NNN */
export async function nextCodedNumber(
  prefix: DocPrefix,
  count: () => Promise<number>,
): Promise<string> {
  const n = await count();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${stamp}-${String(n + 1).padStart(3, "0")}`;
}

export async function nextMcsrLotNo() {
  return nextCodedNumber("MCSR", () =>
    prisma.lot.count({ where: { origin: "SALES_RETURN" } }),
  );
}

export async function nextProgramLotNo() {
  return nextCodedNumber("MCLOT", () =>
    prisma.lot.count({ where: { origin: "PROGRAM" } }),
  );
}

export async function nextMillRfNo() {
  return nextCodedNumber("MCRF", () => prisma.millReturn.count());
}
