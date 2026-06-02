import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import {
  getCampaignById,
  listCampaignRecipients,
  syncCampaignRecipientStatuses,
} from "@/lib/db/wa-db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) return badRequest("Invalid campaign id");
  syncCampaignRecipientStatuses(campaignId);
  const campaign = getCampaignById(campaignId);
  if (!campaign) return badRequest("Campaign not found");
  const recipients = listCampaignRecipients(campaignId, 2000);
  return NextResponse.json({ ok: true, campaign, recipients });
}
