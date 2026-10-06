"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export type LiveStockColour = {
  colour: string;
  rolls: number;
};

export type LiveStockSummary = {
  total: number;
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
  const total = colours.reduce((sum, row) => sum + row.rolls, 0);
  return { total, colours };
}
