export type AutoReplyRuleId =
  | "welcome"
  | "help"
  | "order_status"
  | "cart"
  | "shop"
  | "rating"
  | "thanks"
  | "default_menu";

export type AutoReplyMatch = {
  ruleId: AutoReplyRuleId;
  rating?: number;
};

const WELCOME = new Set([
  "hi",
  "hii",
  "hey",
  "hello",
  "hola",
  "namaste",
  "namaskar",
  "start",
  "begin",
]);

const HELP = new Set(["help", "menu", "options", "support"]);

const ORDER = new Set([
  "order",
  "orders",
  "status",
  "track",
  "tracking",
  "delivery",
  "where is my order",
  "order status",
]);

const CART = new Set(["cart", "my cart", "checkout", "basket"]);

const SHOP = new Set([
  "shop",
  "buy",
  "purchase",
  "ghee",
  "honey",
  "catalog",
  "products",
  "price",
  "prices",
]);

const THANKS = new Set([
  "thanks",
  "thank you",
  "thankyou",
  "thx",
  "ty",
  "dhanyavad",
  "shukriya",
]);

export function normalizeInboundText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function parseRating(text: string): number | null {
  if (/^[1-5]$/.test(text)) return Number(text);
  const star = text.match(/\b([1-5])\s*(?:star|stars|⭐)\b/);
  if (star) return Number(star[1]);
  const rate = text.match(/\brate\s*([1-5])\b/);
  if (rate) return Number(rate[1]);
  return null;
}

export function matchAutoReply(text: string): AutoReplyMatch | null {
  const normalized = normalizeInboundText(text);
  if (!normalized) return null;

  const rating = parseRating(normalized);
  if (rating != null) {
    return { ruleId: "rating", rating };
  }

  if (WELCOME.has(normalized)) return { ruleId: "welcome" };
  if (HELP.has(normalized)) return { ruleId: "help" };

  if (
    ORDER.has(normalized) ||
    normalized.includes("order status") ||
    normalized.startsWith("track ")
  ) {
    return { ruleId: "order_status" };
  }

  if (CART.has(normalized)) return { ruleId: "cart" };

  if (
    SHOP.has(normalized) ||
    normalized.includes("buy ghee") ||
    normalized.includes("buy honey")
  ) {
    return { ruleId: "shop" };
  }

  if (THANKS.has(normalized) || normalized.startsWith("thank")) {
    return { ruleId: "thanks" };
  }

  return { ruleId: "default_menu" };
}

/** Per-rule cooldown seconds (rating always allowed via handler). */
export function ruleCooldownSeconds(ruleId: AutoReplyRuleId): number {
  switch (ruleId) {
    case "rating":
      return 0;
    case "welcome":
    case "help":
      return 120;
    case "order_status":
    case "cart":
      return 90;
    case "shop":
    case "thanks":
      return 60;
    case "default_menu":
      return 3600;
    default:
      return 60;
  }
}
