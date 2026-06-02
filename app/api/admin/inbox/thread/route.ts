import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { getConversationThread } from "@/lib/db/wa-db";
import { badRequest, unauthorized } from "@/lib/admin/http";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return badRequest("phone is required");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "200");
  const rows = getConversationThread(phone, Number.isFinite(limit) ? limit : 200);
  return NextResponse.json({ ok: true, rows });
}
