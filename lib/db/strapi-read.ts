import Database from "better-sqlite3";
import path from "path";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";

let strapiDb: Database.Database | null = null;

export function getStrapiDb(): Database.Database | null {
  if (strapiDb) return strapiDb;
  const dbPath = path.resolve(process.cwd(), env.strapiDbPath);
  try {
    strapiDb = new Database(dbPath, { readonly: true, fileMustExist: true });
    return strapiDb;
  } catch (e) {
    console.warn("[strapi-read] Cannot open Strapi DB:", dbPath, e);
    return null;
  }
}

export type StrapiOrderRow = {
  id: number;
  order_number: string;
  order_status: string;
  items: string;
  shipping_address: string | null;
  total: number;
  phone: string | null;
  user_id: number | null;
  updated_at: string;
};

export function getOrderWithUser(orderId: number): StrapiOrderRow | null {
  const db = getStrapiDb();
  if (!db) return null;

  const row = db
    .prepare(
      `SELECT o.id, o.order_number, o.order_status, o.items, o.shipping_address, o.total, o.updated_at,
              u.id AS user_id, u.phone
       FROM orders o
       LEFT JOIN orders_user_lnk l ON l.order_id = o.id
       LEFT JOIN up_users u ON u.id = l.user_id
       WHERE o.id = ?
       LIMIT 1`
    )
    .get(orderId) as StrapiOrderRow | undefined;

  return row ?? null;
}

export function getOrdersByStatus(status: string, limit = 100): StrapiOrderRow[] {
  const db = getStrapiDb();
  if (!db) return [];

  return db
    .prepare(
      `SELECT o.id, o.order_number, o.order_status, o.items, o.shipping_address, o.total, o.updated_at,
              u.id AS user_id, u.phone
       FROM orders o
       LEFT JOIN orders_user_lnk l ON l.order_id = o.id
       LEFT JOIN up_users u ON u.id = l.user_id
       WHERE o.order_status = ?
       ORDER BY o.updated_at DESC
       LIMIT ?`
    )
    .all(status, limit) as StrapiOrderRow[];
}

export function getUserCart(userId: number): { cart: string | null; phone: string | null } | null {
  const db = getStrapiDb();
  if (!db) return null;
  const row = db
    .prepare(`SELECT cart, phone FROM up_users WHERE id = ?`)
    .get(userId) as { cart: string | null; phone: string | null } | undefined;
  return row ?? null;
}

export function listUsersWithPhone(limit = 1000) {
  const db = getStrapiDb();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT id, phone
       FROM up_users
       WHERE phone IS NOT NULL AND phone <> ''
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ id: number; phone: string | null }>;
  return rows
    .map((row) => ({ id: row.id, phone: normalizePhone(row.phone) }))
    .filter((row): row is { id: number; phone: string } => Boolean(row.phone));
}

export function listDeliveredOrdersForSegments(limit = 2000) {
  const rows = getOrdersByStatus("DELIVERED", limit);
  return rows
    .map((row) => {
      const direct = normalizePhone(row.phone);
      let shippingPhone: string | null = null;
      try {
        const shipping = JSON.parse(row.shipping_address || "{}") as { phone?: string };
        shippingPhone = normalizePhone(shipping.phone);
      } catch {
        shippingPhone = null;
      }
      let items: Array<{ weight?: number; productTitle?: string }> = [];
      try {
        items = JSON.parse(row.items) as Array<{ weight?: number; productTitle?: string }>;
      } catch {
        items = [];
      }
      return {
        id: row.id,
        userId: row.user_id,
        phone: direct ?? shippingPhone,
        updatedAt: row.updated_at,
        items,
      };
    })
    .filter(
      (row): row is { id: number; userId: number | null; phone: string; updatedAt: string; items: Array<{ weight?: number; productTitle?: string }> } =>
        Boolean(row.phone)
    );
}
