"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const CGST_PCT = 2.5;
const SGST_PCT = 2.5;

export type SaleLookupOption = { id: string; label: string };

export type SaleCustomerOption = SaleLookupOption & {
  salesAgentId: string;
  agentName: string;
};

export type SaleLookups = {
  customers: SaleCustomerOption[];
  agents: SaleLookupOption[];
  hastes: SaleLookupOption[];
  transports: SaleLookupOption[];
  items: SaleLookupOption[];
};

export type SaleDeskRoll = {
  id: string;
  weight: string;
  liveStockRollId: string;
  rollNo: string;
  stockKg: string;
  qualityState: string;
  reference: string;
};

export type SaleDeskLine = {
  id: string;
  itemId: string;
  itemName: string;
  colourCode: string;
  hsn: string;
  noOfRolls: string;
  rolls: SaleDeskRoll[];
  weightKg: string;
  rate: string;
};

export type SaleDeskBill = {
  id: string;
  billNo: string;
  billDate: string;
  challanNo: string;
  customerId: string;
  customerName: string;
  agentId: string;
  agentName: string;
  hasteId: string;
  hasteName: string;
  lrNo: string;
  transportId: string;
  transportName: string;
  noOfParcel: string;
  ewayNumber: string;
  lrDate: string;
  destination: string;
  lines: SaleDeskLine[];
  paymentWithinDays: string;
  discount: string;
  addLessAmount: string;
  freight: string;
  cgstPct: string;
  sgstPct: string;
  cgstAmount: string;
  sgstAmount: string;
  grossAmount: string;
  netAmount: string;
  totalRolls: string;
  totalWeightKg: string;
  status: "OPEN" | "DRAFT";
  createdAt: string;
  updatedAt: string;
};

export type SaleLineInput = {
  itemId: string;
  colourCode: string;
  hsn: string;
  noOfRolls: string;
  rate: string;
  rolls: { weight: string; liveStockRollId?: string }[];
};

export type SaleBillInput = {
  billDate: string;
  challanNo: string;
  salesMasterId: string;
  hasteId: string;
  lrNo: string;
  transportId: string;
  noOfParcel: string;
  ewayNumber: string;
  lrDate: string;
  destination: string;
  paymentWithinDays: string;
  discount: string;
  addLessAmount: string;
  freight: string;
  lines: SaleLineInput[];
};

export type SaleBillStatus = "OPEN" | "DRAFT";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Enter bill date.");
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function discountPct(raw: string) {
  const text = raw.trim().replace(/%/g, "").replace(/\.$/, "");
  if (!text) return 0;
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error("Enter a valid discount percentage.");
  }
  const n = Number(text);
  if (n > 100) throw new Error("Discount cannot be more than 100%.");
  return n;
}

function money2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function decText(value: { toString(): string } | null | undefined) {
  if (value == null) return "";
  return value.toString();
}

