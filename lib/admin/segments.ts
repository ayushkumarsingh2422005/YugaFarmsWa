import { normalizePhone } from "@/lib/phone";
import {
  listCartSnapshotPhones,
  phonesByTagIds,
} from "@/lib/db/wa-db";
import {
  listDeliveredOrdersForSegments,
  listUsersWithPhone,
} from "@/lib/db/strapi-read";

export type CampaignTarget = {
  includeExistingUsers?: boolean;
  includeCartAbandoners?: boolean;
  includeDeliveredOrders?: boolean;
  deliveredAfter?: string;
  deliveredWeightIn?: number[];
  manualTagIds?: number[];
};

export type SegmentRecipient = {
  phone: string;
  userId?: number;
  source: string;
};

export function resolveRecipientsFromTarget(target: CampaignTarget): SegmentRecipient[] {
  const recipients = new Map<string, SegmentRecipient>();

  function add(row: SegmentRecipient) {
    const phone = normalizePhone(row.phone);
    if (!phone) return;
    if (!recipients.has(phone)) {
      recipients.set(phone, { ...row, phone });
      return;
    }
    const existing = recipients.get(phone);
    if (existing && !existing.userId && row.userId) {
      recipients.set(phone, { ...existing, userId: row.userId });
    }
  }

  if (target.includeExistingUsers) {
    for (const user of listUsersWithPhone(5000)) {
      add({ phone: user.phone, userId: user.id, source: "existing_users" });
    }
  }

  if (target.includeCartAbandoners) {
    for (const row of listCartSnapshotPhones(5000)) {
      add({ phone: row.phone, userId: row.user_id, source: "cart_abandoners" });
    }
  }

  if (target.includeDeliveredOrders) {
    const deliveredAfterMs = target.deliveredAfter
      ? new Date(target.deliveredAfter).getTime()
      : null;
    const allowedWeights = new Set(target.deliveredWeightIn ?? []);
    for (const row of listDeliveredOrdersForSegments(5000)) {
      if (deliveredAfterMs && new Date(row.updatedAt).getTime() < deliveredAfterMs) {
        continue;
      }
      if (allowedWeights.size > 0) {
        const hasWeight = row.items.some((item) =>
          item.weight != null ? allowedWeights.has(Number(item.weight)) : false
        );
        if (!hasWeight) continue;
      }
      add({ phone: row.phone, userId: row.userId ?? undefined, source: "delivered_orders" });
    }
  }

  if ((target.manualTagIds?.length ?? 0) > 0) {
    const taggedPhones = phonesByTagIds(target.manualTagIds ?? []);
    for (const phone of taggedPhones) {
      add({ phone, source: "manual_tags" });
    }
  }

  return Array.from(recipients.values());
}
