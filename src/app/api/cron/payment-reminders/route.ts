import { NextResponse } from "next/server";
import { runPaymentReminderJob } from "@/server/actions/payments";

/**
 * Hit daily via Windows Task Scheduler / AWS cron:
 * GET /api/cron/payment-reminders?key=YOUR_CRON_SECRET
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const secret = process.env.CRON_SECRET || "mapps-dev-cron";
  if (key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPaymentReminderJob();
  return NextResponse.json({ ok: true, ...result });
}
