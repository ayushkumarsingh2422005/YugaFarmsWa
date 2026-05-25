import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { env } from "@/lib/env";

export type MessageType =
  | "order_thank_you"
  | "review_request"
  | "product_insights"
  | "repurchase_reminder"
  | "cart_sync";

export type MessageStatus = "pending" | "sent" | "failed" | "cancelled";

let db: Database.Database | null = null;

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      user_id INTEGER,
      strapi_order_id INTEGER,
      message_type TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      sent_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(strapi_order_id, message_type, phone)
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_pending
      ON scheduled_messages(status, scheduled_at);

    CREATE TABLE IF NOT EXISTS order_tracking (
      strapi_order_id INTEGER PRIMARY KEY,
      order_number TEXT,
      phone TEXT NOT NULL,
      user_id INTEGER,
      order_status TEXT,
      delivered_at TEXT,
      thank_you_sent INTEGER NOT NULL DEFAULT 0,
      followups_scheduled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone TEXT,
      items_json TEXT NOT NULL,
      total_items INTEGER NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id)
    );

    CREATE TABLE IF NOT EXISTS message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_type TEXT,
      body TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inbound_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_message_id TEXT,
      phone TEXT,
      event_type TEXT,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try {
    database.exec(
      `ALTER TABLE order_tracking ADD COLUMN followups_scheduled INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    /* column exists */
  }
}

export function getWaDb(): Database.Database {
  if (db) return db;
  const dbPath = path.resolve(process.cwd(), env.waDbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  migrate(db);
  return db;
}

export function enqueueMessage(input: {
  phone: string;
  messageType: MessageType;
  scheduledAt: Date;
  userId?: number;
  strapiOrderId?: number;
  payload?: Record<string, unknown>;
}): number | null {
  const database = getWaDb();
  const scheduledAt = input.scheduledAt.toISOString();
  const payload = input.payload ? JSON.stringify(input.payload) : null;

  try {
    const result = database
      .prepare(
        `INSERT INTO scheduled_messages
         (phone, user_id, strapi_order_id, message_type, scheduled_at, payload, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(
        input.phone,
        input.userId ?? null,
        input.strapiOrderId ?? null,
        input.messageType,
        scheduledAt,
        payload
      );
    return Number(result.lastInsertRowid);
  } catch {
    return null;
  }
}

export function upsertCartSnapshot(input: {
  userId: number;
  phone: string | null;
  items: unknown[];
  totalItems: number;
  totalPrice: number;
}) {
  const database = getWaDb();
  database
    .prepare(
      `INSERT INTO cart_snapshots (user_id, phone, items_json, total_items, total_price, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         phone = excluded.phone,
         items_json = excluded.items_json,
         total_items = excluded.total_items,
         total_price = excluded.total_price,
         updated_at = datetime('now')`
    )
    .run(
      input.userId,
      input.phone,
      JSON.stringify(input.items),
      input.totalItems,
      input.totalPrice
    );
}

export function upsertOrderTracking(input: {
  strapiOrderId: number;
  orderNumber: string;
  phone: string;
  userId?: number;
  orderStatus: string;
  deliveredAt?: string | null;
}) {
  const database = getWaDb();
  database
    .prepare(
      `INSERT INTO order_tracking
       (strapi_order_id, order_number, phone, user_id, order_status, delivered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(strapi_order_id) DO UPDATE SET
         order_number = excluded.order_number,
         phone = excluded.phone,
         user_id = excluded.user_id,
         order_status = excluded.order_status,
         delivered_at = COALESCE(excluded.delivered_at, order_tracking.delivered_at),
         updated_at = datetime('now')`
    )
    .run(
      input.strapiOrderId,
      input.orderNumber,
      input.phone,
      input.userId ?? null,
      input.orderStatus,
      input.deliveredAt ?? null
    );
}

export function markThankYouSent(strapiOrderId: number) {
  getWaDb()
    .prepare(
      `UPDATE order_tracking SET thank_you_sent = 1, updated_at = datetime('now') WHERE strapi_order_id = ?`
    )
    .run(strapiOrderId);
}

export function isFollowupsScheduled(strapiOrderId: number): boolean {
  const row = getWaDb()
    .prepare(
      `SELECT followups_scheduled FROM order_tracking WHERE strapi_order_id = ?`
    )
    .get(strapiOrderId) as { followups_scheduled: number } | undefined;
  return row?.followups_scheduled === 1;
}

export function markFollowupsScheduled(strapiOrderId: number) {
  getWaDb()
    .prepare(
      `UPDATE order_tracking SET followups_scheduled = 1, updated_at = datetime('now') WHERE strapi_order_id = ?`
    )
    .run(strapiOrderId);
}

export function getDueMessages(limit = 50) {
  return getWaDb()
    .prepare(
      `SELECT * FROM scheduled_messages
       WHERE status = 'pending' AND scheduled_at <= datetime('now')
       ORDER BY scheduled_at ASC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    phone: string;
    user_id: number | null;
    strapi_order_id: number | null;
    message_type: MessageType;
    scheduled_at: string;
    payload: string | null;
  }>;
}

export function markMessageSent(id: number) {
  getWaDb()
    .prepare(
      `UPDATE scheduled_messages SET status = 'sent', sent_at = datetime('now') WHERE id = ?`
    )
    .run(id);
}

export function markMessageFailed(id: number, error: string) {
  getWaDb()
    .prepare(
      `UPDATE scheduled_messages SET status = 'failed', error = ? WHERE id = ?`
    )
    .run(error.slice(0, 500), id);
}

export function logOutbound(phone: string, messageType: string, body: string, meta?: unknown) {
  getWaDb()
    .prepare(
      `INSERT INTO message_log (phone, direction, message_type, body, meta_json)
       VALUES (?, 'outbound', ?, ?, ?)`
    )
    .run(phone, messageType, body, meta ? JSON.stringify(meta) : null);
}

export function logInbound(waMessageId: string | null, phone: string, eventType: string, payload: unknown) {
  getWaDb()
    .prepare(
      `INSERT INTO inbound_events (wa_message_id, phone, event_type, payload)
       VALUES (?, ?, ?, ?)`
    )
    .run(waMessageId, phone, eventType, JSON.stringify(payload));
}
