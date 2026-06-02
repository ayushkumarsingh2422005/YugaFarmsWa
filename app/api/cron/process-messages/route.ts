import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/auth/internal";
import {
  processDueMessages,
  syncDeliveredOrdersFromStrapi,
} from "@/lib/scheduling/scheduler";
import { setAppMeta } from "@/lib/db/wa-db";

export async function GET(req: NextRequest) {
  const authErr = assertCronSecret(req);
  if (authErr) return authErr;
  setAppMeta("cron.last_started_at", new Date().toISOString());

  const deliveredScheduled = syncDeliveredOrdersFromStrapi();
  const results = await processDueMessages(100);
  setAppMeta("cron.last_finished_at", new Date().toISOString());
  setAppMeta(
    "cron.last_result",
    JSON.stringify({
      deliveredOrdersProcessed: deliveredScheduled,
      messagesProcessed: results.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    })
  );

  return NextResponse.json({
    ok: true,
    deliveredOrdersProcessed: deliveredScheduled,
    messagesProcessed: results.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    details: results,
  });
}
