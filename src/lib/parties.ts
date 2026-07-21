import type { PartyType } from "@prisma/client";
import { prisma } from "@/lib/db";

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CLIENT: "Party (client)",
  MILL: "Mill",
  WEAVER: "Weaver",
  GREY_SUPPLIER: "Grey supplier",
  AGENT: "Agent",
  OTHER: "Other",
};

export const MASTER_PARTY_TYPES = [
  "CLIENT",
  "MILL",
  "WEAVER",
  "AGENT",
  "GREY_SUPPLIER",
] as const satisfies readonly PartyType[];

export type MasterPartyType = (typeof MASTER_PARTY_TYPES)[number];

export function isPartyType(v: string): v is PartyType {
  return (
    v === "CLIENT" ||
    v === "MILL" ||
    v === "WEAVER" ||
    v === "GREY_SUPPLIER" ||
    v === "AGENT" ||
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
    case "GREY_SUPPLIER":
      return "/masters/suppliers";
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

export function partyOptionLabel(p: PartyOption, showType = false): string {
  const bits = [p.name];
  if (showType) bits.push(PARTY_TYPE_LABELS[p.type]);
  if (!p.active) bits.push("inactive");
  if (!p.whatsapp) bits.push("no WA");
  return bits.join(" · ");
}