function isUnique(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function lineWeight(rolls: { weight: string }[]) {
  return rolls.reduce((sum, roll) => {
    const weight = Number(roll.weight);
    return Number.isFinite(weight) && weight > 0 ? sum + weight : sum;
  }, 0);
}

function kgKey(raw: string) {
  const text = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFrac = frac.replace(/0+$/, "");
  return normalizedFrac ? `${normalizedWhole}.${normalizedFrac}` : normalizedWhole;
}

function syncRolls(
  rolls: { weight: string; liveStockRollId?: string }[],
  count: number,
) {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const next = rolls.slice(0, n).map((roll) => ({
    weight: roll.weight,
    liveStockRollId: roll.liveStockRollId ?? "",
  }));
  while (next.length < n) next.push({ weight: "", liveStockRollId: "" });
  return next;
}

function compute(lines: SaleLineInput[], discount: string, freight: string) {
  const prepared = lines.map((line) => {
    const rolls = syncRolls(line.rolls, num(line.noOfRolls));
    const weight = lineWeight(rolls);
    const amount = money2(weight * num(line.rate));
    return { ...line, rolls, weight, amount };
  });
  const totalRolls = prepared.reduce((sum, line) => sum + num(line.noOfRolls), 0);
  const totalWeightKg = prepared.reduce((sum, line) => sum + line.weight, 0);
  const grossAmount = money2(prepared.reduce((sum, line) => sum + line.amount, 0));
  const discountAmount = money2(grossAmount * (discountPct(discount) / 100));
  const freightAmount =
    totalWeightKg > 0 ? money2(num(freight) * totalWeightKg) : 0;
  const taxableAmount = money2(
    Math.max(0, grossAmount - discountAmount + freightAmount),
  );
  const cgstAmount = money2(taxableAmount * (CGST_PCT / 100));
  const sgstAmount = money2(taxableAmount * (SGST_PCT / 100));
  const netAmount = money2(taxableAmount + cgstAmount + sgstAmount);
  return {
    prepared,
    totalRolls,
    totalWeightKg,
    grossAmount,
    discountAmount,
    freightAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    netAmount,
  };
}

const billInclude = {
  salesMaster: {
    select: {
      accountName: true,
      salesAgentId: true,
      salesAgent: { select: { agentName: true } },
    },
  },
  haste: { select: { hasteName: true } },
  transport: { select: { transportName: true } },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      item: { select: { itemName: true } },
      rolls: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          liveStockRoll: {
            select: {
              rollNo: true,
              qualityState: true,
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
          },
        },
      },
    },
  },
} as const;

type BillRow = {
  id: string;
  billNo: string;
  billDate: Date;
  challanNo: string;
  salesMasterId: string | null;
  lrNo: string;
  hasteId: string | null;
  transportId: string | null;
  noOfParcel: string;
  ewayNumber: string;
  lrDate: Date | null;
  destination: string;
  paymentWithinDays: string;
  discount: string;
  addLessAmount: string;
  freight: string;
  cgstAmount: { toString(): string };
  sgstAmount: { toString(): string };
  grossAmount: { toString(): string };
  netAmount: { toString(): string };
  totalRolls: { toString(): string };
  totalWeightKg: { toString(): string };
  status: string;
  createdAt: Date;
  updatedAt: Date;
  salesMaster: {
    accountName: string;
    salesAgentId: string;
    salesAgent: { agentName: string };
  } | null;
  haste: { hasteName: string } | null;
  transport: { transportName: string } | null;
  lines: {
    id: string;
    itemId: string | null;
    colourCode: string;
    hsn: string;
    noOfRolls: string;
    weightKg: { toString(): string };
    rate: string;
    item: { itemName: string } | null;
    rolls: {
      id: string;
      weight: string;
      liveStockRollId: string | null;
      liveStockRoll: {
        rollNo: string;
        qualityState: string;
        qualityCheckEntry: { srNo: string };
        finishedWorkEntryRoll: {
          finishedKg: { toString(): string };
          line: { entry: { srNo: string; challanNo: string } };
        } | null;
      } | null;
    }[];
  }[];
};

