"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type ColorCodeRecord = {
  id: string;
  code: string;
  name: string;
};

export type ColorQualityRecord = {
  id: string;
  qualityName: string;
  codes: ColorCodeRecord[];
  createdAt: string;
  updatedAt: string;
};

export type ColorCodeInput = {
  id?: string;
  code: string;
  name: string;
};

export type ColorQualityInput = {
  qualityName: string;
  codes: ColorCodeInput[];
};

export type ColorCodeLookupResult =
  | { status: "found"; colorName: string }
  | { status: "empty" }
  | { status: "not_found" };

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function assertInput(input: ColorQualityInput) {
  if (!input.qualityName.trim()) throw new Error("Enter quality name.");
  if (!input.codes.length) throw new Error("Add at least one color code.");
  const seen = new Set<string>();
  for (const code of input.codes) {
    const key = code.code.trim();
    if (!key || !code.name.trim()) {
      throw new Error("Enter a color code and color name on every row.");
    }
    if (seen.has(key)) {
      throw new Error(`Color code "${key}" is entered more than once.`);
    }
    seen.add(key);
  }
}

function friendlyUnique(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = String(error.meta?.target ?? "");
    if (target.includes("qualityName")) {
      throw new Error("That quality name is already used.");
    }
    if (target.includes("colorCode")) {
      throw new Error("That color code is already used.");
    }
    throw new Error("That value is already used.");
  }
  throw error;
}

async function assertAvailable(input: ColorQualityInput, qualityId?: string) {
  const qualityName = input.qualityName.trim();
  const nameTaken = await prisma.colorQuality.findFirst({
    where: {
      qualityName,
      ...(qualityId ? { id: { not: qualityId } } : {}),
    },
    select: { id: true },
  });
  if (nameTaken) throw new Error("That quality name is already used.");

  const keys = input.codes.map((code) => code.code.trim());
  const taken = await prisma.colorCode.findFirst({
    where: {
      colorCode: { in: keys },
      ...(qualityId ? { qualityId: { not: qualityId } } : {}),
    },
    include: { quality: { select: { qualityName: true } } },
  });
  if (taken) {
    throw new Error(
      `Color code "${taken.colorCode}" is already used on ${taken.quality.qualityName}.`,
    );
  }
}

function toRecord(row: {
  id: string;
  qualityName: string;
  createdAt: Date;
  updatedAt: Date;
  colorCodes: { id: string; colorCode: string; colorName: string }[];
}): ColorQualityRecord {
  return {
    id: row.id,
    qualityName: row.qualityName,
    codes: row.colorCodes.map((code) => ({
      id: code.id,
      code: code.colorCode,
      name: code.colorName,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const includeCodes = {
  colorCodes: { orderBy: { createdAt: "asc" as const } },
};

export async function listColorQualities(): Promise<ColorQualityRecord[]> {
  await requireUser();
  const rows = await prisma.colorQuality.findMany({
    orderBy: { createdAt: "asc" },
    include: includeCodes,
  });
  return rows.map(toRecord);
}

export async function lookupColorCode(
  colorCode: string,
): Promise<ColorCodeLookupResult> {
  await requireUser();
  const key = colorCode.trim();
  if (!key) return { status: "empty" };
  const row = await prisma.colorCode.findUnique({
    where: { colorCode: key },
    select: { colorName: true },
  });
  if (!row) return { status: "not_found" };
  return { status: "found", colorName: row.colorName };
}

export async function createColorQuality(
  input: ColorQualityInput,
): Promise<ColorQualityRecord> {
  await requireUser();
  assertInput(input);
  await assertAvailable(input);
  try {
    const row = await prisma.colorQuality.create({
      data: {
        qualityName: input.qualityName.trim(),
        colorCodes: {
          create: input.codes.map((code) => ({
            colorCode: code.code.trim(),
            colorName: code.name.trim(),
          })),
        },
      },
      include: includeCodes,
    });
    revalidatePath("/masters/color-codes");
    return toRecord(row);
  } catch (error) {
    friendlyUnique(error);
  }
}

export async function updateColorQuality(
  id: string,
  input: ColorQualityInput,
): Promise<ColorQualityRecord> {
  await requireUser();
  if (!id.trim()) throw new Error("Quality not found.");
  assertInput(input);
  const existing = await prisma.colorQuality.findUnique({
    where: { id },
    include: { colorCodes: { select: { id: true } } },
  });
  if (!existing) throw new Error("Quality not found.");
  await assertAvailable(input, id);
  const keptIds = new Set(existing.colorCodes.map((code) => code.id));
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.colorQuality.update({
        where: { id },
        data: { qualityName: input.qualityName.trim() },
      });
      const incomingIds = input.codes
        .map((code) => code.id)
        .filter((codeId): codeId is string => Boolean(codeId && keptIds.has(codeId)));
      await tx.colorCode.deleteMany({
        where: { qualityId: id, id: { notIn: incomingIds } },
      });
      for (const codeId of incomingIds) {
        await tx.colorCode.update({
          where: { id: codeId },
          data: { colorCode: `pending:${codeId}` },
        });
      }
      for (const code of input.codes) {
        const colorCode = code.code.trim();
        const colorName = code.name.trim();
        if (code.id && keptIds.has(code.id)) {
          await tx.colorCode.update({
            where: { id: code.id },
            data: { colorCode, colorName },
          });
        } else {
          await tx.colorCode.create({
            data: { qualityId: id, colorCode, colorName },
          });
        }
      }
      return tx.colorQuality.findUniqueOrThrow({
        where: { id },
        include: includeCodes,
      });
    });
    revalidatePath("/masters/color-codes");
    return toRecord(row);
  } catch (error) {
    friendlyUnique(error);
  }
}

export async function deleteColorQuality(id: string): Promise<void> {
  await requireUser();
  if (!id.trim()) throw new Error("Quality not found.");
  const existing = await prisma.colorQuality.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Quality not found.");
  await prisma.colorQuality.delete({ where: { id } });
  revalidatePath("/masters/color-codes");
}
