import { NextRequest, NextResponse } from "next/server";
import { assertInternalSecret } from "@/lib/auth/internal";
import { upsertCartSnapshot } from "@/lib/db/wa-db";
import { sendCartSyncNow } from "@/lib/scheduling/scheduler";
import { env } from "@/lib/env";
import type { CartLine } from "@/lib/scheduling/product-cycle";

type CartSyncBody = {
  userId: number;
  phone?: string;
  items: CartLine[];
  totalItems: number;
  totalPrice: number;
  /** When true, optionally push cart to external chatbot webhook (no WA text). */
  notifyChatbotOnly?: boolean;
};

export async function POST(req: NextRequest) {
  const authErr = assertInternalSecret(req);
  if (authErr) return authErr;

  let body: CartSyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "userId and items are required" },
      { status: 400 }
    );
  }

  upsertCartSnapshot({
    userId: body.userId,
    phone: body.phone ?? null,
    items: body.items,
    totalItems: body.totalItems ?? 0,
    totalPrice: body.totalPrice ?? 0,
  });

  let chatbotPushed = false;
  const webhookUrl = env.cartWebhookUrl;
  if (webhookUrl && body.phone) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.cartWebhookSecret
            ? { "x-webhook-secret": env.cartWebhookSecret }
            : {}),
        },
        body: JSON.stringify({
          userId: body.userId,
          phone: body.phone,
          items: body.items,
          totalItems: body.totalItems,
          totalPrice: body.totalPrice,
        }),
      });
      chatbotPushed = res.ok;
    } catch (e) {
      console.warn("[cart-sync] chatbot webhook failed", e);
    }
  }

  let waQueued = { queued: false };
  if (
    env.sendCartMessages &&
    !body.notifyChatbotOnly &&
    body.phone &&
    body.totalItems > 0
  ) {
    waQueued = await sendCartSyncNow({
      userId: body.userId,
      phone: body.phone,
      items: body.items,
      totalItems: body.totalItems,
      totalPrice: body.totalPrice,
    });
  }

  return NextResponse.json({
    ok: true,
    snapshotSaved: true,
    chatbotPushed,
    waQueued: waQueued.queued,
  });
}
