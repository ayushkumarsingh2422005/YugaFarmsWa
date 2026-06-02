import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp/client";
import { normalizePhone } from "@/lib/phone";
import { badRequest, unauthorized } from "@/lib/admin/http";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();

  let body: {
    phone?: string;
    message?: string;
    mode?: "text" | "template";
    templateName?: string;
    templateLanguage?: string;
    templateParams?: string[];
    fallbackTemplateName?: string;
    fallbackTemplateLanguage?: string;
    fallbackTemplateParams?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON payload");
  }

  if (!body.phone) {
    return badRequest("phone is required");
  }
  const phone = normalizePhone(body.phone);
  if (!phone) return badRequest("Invalid phone");

  const mode = body.mode ?? "text";
  let result:
    | { ok: true; messageId?: string; usedMode: "text" | "template"; fallbackUsed?: boolean }
    | { ok: false; error: string };

  if (mode === "template") {
    if (!body.templateName) return badRequest("templateName is required in template mode");
    const sent = await sendWhatsAppTemplate(
      phone,
      body.templateName,
      body.templateLanguage ?? "en",
      body.templateParams ?? [],
      "manual_template"
    );
    result = sent.ok
      ? { ok: true, messageId: sent.messageId, usedMode: "template" }
      : { ok: false, error: sent.error };
  } else {
    if (!body.message?.trim()) return badRequest("message is required in text mode");
    const sent = await sendWhatsAppText(phone, body.message.trim(), "manual_send");
    if (!sent.ok && body.fallbackTemplateName) {
      const fallback = await sendWhatsAppTemplate(
        phone,
        body.fallbackTemplateName,
        body.fallbackTemplateLanguage ?? "en",
        body.fallbackTemplateParams ?? [],
        "manual_template_fallback"
      );
      if (fallback.ok) {
        result = {
          ok: true,
          messageId: fallback.messageId,
          usedMode: "template",
          fallbackUsed: true,
        };
      } else {
        result = { ok: false, error: `${sent.error}; fallback failed: ${fallback.error}` };
      }
    } else {
      result = sent.ok
        ? { ok: true, messageId: sent.messageId, usedMode: "text" }
        : { ok: false, error: sent.error };
    }
  }

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
  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    usedMode: result.usedMode,
    fallbackUsed: result.fallbackUsed ?? false,
  });
}
