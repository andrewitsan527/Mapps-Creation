"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createFabricType(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim() || null;
  const defaultUnit = String(formData.get("defaultUnit") || "m").trim() || "m";
  if (!name) throw new Error("Name required");

  await prisma.fabricType.create({
    data: { name, code, defaultUnit },
  });
  revalidatePath("/masters/fabrics");
}

export async function createColorFamily(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  await prisma.colorFamily.create({ data: { name } });
  revalidatePath("/masters/colors");
}

export async function createShade(formData: FormData) {
  await requireUser();
  const schema = z.object({
    colorFamilyId: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    hex: z.string().optional(),
  });

  const parsed = schema.parse({
    colorFamilyId: formData.get("colorFamilyId"),
    code: String(formData.get("code") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    hex: String(formData.get("hex") || "").trim() || undefined,
  });

  await prisma.shade.create({
    data: {
      colorFamilyId: parsed.colorFamilyId,
      code: parsed.code,
      name: parsed.name,
      hex: parsed.hex,
    },
  });
  revalidatePath("/masters/colors");
}

export async function createFinishType(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  await prisma.finishType.create({ data: { name } });
  revalidatePath("/masters/finishes");
}
