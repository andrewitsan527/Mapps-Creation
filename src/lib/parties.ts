import type { PartyType } from "@prisma/client";
import { prisma } from "@/lib/db";

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CLIENT: "Party (client)",
  MILL: "Mill",
  WEAVER: "Weaver / grey supplier",
  AGENT: "Agent",
  TRANSPORTER: "Transporter",
  OTHER: "Other",
};

export const MASTER_PARTY_TYPES = [
  "CLIENT",
  "MILL",
  "WEAVER",
  "AGENT",
  "TRANSPORTER",
] as const satisfies readonly PartyType[];

export type MasterPartyType = (typeof MASTER_PARTY_TYPES)[number];

export function isPartyType(v: string): v is PartyType {
  return (
    v === "CLIENT" ||
    v === "MILL" ||
    v === "WEAVER" ||
    v === "AGENT" ||
    v === "TRANSPORTER" ||
    v === "OTHER"
  );
}

export function masterHref(type: PartyType): string {
  switch (type) {
    case "MILL":
      return "/masters/mills";
    case "WEAVER":
      return "/masters/weavers";
    case "AGENT":
      return "/masters/agents";
    case "TRANSPORTER":
      return "/masters/transporters";
    case "CLIENT":
    default:
      return "/masters/parties";
  }
}

/** Active parties for dropdowns — used across sales, programs, finance, etc. */
export async function listPartyOptions(
  types: PartyType | PartyType[],
  opts?: { includeInactive?: boolean },
) {
  const typeList = Array.isArray(types) ? types : [types];
  const rows = await prisma.party.findMany({
    where: {
      type: { in: typeList },
      ...(opts?.includeInactive ? {} : { active: true }),
    },
    select: {
      id: true,
      name: true,
      type: true,
      whatsapp: true,
      phone: true,
      gstin: true,
      paymentTermsDays: true,
      interestRatePct: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });

  // Plain JSON for Client Components (Prisma Decimal is not serializable).
  return rows.map((p) => ({
    ...p,
    interestRatePct: p.interestRatePct.toString(),
  }));
}

export type PartyOption = Awaited<ReturnType<typeof listPartyOptions>>[number];

export async function listMillWeaverLinks() {
  return prisma.millWeaver.findMany({
    select: { millId: true, weaverId: true },
  });
}

export async function listAgentWeaverLinks() {
  return prisma.agentLink.findMany({
    where: { relatedParty: { type: "WEAVER" } },
    select: { agentId: true, relatedPartyId: true },
  });
}

export async function requireAgentWeaverLink(agentId: string, weaverId: string) {
  const link = await prisma.agentLink.findUnique({
    where: { agentId_relatedPartyId: { agentId, relatedPartyId: weaverId } },
    select: { id: true },
  });
  if (!link) {
    throw new Error("Agent is not linked to this weaver");
  }
}

export async function requireMillWeaverLink(millId: string, weaverId: string) {
  const link = await prisma.millWeaver.findUnique({
    where: { millId_weaverId: { millId, weaverId } },
    select: { id: true },
  });
  if (!link) {
    throw new Error("Weaver is not linked to this mill");
  }
}

export function partyOptionLabel(p: PartyOption, showType = false): string {
  const bits = [p.name];
  if (showType) bits.push(PARTY_TYPE_LABELS[p.type]);
  if (!p.whatsapp) bits.push("no WA");
  return bits.join(" · ");
}
