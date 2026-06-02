import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth/admin";
import { listConversations } from "@/lib/db/wa-db";
import { unauthorized } from "@/lib/admin/http";
import { listUsersWithPhone } from "@/lib/db/strapi-read";

export async function GET(req: NextRequest) {
  if (!requireAdminFromRequest(req)) return unauthorized();
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "500");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 5000) : 500;

  const conversationRows = listConversations(search, safeLimit);
  const map = new Map(
    conversationRows.map((row) => [row.phone, { ...row, has_activity: true }])
  );

  for (const user of listUsersWithPhone(safeLimit)) {
    if (search && !user.phone.includes(search.replace(/\D/g, ""))) continue;
    if (!map.has(user.phone)) {
      map.set(user.phone, {
        phone: user.phone,
        last_at: null,
        last_direction: "outbound" as const,
        last_preview: null,
        outbound_count: 0,
        inbound_count: 0,
        has_activity: false,
      });
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => {
    if (a.has_activity !== b.has_activity) return a.has_activity ? -1 : 1;
    const aTime = a.last_at ? new Date(a.last_at).getTime() : 0;
    const bTime = b.last_at ? new Date(b.last_at).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({ ok: true, rows });
}
