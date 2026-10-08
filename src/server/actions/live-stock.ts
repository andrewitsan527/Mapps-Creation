"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type LiveStockColour = {
  colour: string;
  rolls: number;
};

export type LiveStockSummary = {
  total: number;
  passed: number;
  withoutQc: number;
  colours: LiveStockColour[];
};

export async function listLiveStock(): Promise<LiveStockSummary> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const rows = await prisma.$queryRaw<
    { colour: string; rolls: number }[]
  >`
    SELECT
      (ARRAY_AGG(BTRIM(colour) ORDER BY "createdAt" ASC, id ASC))[1] AS colour,
      COUNT(*)::int AS rolls
    FROM "LiveStockRoll"
    WHERE status = 'available'
    GROUP BY LOWER(BTRIM(colour))
    ORDER BY colour ASC
  `;

  const colours = rows.map((row) => ({
    colour: row.colour,
    rolls: Number(row.rolls),
  }));
  const totals = await prisma.$queryRaw<{ total: number; passed: number; without_qc: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "qualityState" <> 'WITHOUT_QC')::int AS passed,
      COUNT(*) FILTER (WHERE "qualityState" = 'WITHOUT_QC')::int AS without_qc
    FROM "LiveStockRoll"
    WHERE status = 'available'
  `;
  const total = Number(totals[0]?.total ?? 0);
  return {
    total,
    passed: Number(totals[0]?.passed ?? 0),
    withoutQc: Number(totals[0]?.without_qc ?? 0),
    colours,
  };
}
