import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import { startCampaign } from "@/lib/admin/campaigns";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { id?: number };
  if (!body.id) return badRequest("id is required");
  try {
    startCampaign(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to start campaign" },
      { status: 400 }
    );
  }
}
