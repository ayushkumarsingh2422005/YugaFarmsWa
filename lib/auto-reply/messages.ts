import { env } from "@/lib/env";
import type { CartLine } from "@/lib/scheduling/product-cycle";
import type { StrapiOrderRow } from "@/lib/db/strapi-read";

const shop = () => env.storefrontUrl.replace(/\/$/, "");
const support = () => env.supportPhone;

export function welcomeMenuMessage(): string {
  return (
    `Namaste from *Yuga Farms* 🌿\n\n` +
    `Reply with a keyword:\n` +
    `• *ORDER* — latest order status\n` +
    `• *CART* — your saved cart\n` +
    `• *SHOP* — browse ghee & honey\n` +
    `• *HELP* — this menu\n\n` +
    `Or call/WhatsApp us: +${support()}\n` +
    `${shop()}`
  );
}

export function helpMenuMessage(): string {
  return welcomeMenuMessage();
}

export function shopLinksMessage(): string {
  return (
    `Shop pure A2 ghee & raw honey 🍯\n\n` +
    `🧈 Ghee: ${shop()}/ghee\n` +
    `🍯 Honey: ${shop()}/honey\n` +
    `🛒 Cart: ${shop()}/cart\n\n` +
    `Need help? Reply *HELP* or message +${support()}`
  );
}

export function orderStatusMessage(orders: StrapiOrderRow[]): string {
  if (orders.length === 0) {
    return (
      `We couldn't find a recent order for this WhatsApp number.\n\n` +
      `If you ordered with a different number, reply with that number or visit:\n` +
      `${shop()}/orders\n\n` +
      `Reply *HELP* for more options.`
    );
  }

  const lines = orders.slice(0, 3).map((o) => {
    const status = (o.order_status ?? "UNKNOWN").replace(/_/g, " ");
    return `• *${o.order_number}* — ${status} (₹${Math.round(o.total)})`;
  });

  return (
    `Here are your latest orders:\n\n` +
    `${lines.join("\n")}\n\n` +
    `Track & details: ${shop()}/orders\n` +
    `Reply *HELP* for the menu.`
  );
}

export function cartReminderMessage(input: {
  totalItems: number;
  totalPrice: number;
  lines: CartLine[];
}): string {
  if (input.totalItems <= 0) {
    return (
      `Your cart looks empty right now.\n\n` +
      `Browse our collection: ${shop()}/ghee\n` +
      `Reply *SHOP* for quick links.`
    );
  }

  const preview = input.lines
    .slice(0, 3)
    .map((l) => `• ${l.productTitle ?? "Item"} × ${l.quantity ?? 1}`)
    .join("\n");
  const more =
    input.lines.length > 3 ? `\n…+${input.lines.length - 3} more` : "";

  return (
    `Your saved cart 🛒\n` +
    `${preview}${more}\n\n` +
    `${input.totalItems} item(s) · ₹${Math.round(input.totalPrice)}\n` +
    `Checkout: ${shop()}/cart`
  );
}

export function ratingThanksMessage(rating: number): string {
  return (
    `Thank you for rating us *${rating}/5* ⭐\n\n` +
    `Your feedback helps our farm family grow.\n` +
    `Reorder anytime: ${shop()}`
  );
}

export function politeThanksMessage(): string {
  return (
    `You're welcome! 🙏\n\n` +
    `We're here if you need ghee, honey, or order help.\n` +
    `Reply *HELP* for the menu.`
  );
}

export function unsupportedTypeMessage(): string {
  return (
    `Thanks for reaching out to Yuga Farms.\n\n` +
    `Please send a text message, or reply *HELP* for options.\n` +
    `Support: +${support()}`
  );
}
