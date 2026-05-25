import { env, isWhatsAppConfigured } from "@/lib/env";
import { logOutbound } from "@/lib/db/wa-db";

type SendTextResult = { ok: true; messageId?: string } | { ok: false; error: string };

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
      type: "text",
      text: { preview_url: true, body },
    }),
  });

  const data = await res.json().catch(() => ({}));

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
