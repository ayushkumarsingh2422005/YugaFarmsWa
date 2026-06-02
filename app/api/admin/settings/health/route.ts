import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { unauthorized } from "@/lib/admin/http";
import { env, isWhatsAppConfigured } from "@/lib/env";
import { getWaDb, getAppMeta, listManualTags } from "@/lib/db/wa-db";
import { getStrapiDb } from "@/lib/db/strapi-read";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();

  let waDbOk = false;
  let strapiDbOk = false;
  try {
    getWaDb();
    waDbOk = true;
  } catch {
    waDbOk = false;
  }
  strapiDbOk = getStrapiDb() != null;

  const cronLastStarted = getAppMeta("cron.last_started_at");
  const cronLastFinished = getAppMeta("cron.last_finished_at");
  const cronLastResult = getAppMeta("cron.last_result");

  return NextResponse.json({
    ok: true,
    health: {
      waDb: waDbOk,
      strapiDb: strapiDbOk,
      whatsappConfigured: isWhatsAppConfigured(),
      cronSecretConfigured: Boolean(env.cronSecret()),
      internalSecretConfigured: Boolean(env.internalSecret()),
      webhookVerifyTokenConfigured: Boolean(env.whatsapp.webhookVerifyToken()),
      webhookAppSecretConfigured: Boolean(env.whatsapp.appSecret()),
      cronLastStartedAt: cronLastStarted?.value ?? null,
      cronLastFinishedAt: cronLastFinished?.value ?? null,
      cronLastResult: cronLastResult?.value ?? null,
      manualTagCount: listManualTags().length,
    },
  });
}
