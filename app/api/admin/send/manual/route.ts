import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { normalizePhone } from "@/lib/phone";
import { badRequest, unauthorized } from "@/lib/admin/http";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();

  let body: { phone?: string; message?: string };
  try {
    body = (await req.json()) as { phone?: string; message?: string };
  } catch {
    return badRequest("Invalid JSON payload");
  }

  if (!body.phone || !body.message) {
    return badRequest("phone and message are required");
  }
  const phone = normalizePhone(body.phone);
  if (!phone) return badRequest("Invalid phone");

  const result = await sendWhatsAppText(phone, body.message.trim(), "manual_send");
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        warning:
          "Free-form messages may be rejected by WhatsApp policy outside active conversation windows.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
