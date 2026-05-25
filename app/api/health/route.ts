import { NextResponse } from "next/server";
import { isWhatsAppConfigured } from "@/lib/env";
import { getStrapiDb } from "@/lib/db/strapi-read";
import { getWaDb } from "@/lib/db/wa-db";

export async function GET() {
  let waDb = false;
  let strapiDb = false;
  try {
    getWaDb();
    waDb = true;
  } catch {
    waDb = false;
  }
  strapiDb = getStrapiDb() != null;

  return NextResponse.json({
    ok: waDb,
    whatsappConfigured: isWhatsAppConfigured(),
    waDatabase: waDb,
    strapiDatabase: strapiDb,
    timestamp: new Date().toISOString(),
  });
}
