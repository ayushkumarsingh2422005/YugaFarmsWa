import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import {
  assignTagToPhone,
  listManualTags,
  removeTagFromPhone,
  upsertManualTag,
} from "@/lib/db/wa-db";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    tagName?: string;
    phone?: string;
    action?: "add" | "remove";
  };
  if (!body.tagName) return badRequest("tagName is required");
  const tag = upsertManualTag(body.tagName);
  if (body.phone) {
    const phone = normalizePhone(body.phone);
    if (!phone) return badRequest("Invalid phone");
    if (body.action === "remove") {
      removeTagFromPhone(tag.id, phone);
    } else {
      assignTagToPhone(tag.id, phone);
    }
  }
  return NextResponse.json({ ok: true, tag, tags: listManualTags() });
}

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  return NextResponse.json({ ok: true, rows: listManualTags() });
}
