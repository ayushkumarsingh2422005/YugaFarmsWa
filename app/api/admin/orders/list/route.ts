import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { listOrderTracking } from "@/lib/db/wa-db";
import { unauthorized } from "@/lib/admin/http";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const rows = listOrderTracking(300);
  return NextResponse.json({ ok: true, rows });
}
