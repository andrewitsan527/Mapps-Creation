"use server";

import { revalidatePath } from "next/cache";
import { PartyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isPartyType, masterHref } from "@/lib/parties";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function readPartyFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const typeRaw = String(formData.get("type") || "CLIENT");
  if (!isPartyType(typeRaw)) throw new Error("Invalid type");
  const type = typeRaw as PartyType;

  const paymentTermsDays = Number(formData.get("paymentTermsDays") || 30);
  const interestRatePct =
    String(formData.get("interestRatePct") || "0").trim() || "0";

  if (!name) throw new Error("Name required");

  return {
    name,
    type,
    whatsapp: String(formData.get("whatsapp") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    gstin: String(formData.get("gstin") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    paymentTermsDays: Number.isFinite(paymentTermsDays) ? paymentTermsDays : 30,
    interestRatePct,
    active: String(formData.get("active") || "true") === "true",
  };
}

function revalidatePartyPaths(type: PartyType, id?: string) {
  revalidatePath("/masters/parties");
  revalidatePath("/masters/mills");
  revalidatePath("/masters/weavers");
  revalidatePath("/masters/agents");
  revalidatePath("/masters/suppliers");
  revalidatePath(masterHref(type));
  if (id) revalidatePath(`/masters/parties/${id}`);
  revalidatePath("/programs");
  revalidatePath("/sales");
  revalidatePath("/grey");
  revalidatePath("/finance");
  revalidatePath("/payments");
  revalidatePath("/returns");
}

export async function addMillMarka(formData: FormData) {
  await requireUser();
  const millId = String(formData.get("millId") || "");
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const label = String(formData.get("label") || "").trim() || null;
  if (!millId || !code) throw new Error("Mill and marka code required");

  const mill = await prisma.party.findFirst({
    where: { id: millId, type: "MILL", active: true },
    select: { id: true },
  });
  if (!mill) throw new Error("Active mill not found");

  await prisma.millMarka.create({ data: { millId, code, label } });
  revalidatePartyPaths("MILL", millId);
  revalidatePath("/returns");
}

export async function updateMillMarka(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const label = String(formData.get("label") || "").trim() || null;
  const active = String(formData.get("active") || "true") === "true";
  if (!id || !code) throw new Error("Marka and code required");

  const marka = await prisma.millMarka.update({
    where: { id },
    data: { code, label, active },
  });
  revalidatePartyPaths("MILL", marka.millId);
  revalidatePath("/returns");
}

export async function createPartyMaster(formData: FormData) {
  await requireUser();
  const data = readPartyFields(formData);

  const party = await prisma.party.create({ data });

  const relatedIds = formData
    .getAll("relatedPartyIds")
    .map(String)
    .filter(Boolean);
  if (data.type === "AGENT" && relatedIds.length > 0) {
    await prisma.agentLink.createMany({
      data: relatedIds.map((relatedPartyId) => ({
        agentId: party.id,
        relatedPartyId,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePartyPaths(data.type, party.id);
}

export async function updatePartyMaster(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Party id required");

  const data = readPartyFields(formData);

  await prisma.party.update({
    where: { id },
    data,
  });

  if (data.type === "AGENT") {
    const relatedIds = formData
      .getAll("relatedPartyIds")
      .map(String)
      .filter(Boolean);
    await prisma.$transaction(async (tx) => {
      await tx.agentLink.deleteMany({ where: { agentId: id } });
      if (relatedIds.length > 0) {
        await tx.agentLink.createMany({
          data: relatedIds.map((relatedPartyId) => ({
            agentId: id,
            relatedPartyId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  revalidatePartyPaths(data.type, id);
}

export async function setPartyActive(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!id) throw new Error("Party id required");

  const party = await prisma.party.update({
    where: { id },
    data: { active },
  });

  revalidatePartyPaths(party.type, id);
}

/** Keep createParty for older imports */
export async function createParty(formData: FormData) {
  return createPartyMaster(formData);
}