function toBill(row: BillRow): SaleDeskBill {
  return {
    id: row.id,
    billNo: row.billNo,
    billDate: isoDate(row.billDate),
    challanNo: row.challanNo,
    customerId: row.salesMasterId ?? "",
    customerName: row.salesMaster?.accountName ?? "",
    agentId: row.salesMaster?.salesAgentId ?? "",
    agentName: row.salesMaster?.salesAgent.agentName ?? "",
    hasteId: row.hasteId ?? "",
    hasteName: row.haste?.hasteName ?? "",
    lrNo: row.lrNo,
    transportId: row.transportId ?? "",
    transportName: row.transport?.transportName ?? "",
    noOfParcel: row.noOfParcel,
    ewayNumber: row.ewayNumber,
    lrDate: row.lrDate ? isoDate(row.lrDate) : "",
    destination: row.destination,
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId ?? "",
      itemName: line.item?.itemName ?? "",
      colourCode: line.colourCode,
      hsn: line.hsn,
      noOfRolls: line.noOfRolls,
      rolls: line.rolls.map((roll) => {
        const stock = roll.liveStockRoll;
        const finished = stock?.finishedWorkEntryRoll ?? null;
        const reference = stock
          ? [
              stock.qualityCheckEntry.srNo.trim()
                ? `QC ${stock.qualityCheckEntry.srNo.trim()}`
                : "",
              finished?.line.entry.challanNo.trim() ||
                finished?.line.entry.srNo.trim() ||
                "",
            ]
              .filter(Boolean)
              .join(" · ")
          : "";
        return {
          id: roll.id,
          weight: roll.weight,
          liveStockRollId: roll.liveStockRollId ?? "",
          rollNo: stock?.rollNo ?? "",
          stockKg: finished ? finished.finishedKg.toString() : "",
          qualityState: stock?.qualityState ?? "",
          reference,
        };
      }),
      weightKg: decText(line.weightKg),
      rate: line.rate,
    })),
    paymentWithinDays: row.paymentWithinDays,
    discount: row.discount,
    addLessAmount: row.addLessAmount,
    freight: row.freight,
    cgstPct: String(CGST_PCT),
    sgstPct: String(SGST_PCT),
    cgstAmount: decText(row.cgstAmount),
    sgstAmount: decText(row.sgstAmount),
    grossAmount: decText(row.grossAmount),
    netAmount: decText(row.netAmount),
    totalRolls: decText(row.totalRolls),
    totalWeightKg: decText(row.totalWeightKg),
    status: row.status === "DRAFT" ? "DRAFT" : "OPEN",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function nextBillNo(tx: Prisma.TransactionClient, iso: string) {
  const stamp = dateStamp(iso);
  const rows = await tx.salesBillEntry.findMany({
    where: { billNo: { endsWith: `-${stamp}` } },
    select: { billNo: true },
  });
  const used = rows
    .map((row) => Number(row.billNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

async function resolve(
  tx: Prisma.TransactionClient,
  input: SaleBillInput,
  status: SaleBillStatus,
) {
  const billDate = input.billDate.trim();
  if (status === "OPEN" && !billDate) throw new Error("Enter bill date.");
  const dateIso = billDate || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error("Enter bill date.");

  const salesMasterId = input.salesMasterId.trim();
  if (status === "OPEN" && !salesMasterId) throw new Error("Select customer name.");
  if (salesMasterId) {
    const customer = await tx.salesMaster.findUnique({
      where: { id: salesMasterId },
      select: { id: true },
    });
    if (!customer) throw new Error("Select customer name.");
  }

  const hasteId = input.hasteId.trim();
  if (hasteId) {
    const haste = await tx.haste.findUnique({
      where: { id: hasteId },
      select: { id: true },
    });
    if (!haste) throw new Error("Haste not found.");
  }

  const transportId = input.transportId.trim();
  if (transportId) {
    const transport = await tx.transport.findUnique({
      where: { id: transportId },
      select: { id: true },
    });
    if (!transport) throw new Error("Transport not found.");
  }

  const lrDate = input.lrDate.trim();
  if (lrDate && !/^\d{4}-\d{2}-\d{2}$/.test(lrDate)) {
    throw new Error("Enter bill date.");
  }

  const itemIds = [
    ...new Set(input.lines.map((line) => line.itemId.trim()).filter(Boolean)),
  ];
  const items = itemIds.length
    ? await tx.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, itemName: true },
      })
    : [];
  const itemNames = new Map(items.map((item) => [item.id, item.itemName]));
  for (const id of itemIds) {
    if (!itemNames.has(id)) throw new Error("Select a valid item.");
  }

  const lines = await colourCodesFor(tx, input.lines);
  const named = lines.filter((line) => line.itemId.trim());
  if (status === "OPEN" && named.length === 0) {
    throw new Error("Add at least one item.");
  }
  if (status === "OPEN") {
    for (const line of named) {
      if (num(line.noOfRolls) <= 0) {
        const name = itemNames.get(line.itemId.trim()) || "item";
        throw new Error(`Enter no. of rolls for ${name}.`);
      }
    }
  }

  const totals = compute(lines, input.discount, input.freight);
  return {
    billDate: asDate(dateIso),
    dateIso,
    salesMasterId: salesMasterId || null,
    hasteId: hasteId || null,
    transportId: transportId || null,
    lrDate: lrDate ? asDate(lrDate) : null,
    totals,
  };
}

