import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { listScheduledMessages, type MessageStatus } from "@/lib/db/wa-db";
import { unauthorized } from "@/lib/admin/http";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const status = req.nextUrl.searchParams.get("status") as MessageStatus | null;
  const phone = req.nextUrl.searchParams.get("phone") ?? undefined;
  const messageType = req.nextUrl.searchParams.get("messageType") ?? undefined;
  const rows = listScheduledMessages({
    status: status ?? undefined,
    phone,
    messageType: (messageType as
      | "order_thank_you"
      | "review_request"
      | "product_insights"
      | "repurchase_reminder"
      | "cart_sync"
      | "campaign_broadcast"
      | undefined),
    limit: 300,
  });
  return NextResponse.json({ ok: true, rows });
}
