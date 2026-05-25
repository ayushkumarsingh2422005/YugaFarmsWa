import crypto from "crypto";
import { env } from "@/lib/env";

export function verifyWebhookChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  if (mode === "subscribe" && token === env.whatsapp.webhookVerifyToken()) {
    return challenge;
  }
  return null;
}

export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = env.whatsapp.appSecret();
  if (!secret || !signatureHeader?.startsWith("sha256=")) return !secret;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice(7);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}