async function colourCodesFor(
  tx: Prisma.TransactionClient,
  lines: SaleLineInput[],
) {
  const trimmed = lines.map((line) => ({
    ...line,
    colourCode: line.colourCode.trim(),
  }));
  const keys = [...new Set(trimmed.map((line) => line.colourCode).filter(Boolean))];
  if (keys.length === 0) return trimmed;
  const rows = await tx.colorCode.findMany({
    where: { colorCode: { in: keys } },
    select: { colorCode: true },
  });
  const found = new Set(rows.map((row) => row.colorCode));
  for (const key of keys) {
    if (!found.has(key)) throw new Error(`Color code "${key}" was not found.`);
  }
  return trimmed;
}

function lineCreates(
  prepared: ReturnType<typeof compute>["prepared"],
  status: SaleBillStatus,
) {
  return prepared.map((line, index) => ({
    sortOrder: index,
    itemId: line.itemId.trim() || null,
    colourCode: line.colourCode,
    hsn: line.hsn,
    noOfRolls: line.noOfRolls,
    weightKg: String(line.weight),
    rate: line.rate,
    amount: String(line.amount),
    rolls: {
      create: line.rolls.map((roll, rollIndex) => ({
        sortOrder: rollIndex,
        weight: roll.weight,
        liveStockRollId:
          status === "OPEN" && line.itemId.trim()
            ? roll.liveStockRollId.trim() || null
            : null,
      })),
    },
  }));
}

function headerData(
  input: SaleBillInput,
  resolved: Awaited<ReturnType<typeof resolve>>,
) {
  const totals = resolved.totals;
  return {
    billDate: resolved.billDate,
    challanNo: input.challanNo,
    salesMasterId: resolved.salesMasterId,
    hasteId: resolved.hasteId,
    lrNo: input.lrNo,
    transportId: resolved.transportId,
    noOfParcel: input.noOfParcel,
    ewayNumber: input.ewayNumber,
    lrDate: resolved.lrDate,
    destination: input.destination,
    paymentWithinDays: input.paymentWithinDays,
    discount: input.discount,
    addLessAmount: input.addLessAmount,
    freight: input.freight,
    cgstPct: String(CGST_PCT),
    sgstPct: String(SGST_PCT),
    cgstAmount: String(totals.cgstAmount),
    sgstAmount: String(totals.sgstAmount),
    grossAmount: String(totals.grossAmount),
    discountAmount: String(totals.discountAmount),
    freightAmount: String(totals.freightAmount),
    taxableAmount: String(totals.taxableAmount),
    netAmount: String(totals.netAmount),
    totalRolls: String(totals.totalRolls),
    totalWeightKg: String(totals.totalWeightKg),
  };
}

function pairKey(qcId: string, rollId: string) {
  return `${qcId}\u0000${rollId}`;
}

