import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import { previewCampaignRecipients } from "@/lib/admin/campaigns";
import { type CampaignTarget } from "@/lib/admin/segments";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { target?: CampaignTarget };
  if (!body.target) return badRequest("target is required");
  const preview = previewCampaignRecipients(body.target);
  return NextResponse.json({ ok: true, ...preview });
}
