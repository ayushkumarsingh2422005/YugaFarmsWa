import { NextRequest, NextResponse } from "next/server";
import { logInbound } from "@/lib/db/wa-db";
import {
  verifyWebhookChallenge,
  verifySignature,
} from "@/lib/whatsapp/webhook-verify";
import { normalizePhone } from "@/lib/phone";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  console.log("[wa-webhook][GET] challenge request", {
    mode,
    hasToken: Boolean(token),
    hasChallenge: Boolean(challenge),
  });
  const result = verifyWebhookChallenge(mode, token, challenge);
  if (result) {
    console.log("[wa-webhook][GET] challenge verified");
    return new NextResponse(result, { status: 200 });
  }
  console.warn("[wa-webhook][GET] challenge verification failed");
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  console.log("[wa-webhook][POST] hit", {
    signaturePresent: Boolean(signature),
    payloadPreview: rawBody.slice(0, 1000),
  });

  if (!verifySignature(rawBody, signature)) {
    console.warn("[wa-webhook][POST] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[wa-webhook][POST] invalid json");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = (body.entry as unknown[]) ?? [];
  let messageCount = 0;
  let statusCount = 0;
  for (const entry of entries) {
    const changes = ((entry as { changes?: unknown[] }).changes) ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      const messages = (value.messages as unknown[]) ?? [];
      for (const message of messages) {
        messageCount += 1;
        const m = message as {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        };
        const phone = normalizePhone(m.from);
        if (phone) {
          logInbound(m.id ?? null, phone, m.type ?? "message", message);
        }
      }
      const statuses = (value.statuses as unknown[]) ?? [];
      for (const status of statuses) {
        statusCount += 1;
        const s = status as { id?: string; recipient_id?: string; status?: string };
        const phone = normalizePhone(s.recipient_id);
        if (phone) {
          logInbound(s.id ?? null, phone, `status:${s.status}`, status);
        }
      }
    }
  }

  console.log("[wa-webhook][POST] processed", {
    entries: entries.length,
    messages: messageCount,
    statuses: statusCount,
  });

  return NextResponse.json({ received: true });
}
