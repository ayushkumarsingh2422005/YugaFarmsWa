import { env } from "@/lib/env";

export type CartLine = {
  productId?: number;
  variantId?: number;
  weight?: number;
  quantity?: number;
  productTitle?: string;
};

let cycleMap: Record<string, number> | null = null;

function loadCycles(): Record<string, number> {
  if (cycleMap) return cycleMap;
  try {
    cycleMap = JSON.parse(env.productConsumptionCycles) as Record<string, number>;
  } catch {
    cycleMap = { "250": 7, "500": 12, "1000": 25, "2000": 45 };
  }
  return cycleMap;
}

/** Days until repurchase reminder based on variant weight (500 → 12, 1000 → 25, etc.) */
export function consumptionDaysForWeight(weight: number): number {
  const cycles = loadCycles();
  const exact = cycles[String(weight)];
  if (exact != null) return exact;
  if (weight >= 2000) return cycles["2000"] ?? 45;
  if (weight >= 1000) return cycles["1000"] ?? 25;
  if (weight >= 500) return cycles["500"] ?? 12;
  if (weight >= 250) return cycles["250"] ?? 7;
  return 14;
}

export function repurchaseDatesFromItems(
  items: CartLine[],
  baseDate: Date
): Array<{ weight: number; days: number; scheduledAt: Date; title: string }> {
  const out: Array<{ weight: number; days: number; scheduledAt: Date; title: string }> = [];
  for (const item of items) {
    const weight = item.weight ?? 0;
    if (!weight) continue;
    const days = consumptionDaysForWeight(weight);
    const scheduledAt = new Date(baseDate);
    scheduledAt.setDate(scheduledAt.getDate() + days);
    out.push({
      weight,
      days,
      scheduledAt,
      title: item.productTitle ?? "your Yuga Farms product",
    });
  }
  return out;
}
