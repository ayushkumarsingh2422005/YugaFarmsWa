import { NextRequest } from "next/server";
import { env } from "@/lib/env";

export function assertInternalSecret(req: NextRequest): Response | null {
  const expected = env.internalSecret();
  const provided =
    req.headers.get("x-wa-internal-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export function assertCronSecret(req: NextRequest): Response | null {
  const secret = env.cronSecret();
  if (!secret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const provided =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
