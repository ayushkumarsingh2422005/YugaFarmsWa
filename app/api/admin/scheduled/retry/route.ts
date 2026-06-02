import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import { retryScheduledMessage } from "@/lib/db/wa-db";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { id?: number };
  if (!body.id) return badRequest("id is required");
  const ok = retryScheduledMessage(body.id);
  return NextResponse.json({ ok });
}
