import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { unauthorized } from "@/lib/admin/http";
import { analyticsSummary, listCampaigns } from "@/lib/db/wa-db";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const summary = analyticsSummary(30);
  const campaigns = listCampaigns(100);
  return NextResponse.json({
    ok: true,
    summary,
    campaignStats: {
      total: campaigns.length,
      completed: campaigns.filter((c) => c.status === "completed").length,
      running: campaigns.filter((c) => c.status === "running" || c.status === "scheduled").length,
      failed: campaigns.filter((c) => c.status === "failed").length,
    },
  });
}
