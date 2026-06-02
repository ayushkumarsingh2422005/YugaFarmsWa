import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/auth/admin";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearAdminCookie(response);
  return response;
}
