import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  persistAdminSession,
  setAdminCookie,
  verifyAdminPassword,
} from "@/lib/auth/admin";
import { badRequest, unauthorized } from "@/lib/admin/http";

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return badRequest("Invalid JSON payload");
  }

  if (!body.password) {
    return badRequest("password is required");
  }

  if (!verifyAdminPassword(body.password)) {
    return unauthorized("Invalid credentials");
  }

  const token = createSessionToken();
  const expiresAt = persistAdminSession(token);

  const response = NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  await setAdminCookie(response, token, expiresAt);
  return response;
}
