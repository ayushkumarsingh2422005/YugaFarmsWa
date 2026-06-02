import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";

export async function GET(req: NextRequest) {
  const ok = requireAdminFromRequest(req);
  return NextResponse.json({ authenticated: ok }, { status: ok ? 200 : 401 });
}
