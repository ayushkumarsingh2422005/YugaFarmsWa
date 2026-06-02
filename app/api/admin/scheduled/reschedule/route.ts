import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import { rescheduleMessage } from "@/lib/db/wa-db";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    scheduledAt?: string;
  };
  if (!body.id || !body.scheduledAt) return badRequest("id and scheduledAt are required");
  const when = new Date(body.scheduledAt);
  if (Number.isNaN(when.getTime())) return badRequest("scheduledAt must be a valid datetime");
  const ok = rescheduleMessage(body.id, when.toISOString());
  return NextResponse.json({ ok });
}
