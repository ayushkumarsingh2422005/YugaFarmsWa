import Database from "better-sqlite3";
import path from "path";
import { env } from "@/lib/env";

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
