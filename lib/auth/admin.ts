import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  createAdminSession,
  deleteAdminSession,
  getAdminSession,
  purgeExpiredAdminSessions,
} from "@/lib/db/wa-db";

export const ADMIN_SESSION_COOKIE = "wa_admin_session";

function hashToken(token: string): string {
  return crypto
    .createHmac("sha256", env.admin.sessionSecret())
    .update(token)
    .digest("hex");
}

export function verifyAdminPassword(password: string): boolean {
  return password === env.admin.password();
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function persistAdminSession(rawToken: string) {
  purgeExpiredAdminSessions();
  const expiresAt = new Date(
    Date.now() + env.admin.sessionTtlHours * 60 * 60 * 1000
  );
  createAdminSession(hashToken(rawToken), expiresAt.toISOString());
  return expiresAt;
}

export async function setAdminCookie(
  response: NextResponse,
  rawToken: string,
  expiresAt: Date
) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: rawToken,
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAdminCookie(response: NextResponse) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (raw) {
    deleteAdminSession(hashToken(raw));
  }
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    path: "/",
    expires: new Date(0),
  });
}

export async function requireAdminFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return false;
  return Boolean(getAdminSession(hashToken(raw)));
}

export function requireAdminFromRequest(req: NextRequest): boolean {
  const raw = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return false;
  return Boolean(getAdminSession(hashToken(raw)));
}
