import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { unauthorized } from "@/lib/admin/http";
import { listCampaignsWithSync } from "@/lib/admin/campaigns";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const rows = listCampaignsWithSync(300);
  return NextResponse.json({ ok: true, rows });
}
