import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { syncDeliveredOrdersFromStrapi } from "@/lib/scheduling/scheduler";
import { unauthorized } from "@/lib/admin/http";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const processed = syncDeliveredOrdersFromStrapi();
  return NextResponse.json({ ok: true, processed });
}
