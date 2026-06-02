import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import { createCampaignDraft } from "@/lib/admin/campaigns";
import { type CampaignTarget } from "@/lib/admin/segments";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    messageBody?: string;
    sendMode?: string;
    target?: CampaignTarget;
    scheduledAt?: string | null;
  };
  if (!body.name || !body.messageBody || !body.target) {
    return badRequest("name, messageBody and target are required");
  }
  const campaign = createCampaignDraft({
    name: body.name,
    messageBody: body.messageBody,
    sendMode: body.sendMode ?? "freeform_anytime",
    target: body.target,
    scheduledAt: body.scheduledAt ?? null,
  });
  return NextResponse.json({ ok: true, campaign });
}
