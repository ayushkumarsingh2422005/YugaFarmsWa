import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { listConversations } from "@/lib/db/wa-db";
import { unauthorized } from "@/lib/admin/http";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const rows = listConversations(search, Number.isFinite(limit) ? limit : 100);
  return NextResponse.json({ ok: true, rows });
}
