import { env, isWhatsAppConfigured } from "@/lib/env";
import { logOutbound } from "@/lib/db/wa-db";

type SendTextResult = { ok: true; messageId?: string } | { ok: false; error: string };

async function postWhatsAppMessage(
  toPhoneE164: string,
  payload: Record<string, unknown>
) {
  const phoneNumberId = env.whatsapp.phoneNumberId();
  const token = env.whatsapp.accessToken();
  const version = env.whatsapp.apiVersion;
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhoneE164,
      ...payload,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendWhatsAppText(
  toPhoneE164: string,
  body: string,
  messageType = "generic"
): Promise<SendTextResult> {
  if (!isWhatsAppConfigured()) {
    console.warn("[whatsapp] Not configured — message skipped:", messageType, toPhoneE164);
    logOutbound(toPhoneE164, messageType, body, { skipped: true, reason: "not_configured" });
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const { res, data } = await postWhatsAppMessage(toPhoneE164, {
    type: "text",
    text: { preview_url: true, body },
  });

  if (!res.ok) {
    const err =
      (data as { error?: { message?: string } })?.error?.message ??
      `HTTP ${res.status}`;
    logOutbound(toPhoneE164, messageType, body, { error: data });
    return { ok: false, error: err };
  }

  const messageId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id;
  logOutbound(toPhoneE164, messageType, body, { messageId });
  return { ok: true, messageId };
}

export async function sendWhatsAppTemplate(
  toPhoneE164: string,
  templateName: string,
  languageCode = "en",
  bodyParams: string[] = [],
  messageType = "manual_template"
): Promise<SendTextResult> {
  if (!isWhatsAppConfigured()) {
    logOutbound(toPhoneE164, messageType, `template:${templateName}`, {
      skipped: true,
      reason: "not_configured",
    });
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const components =
    bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParams.map((value) => ({ type: "text", text: value })),
          },
        ]
      : undefined;

  const { res, data } = await postWhatsAppMessage(toPhoneE164, {
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });

  if (!res.ok) {
    const err =
      (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    logOutbound(toPhoneE164, messageType, `template:${templateName}`, { error: data });
    return { ok: false, error: err };
  }

  const messageId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id;
  logOutbound(toPhoneE164, messageType, `template:${templateName}`, {
    messageId,
    languageCode,
    bodyParams,
  });
  return { ok: true, messageId };
}
