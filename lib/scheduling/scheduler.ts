import { env } from "@/lib/env";
import {
  enqueueMessage,
  getDueMessages,
  markMessageFailed,
  markMessageSent,
  markThankYouSent,
  isFollowupsScheduled,
  markFollowupsScheduled,
  upsertOrderTracking,
  type MessageType,
} from "@/lib/db/wa-db";
import { getOrderWithUser, getOrdersByStatus } from "@/lib/db/strapi-read";
import { normalizePhone } from "@/lib/phone";
import {
  orderThankYouMessage,
  reviewRequestMessage,
  productInsightsMessage,
  repurchaseReminderMessage,
  cartSyncMessage,
} from "@/lib/messages/templates";
import { repurchaseDatesFromItems, type CartLine } from "@/lib/scheduling/product-cycle";
import { sendWhatsAppText } from "@/lib/whatsapp/client";

export type OrderPlacedPayload = {
  strapiOrderId: number;
  orderNumber: string;
  total: number;
  phone: string;
  userId?: number;
  customerName?: string;
  items: CartLine[];
};

export function scheduleOrderThankYou(payload: OrderPlacedPayload) {
  const phone = normalizePhone(payload.phone);
  if (!phone) return;

  upsertOrderTracking({
    strapiOrderId: payload.strapiOrderId,
    orderNumber: payload.orderNumber,
    phone,
    userId: payload.userId,
    orderStatus: "CONFIRMED",
  });

  enqueueMessage({
    phone,
    userId: payload.userId,
    strapiOrderId: payload.strapiOrderId,
    messageType: "order_thank_you",
    scheduledAt: new Date(),
    payload: {
      orderNumber: payload.orderNumber,
      total: payload.total,
      customerName: payload.customerName,
    },
  });
}

export function schedulePostDeliveryMessages(
  strapiOrderId: number,
  deliveredAt: Date,
  items: CartLine[],
  phone: string,
  userId?: number
) {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  const reviewAt = new Date(deliveredAt);
  reviewAt.setDate(
    reviewAt.getDate() + env.reviewDaysAfterDelivery
  );

  const insightsAt = new Date(deliveredAt);
  insightsAt.setDate(
    insightsAt.getDate() + env.insightsDaysAfterDelivery
  );

  enqueueMessage({
    phone: normalized,
    userId,
    strapiOrderId,
    messageType: "review_request",
    scheduledAt: reviewAt,
    payload: { strapiOrderId },
  });

  enqueueMessage({
    phone: normalized,
    userId,
    strapiOrderId,
    messageType: "product_insights",
    scheduledAt: insightsAt,
  });

  for (const cycle of repurchaseDatesFromItems(items, deliveredAt)) {
    enqueueMessage({
      phone: normalized,
      userId,
      strapiOrderId,
      messageType: "repurchase_reminder",
      scheduledAt: cycle.scheduledAt,
      payload: {
        productTitle: cycle.title,
        days: cycle.days,
        weight: cycle.weight,
      },
    });
  }
}

/** Scan Strapi for newly DELIVERED orders and schedule follow-ups once. */
export function syncDeliveredOrdersFromStrapi() {
  const delivered = getOrdersByStatus("DELIVERED", 200);
  let scheduled = 0;

  for (const row of delivered) {
    let shippingPhone: string | null = null;
    try {
      const shipping = JSON.parse(row.shipping_address || "{}") as {
        phone?: string;
      };
      shippingPhone = normalizePhone(shipping.phone);
    } catch {
      /* ignore */
    }

    const resolvedPhone = normalizePhone(row.phone) ?? shippingPhone;
    if (!resolvedPhone) continue;

    const deliveredAt = new Date(row.updated_at);
    let items: CartLine[] = [];
    try {
      items = JSON.parse(row.items) as CartLine[];
    } catch {
      items = [];
    }

    if (isFollowupsScheduled(row.id)) continue;

    upsertOrderTracking({
      strapiOrderId: row.id,
      orderNumber: row.order_number,
      phone: resolvedPhone,
      userId: row.user_id ?? undefined,
      orderStatus: "DELIVERED",
      deliveredAt: deliveredAt.toISOString(),
    });

    schedulePostDeliveryMessages(
      row.id,
      deliveredAt,
      items,
      resolvedPhone,
      row.user_id ?? undefined
    );
    markFollowupsScheduled(row.id);
    scheduled += 1;
  }

  return scheduled;
}

function buildBody(
  type: MessageType,
  payload: Record<string, unknown> | null,
  orderNumber?: string
): string {
  switch (type) {
    case "order_thank_you":
      return orderThankYouMessage({
        customerName: payload?.customerName as string | undefined,
        orderNumber: (payload?.orderNumber as string) ?? orderNumber ?? "",
        total: Number(payload?.total ?? 0),
      });
    case "review_request":
      return reviewRequestMessage({
        orderNumber: orderNumber ?? String(payload?.strapiOrderId ?? ""),
      });
    case "product_insights":
      return productInsightsMessage();
    case "repurchase_reminder":
      return repurchaseReminderMessage({
        productTitle: (payload?.productTitle as string) ?? "your Yuga Farms product",
        days: Number(payload?.days ?? 12),
      });
    case "cart_sync":
      return cartSyncMessage({
        totalItems: Number(payload?.totalItems ?? 0),
        totalPrice: Number(payload?.totalPrice ?? 0),
        lines: (payload?.items as CartLine[]) ?? [],
      });
    default:
      return "Message from Yuga Farms";
  }
}

export async function processDueMessages(limit = 50) {
  const due = getDueMessages(limit);
  const results: Array<{ id: number; ok: boolean; error?: string }> = [];

  for (const msg of due) {
    let payload: Record<string, unknown> | null = null;
    if (msg.payload) {
      try {
        payload = JSON.parse(msg.payload);
      } catch {
        payload = null;
      }
    }

    let orderNumber: string | undefined;
    if (msg.strapi_order_id) {
      const order = getOrderWithUser(msg.strapi_order_id);
      orderNumber = order?.order_number;
    }

    const body = buildBody(msg.message_type, payload, orderNumber);
    const result = await sendWhatsAppText(
      msg.phone,
      body,
      msg.message_type
    );

    if (result.ok) {
      markMessageSent(msg.id);
      if (msg.message_type === "order_thank_you" && msg.strapi_order_id) {
        markThankYouSent(msg.strapi_order_id);
      }
      results.push({ id: msg.id, ok: true });
    } else {
      markMessageFailed(msg.id, result.error);
      results.push({ id: msg.id, ok: false, error: result.error });
    }
  }

  return results;
}

export async function sendCartSyncNow(input: {
  userId: number;
  phone: string;
  items: CartLine[];
  totalItems: number;
  totalPrice: number;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone || input.totalItems === 0) return { queued: false };

  const id = enqueueMessage({
    phone,
    userId: input.userId,
    messageType: "cart_sync",
    scheduledAt: new Date(),
    payload: {
      items: input.items,
      totalItems: input.totalItems,
      totalPrice: input.totalPrice,
    },
  });

  return { queued: id != null };
}
