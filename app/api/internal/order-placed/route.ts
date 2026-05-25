import { NextRequest, NextResponse } from "next/server";
import { assertInternalSecret } from "@/lib/auth/internal";
import { scheduleOrderThankYou, type OrderPlacedPayload } from "@/lib/scheduling/scheduler";
import { processDueMessages } from "@/lib/scheduling/scheduler";

export async function POST(req: NextRequest) {
  const authErr = assertInternalSecret(req);
  if (authErr) return authErr;

  let body: OrderPlacedPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.strapiOrderId || !body.orderNumber || !body.phone) {
    return NextResponse.json(
      { error: "strapiOrderId, orderNumber, and phone are required" },
      { status: 400 }
    );
  }

  scheduleOrderThankYou(body);
  const sent = await processDueMessages(5);

  return NextResponse.json({
    ok: true,
    scheduled: true,
    processedImmediate: sent.length,
  });
}
