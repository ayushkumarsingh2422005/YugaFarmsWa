import { NextRequest, NextResponse } from "next/server";
import { assertCronSecret } from "@/lib/auth/internal";
import {
  processDueMessages,
  syncDeliveredOrdersFromStrapi,
} from "@/lib/scheduling/scheduler";

export async function GET(req: NextRequest) {
  const authErr = assertCronSecret(req);
  if (authErr) return authErr;

  const deliveredScheduled = syncDeliveredOrdersFromStrapi();
  const results = await processDueMessages(100);

  return NextResponse.json({
    ok: true,
    deliveredOrdersProcessed: deliveredScheduled,
    messagesProcessed: results.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    details: results,
  });
}
