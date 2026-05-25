import { env } from "@/lib/env";
import type { CartLine } from "@/lib/scheduling/product-cycle";

export function orderThankYouMessage(input: {
  customerName?: string;
  orderNumber: string;
  total: number;
}): string {
  const name = input.customerName?.trim() || "there";
  return (
    `Hi ${name}! 🙏 Thank you for ordering from Yuga Farms.\n\n` +
    `Order *${input.orderNumber}* is confirmed (₹${Math.round(input.total)}).\n` +
    `We'll keep you updated on WhatsApp.\n\n` +
    `Shop: ${env.storefrontUrl}`
  );
}

export function reviewRequestMessage(input: {
  orderNumber: string;
}): string {
  return (
    `Hope you're enjoying your Yuga Farms order *${input.orderNumber}*! 🌿\n\n` +
    `We'd love a quick review — reply with ⭐ 1–5 or share a few words about your experience.\n\n` +
    `${env.storefrontUrl}`
  );
}

export function productInsightsMessage(): string {
  return (
    `From our farm to your kitchen 🍯\n\n` +
    `Many families pair our *A2 cow ghee* with raw honey for immunity & digestion.\n` +
    `Explore honey & ghee combos: ${env.storefrontUrl}/ghee\n\n` +
    `Reply *HELP* anytime.`
  );
}

export function repurchaseReminderMessage(input: {
  productTitle: string;
  days: number;
}): string {
  return (
    `Running low on *${input.productTitle}*? 🥄\n\n` +
    `It's been about ${input.days} days — reorder fresh bilona ghee/honey:\n` +
    `${env.storefrontUrl}\n\n` +
    `WhatsApp support: +${env.supportPhone}`
  );
}

export function cartSyncMessage(input: {
  totalItems: number;
  totalPrice: number;
  lines: CartLine[];
}): string {
  const preview = input.lines
    .slice(0, 3)
    .map((l) => `• ${l.productTitle ?? "Item"} × ${l.quantity ?? 1}`)
    .join("\n");
  const more =
    input.lines.length > 3 ? `\n…+${input.lines.length - 3} more` : "";
  return (
    `Your Yuga Farms cart 🛒\n` +
    `${preview}${more}\n\n` +
    `${input.totalItems} item(s) · ₹${Math.round(input.totalPrice)}\n` +
    `Checkout: ${env.storefrontUrl}/cart`
  );
}
