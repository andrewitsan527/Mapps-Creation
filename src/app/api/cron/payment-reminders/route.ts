import { NextResponse } from "next/server";
import { runPaymentReminderJob } from "@/server/actions/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs daily on Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set.
 * Can also be triggered manually with ?key=<CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  const authorized = authHeader === `Bearer ${secret}` || key === secret;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPaymentReminderJob();
  return NextResponse.json({ ok: true, ...result });
}
