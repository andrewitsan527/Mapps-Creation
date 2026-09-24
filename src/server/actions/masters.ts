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

export async function createFinishType(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  await prisma.finishType.create({ data: { name } });
  revalidatePath("/masters/finishes");
}

export async function createQuality(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  await prisma.quality.create({ data: { name } });
  revalidatePath("/masters/colors");
}

export async function createCode(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  await prisma.code.create({ data: { name } });
  revalidatePath("/masters/colors");
}

export async function createColour(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  await prisma.colour.create({ data: { name } });
  revalidatePath("/masters/colors");
}
