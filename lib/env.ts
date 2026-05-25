function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "3001"), 10),
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3001"),
  internalSecret: () => required("WA_INTERNAL_SECRET"),
  cronSecret: () => optional("CRON_SECRET"),
  whatsapp: {
    apiVersion: optional("WHATSAPP_API_VERSION", "v21.0"),
    phoneNumberId: () => optional("WHATSAPP_PHONE_NUMBER_ID"),
    accessToken: () => optional("WHATSAPP_ACCESS_TOKEN"),
    webhookVerifyToken: () => optional("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    appSecret: () => optional("WHATSAPP_APP_SECRET"),
    defaultCountryCode: optional("WHATSAPP_DEFAULT_COUNTRY_CODE", "91"),
  },
  strapiDbPath: optional(
    "STRAPI_DATABASE_PATH",
    "../YugaFarmsBackend/.tmp/data.db"
  ),
  strapiApiUrl: optional("STRAPI_API_URL", "http://localhost:1337"),
  strapiApiToken: optional("STRAPI_API_TOKEN"),
  waDbPath: optional("WA_DATABASE_PATH", "./data/wa.db"),
  reviewDaysAfterDelivery: parseFloat(
    optional("WA_REVIEW_DAYS_AFTER_DELIVERY", "4")
  ),
  insightsDaysAfterDelivery: parseFloat(
    optional("WA_PRODUCT_INSIGHTS_DAYS_AFTER_DELIVERY", "10")
  ),
  productConsumptionCycles: optional(
    "PRODUCT_CONSUMPTION_CYCLES",
    '{"250":7,"500":12,"1000":25,"2000":45}'
  ),
  cartWebhookUrl: optional("WHATSAPP_CART_WEBHOOK_URL"),
  cartWebhookSecret: optional("WHATSAPP_CART_WEBHOOK_SECRET"),
  sendCartMessages: optional("WA_SEND_CART_MESSAGES", "false") === "true",
  storefrontUrl: optional("STOREFRONT_URL", "https://yugafarms.com"),
  supportPhone: optional("SUPPORT_PHONE", "919671012177"),
};

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    env.whatsapp.phoneNumberId() && env.whatsapp.accessToken()
  );
}