function codesByStockPair(
  lines: { qcId: string; finishedWorkEntryRollId: string | null; codeNo: string }[],
) {
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

async function releaseBillStock(tx: Prisma.TransactionClient, billId: string) {
  const linked = await tx.salesBillEntryRoll.findMany({
    where: { line: { billId }, liveStockRollId: { not: null } },
    select: { liveStockRollId: true },
  });
  const ids = [
    ...new Set(
      linked
        .map((row) => row.liveStockRollId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return;
  await tx.liveStockRoll.updateMany({
    where: { id: { in: ids }, status: "sold" },
    data: { status: "available" },
  });
}

async function previousRollWeights(tx: Prisma.TransactionClient, billId: string) {
  const rows = await tx.salesBillEntryRoll.findMany({
    where: { line: { billId }, liveStockRollId: { not: null } },
    select: { liveStockRollId: true, weight: true },
  });
  const weights = new Map<string, string>();
  for (const row of rows) {
    if (row.liveStockRollId && !weights.has(row.liveStockRollId)) {
      weights.set(row.liveStockRollId, row.weight);
    }
  }
  return weights;
}

async function claimStock(
  tx: Prisma.TransactionClient,
  lines: {
    itemId: string;
    colourCode: string;
    rolls: { weight: string; liveStockRollId: string }[];
  }[],
  previousWeights: Map<string, string>,
) {
  const wanted: {
    id: string;
    itemId: string;
    colourCode: string;
    weight: string;
  }[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const itemId = line.itemId.trim();
    if (!itemId) continue;
    const colourCode = line.colourCode.trim();
    if (!colourCode) throw new Error("Enter a color code.");
    for (const roll of line.rolls) {
      const id = roll.liveStockRollId.trim();
      if (!id) throw new Error("Select stock rolls for every item.");
      if (seen.has(id)) throw new Error("A stock roll is selected more than once.");
      seen.add(id);
      wanted.push({ id, itemId, colourCode, weight: roll.weight });
    }
  }
  if (wanted.length === 0) return;

  const stock = await tx.liveStockRoll.findMany({
    where: { id: { in: wanted.map((row) => row.id) } },
    select: {
      id: true,
      status: true,
      qualityCheckEntryId: true,
      finishedWorkEntryRollId: true,
      finishedWorkEntryRoll: {
        select: {
          finishedKg: true,
          line: { select: { itemId: true } },
        },
      },
    },
  });
  const byId = new Map(stock.map((row) => [row.id, row]));
  const qcIds = [...new Set(stock.map((row) => row.qualityCheckEntryId))];
  const rollIds = [
    ...new Set(
      stock
        .map((row) => row.finishedWorkEntryRollId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const qcLines =
    qcIds.length === 0 || rollIds.length === 0
      ? []
      : await tx.qualityCheckEntryLine.findMany({
          where: {
            qcId: { in: qcIds },
            finishedWorkEntryRollId: { in: rollIds },
          },
          select: { qcId: true, finishedWorkEntryRollId: true, codeNo: true },
        });
  const codes = codesByStockPair(qcLines);

  for (const want of wanted) {
    const row = byId.get(want.id);
    const code = row?.finishedWorkEntryRollId
      ? codes.get(pairKey(row.qualityCheckEntryId, row.finishedWorkEntryRollId))
      : undefined;
    const actual = row?.finishedWorkEntryRoll?.finishedKg?.toString() ?? "";
    const previous = previousWeights.get(want.id);
    const matchesActual = Boolean(actual) && kgKey(want.weight) === kgKey(actual);
    const matchesHistory =
      previous != null && kgKey(want.weight) === kgKey(previous);
    if (
      !row ||
      row.status !== "available" ||
      row.finishedWorkEntryRoll?.line.itemId !== want.itemId ||
      !code ||
      code !== want.colourCode ||
      (!matchesActual && !matchesHistory)
    ) {
      throw new Error(
        matchesActual || matchesHistory
          ? "A selected roll is not available for this item and color code."
          : "A selected roll weight does not match the available stock weight.",
      );
    }
  }

  for (const want of wanted) {
    const result = await tx.liveStockRoll.updateMany({
      where: { id: want.id, status: "available" },
      data: { status: "sold" },
    });
    if (result.count !== 1) {
      throw new Error("A selected roll is no longer available.");
    }
  }
}

async function writeBill(
  tx: Prisma.TransactionClient,
  id: string | null,
  input: SaleBillInput,
  status: SaleBillStatus,
) {
  const resolved = await resolve(tx, input, status);
  const data = headerData(input, resolved);
  const previousWeights = id ? await previousRollWeights(tx, id) : new Map<string, string>();
  if (id) {
    await releaseBillStock(tx, id);
    await tx.salesBillEntryLine.deleteMany({ where: { billId: id } });
  }
  if (status === "OPEN") {
    await claimStock(tx, resolved.totals.prepared, previousWeights);
  }
  const lines = lineCreates(resolved.totals.prepared, status);
  if (!id) {
    return tx.salesBillEntry.create({
      data: {
        ...data,
        billNo: await nextBillNo(tx, resolved.dateIso),
        status,
        lines: { create: lines },
      },
      include: billInclude,
    });
  }
  return tx.salesBillEntry.update({
    where: { id },
    data: {
      ...data,
      status,
      lines: { create: lines },
    },
    include: billInclude,
  });
}

async function commit(
  id: string | null,
  input: SaleBillInput,
  status: SaleBillStatus,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const row = await prisma.$transaction((tx) =>
        writeBill(tx, id, input, status),
      );
      revalidatePath("/sales");
      if (status === "OPEN" || id) revalidatePath("/live-stock");
      return toBill(row);
    } catch (error) {
      if (!isUnique(error) || attempt === 1) throw error;
    }
  }
  throw new Error("Could not save the sales bill.");
}

export async function listSaleLookups(): Promise<SaleLookups> {
  await requireUser();
  const [customers, agents, hastes, transports, items] = await Promise.all([
    prisma.salesMaster.findMany({
      orderBy: { accountName: "asc" },
      select: {
        id: true,
        accountName: true,
        salesAgentId: true,
        salesAgent: { select: { agentName: true } },
      },
    }),
    prisma.salesAgent.findMany({
      orderBy: { agentName: "asc" },
      select: { id: true, agentName: true },
    }),
    prisma.haste.findMany({
      orderBy: { hasteName: "asc" },
      select: { id: true, hasteName: true },
    }),
    prisma.transport.findMany({
      orderBy: { transportName: "asc" },
      select: { id: true, transportName: true },
    }),
    prisma.item.findMany({
      orderBy: { itemName: "asc" },
      select: { id: true, itemName: true },
    }),
  ]);
  return {
    customers: customers.map((row) => ({
      id: row.id,
      label: row.accountName,
      salesAgentId: row.salesAgentId,
      agentName: row.salesAgent.agentName,
    })),
    agents: agents.map((row) => ({ id: row.id, label: row.agentName })),
    hastes: hastes.map((row) => ({ id: row.id, label: row.hasteName })),
    transports: transports.map((row) => ({ id: row.id, label: row.transportName })),
    items: items.map((row) => ({ id: row.id, label: row.itemName })),
  };
}

export async function listSaleBills(): Promise<SaleDeskBill[]> {
  await requireUser();
  const rows = await prisma.salesBillEntry.findMany({
    include: billInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toBill(row));
}

export async function createSaleBill(
  input: SaleBillInput,
  status: SaleBillStatus,
): Promise<SaleDeskBill> {
  await requireUser();
  if (status !== "OPEN" && status !== "DRAFT") {
    throw new Error("Could not save the sales bill.");
  }
  return commit(null, input, status);
}

export async function updateSaleBill(
  id: string,
  input: SaleBillInput,
  status: SaleBillStatus,
): Promise<SaleDeskBill> {
  await requireUser();
  if (status !== "OPEN" && status !== "DRAFT") {
    throw new Error("Could not save the sales bill.");
  }
  const existing = await prisma.salesBillEntry.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Sales bill not found.");
  return commit(id, input, status);
}

export async function deleteSaleBill(id: string): Promise<void> {
  await requireUser();
  if (!id.trim()) throw new Error("Sales bill not found.");
  const existing = await prisma.salesBillEntry.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Sales bill not found.");
  if (existing.status !== "DRAFT") {
    throw new Error("Only draft sales bills can be deleted.");
  }
  await prisma.salesBillEntry.delete({ where: { id } });
  revalidatePath("/sales");
}
