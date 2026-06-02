import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";
import { getOrderWithUser } from "@/lib/db/strapi-read";
import { schedulePostDeliveryMessages } from "@/lib/scheduling/scheduler";
import { normalizePhone } from "@/lib/phone";
import { setFollowupsScheduledFlag } from "@/lib/db/wa-db";

export async function POST(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { strapiOrderId?: number };
  if (!body.strapiOrderId) return badRequest("strapiOrderId is required");

  const order = getOrderWithUser(body.strapiOrderId);
  if (!order) return badRequest("Order not found in Strapi database");

  let items: Array<{ weight: number; quantity: number; productTitle: string }> = [];
  try {
    items = JSON.parse(order.items) as Array<{
      weight: number;
      quantity: number;
      productTitle: string;
    }>;
  } catch {
    items = [];
  }

  const shippingPhone = (() => {
    try {
      const shipping = JSON.parse(order.shipping_address ?? "{}") as { phone?: string };
      return normalizePhone(shipping.phone);
    } catch {
      return null;
    }
  })();

  const resolvedPhone = normalizePhone(order.phone) ?? shippingPhone;
  if (!resolvedPhone) return badRequest("Order has no valid phone");

  setFollowupsScheduledFlag(order.id, 0);
  schedulePostDeliveryMessages(
    order.id,
    new Date(order.updated_at),
    items,
    resolvedPhone,
    order.user_id ?? undefined
  );
  setFollowupsScheduledFlag(order.id, 1);

  return NextResponse.json({ ok: true });
}
