import { env } from "@/lib/env";
import {
  getCartSnapshotByPhone,
  recordAutoReply,
  shouldSendAutoReply,
} from "@/lib/db/wa-db";
import { getRecentOrdersByPhone } from "@/lib/db/strapi-read";
import type { CartLine } from "@/lib/scheduling/product-cycle";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import {
  cartReminderMessage,
  helpMenuMessage,
  orderStatusMessage,
  politeThanksMessage,
  ratingThanksMessage,
  shopLinksMessage,
  unsupportedTypeMessage,
  welcomeMenuMessage,
} from "@/lib/auto-reply/messages";
import {
  matchAutoReply,
  ruleCooldownSeconds,
  type AutoReplyRuleId,
} from "@/lib/auto-reply/router";

export type InboundAutoReplyInput = {
  phone: string;
  text?: string;
  messageType?: string;
};

export type AutoReplyResult = {
  skipped: boolean;
  reason?: string;
  ruleId?: string;
  sent?: boolean;
  error?: string;
};

function resolveReply(
  phone: string,
  ruleId: AutoReplyRuleId,
  rating?: number
): string {
  switch (ruleId) {
    case "welcome":
      return welcomeMenuMessage();
    case "help":
      return helpMenuMessage();
    case "shop":
      return shopLinksMessage();
    case "order_status":
      return orderStatusMessage(getRecentOrdersByPhone(phone));
    case "cart": {
      const snap = getCartSnapshotByPhone(phone);
      if (!snap) {
        return cartReminderMessage({
          totalItems: 0,
          totalPrice: 0,
          lines: [],
        });
      }
      let lines: CartLine[] = [];
      try {
        lines = JSON.parse(snap.items_json) as CartLine[];
      } catch {
        lines = [];
      }
      return cartReminderMessage({
        totalItems: snap.total_items,
        totalPrice: snap.total_price,
        lines,
      });
    }
    case "rating":
      return ratingThanksMessage(rating ?? 5);
    case "thanks":
      return politeThanksMessage();
    case "default_menu":
    default:
      return welcomeMenuMessage();
  }
}

export async function handleInboundAutoReply(
  input: InboundAutoReplyInput
): Promise<AutoReplyResult> {
  if (!env.autoReplyEnabled) {
    return { skipped: true, reason: "disabled" };
  }

  const phone = input.phone;
  const type = input.messageType ?? "text";

  if (type !== "text" || !input.text?.trim()) {
    if (!shouldSendAutoReply(phone, "unsupported", 300)) {
      return { skipped: true, reason: "cooldown" };
    }
    const result = await sendWhatsAppText(
      phone,
      unsupportedTypeMessage(),
      "auto_reply_unsupported"
    );
    if (result.ok) recordAutoReply(phone, "unsupported");
    return {
      skipped: false,
      ruleId: "unsupported",
      sent: result.ok,
      error: result.ok ? undefined : result.error,
    };
  }

  const match = matchAutoReply(input.text);
  if (!match) {
    return { skipped: true, reason: "no_match" };
  }

  const ruleCooldown = Math.max(
    env.autoReplyCooldownSec,
    ruleCooldownSeconds(match.ruleId)
  );

  if (!shouldSendAutoReply(phone, match.ruleId, ruleCooldown)) {
    return { skipped: true, reason: "cooldown", ruleId: match.ruleId };
  }

  const body = resolveReply(phone, match.ruleId, match.rating);
  const result = await sendWhatsAppText(
    phone,
    body,
    `auto_reply_${match.ruleId}`
  );

  if (result.ok) {
    recordAutoReply(phone, match.ruleId);
  }

  return {
    skipped: false,
    ruleId: match.ruleId,
    sent: result.ok,
    error: result.ok ? undefined : result.error,
  };
}
