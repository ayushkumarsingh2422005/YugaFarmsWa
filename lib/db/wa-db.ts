import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { env } from "@/lib/env";

export type MessageType =
  | "order_thank_you"
  | "review_request"
  | "product_insights"
  | "repurchase_reminder"
  | "cart_sync"
  | "campaign_broadcast";

export type MessageStatus = "pending" | "sent" | "failed" | "cancelled";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type CampaignRecipientStatus =
  | "pending"
  | "queued"
  | "sent"
  | "failed"
  | "cancelled";

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

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
      ON admin_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS manual_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tag_id, phone),
      FOREIGN KEY(tag_id) REFERENCES manual_tags(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_tags_phone
      ON user_tags(phone);

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message_body TEXT NOT NULL,
      send_mode TEXT NOT NULL DEFAULT 'freeform_anytime',
      target_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_recipients INTEGER NOT NULL DEFAULT 0,
      queued_recipients INTEGER NOT NULL DEFAULT 0,
      sent_recipients INTEGER NOT NULL DEFAULT 0,
      failed_recipients INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_campaigns_status
      ON campaigns(status, created_at);

    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      user_id INTEGER,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      message_id INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(campaign_id, phone),
      FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status
      ON campaign_recipients(campaign_id, status);

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

export function setFollowupsScheduledFlag(strapiOrderId: number, value: 0 | 1) {
  getWaDb()
    .prepare(
      `UPDATE order_tracking
       SET followups_scheduled = ?, updated_at = datetime('now')
       WHERE strapi_order_id = ?`
    )
    .run(value, strapiOrderId);
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

export type ConversationRow = {
  phone: string;
  last_at: string;
  last_direction: "inbound" | "outbound";
  last_preview: string | null;
  outbound_count: number;
  inbound_count: number;
};

export function listConversations(search = "", limit = 100): ConversationRow[] {
  const database = getWaDb();
  const q = `%${search.trim()}%`;
  return database
    .prepare(
      `WITH convo AS (
         SELECT phone, 'outbound' AS direction, body AS preview, created_at
         FROM message_log
         UNION ALL
         SELECT phone, 'inbound' AS direction, payload AS preview, created_at
         FROM inbound_events
       ),
       filtered AS (
         SELECT * FROM convo
         WHERE phone IS NOT NULL AND phone LIKE ?
       ),
       latest AS (
         SELECT f.phone, f.direction, f.preview, f.created_at
         FROM filtered f
         INNER JOIN (
           SELECT phone, MAX(created_at) AS last_at
           FROM filtered
           GROUP BY phone
         ) m ON m.phone = f.phone AND m.last_at = f.created_at
       )
       SELECT
         l.phone,
         l.created_at AS last_at,
         l.direction AS last_direction,
         SUBSTR(l.preview, 1, 200) AS last_preview,
         (SELECT COUNT(*) FROM message_log m WHERE m.phone = l.phone) AS outbound_count,
         (SELECT COUNT(*) FROM inbound_events i WHERE i.phone = l.phone) AS inbound_count
       FROM latest l
       ORDER BY l.created_at DESC
       LIMIT ?`
    )
    .all(q, limit) as ConversationRow[];
}

export type ThreadEvent = {
  id: number;
  phone: string;
  direction: "inbound" | "outbound";
  message_type: string | null;
  body: string | null;
  payload: string | null;
  created_at: string;
};

export function getConversationThread(phone: string, limit = 200): ThreadEvent[] {
  return getWaDb()
    .prepare(
      `SELECT id, phone, direction, message_type, body, payload, created_at
       FROM (
         SELECT id, phone, 'outbound' AS direction, message_type, body, meta_json AS payload, created_at
         FROM message_log
         WHERE phone = ?
         UNION ALL
         SELECT id, phone, 'inbound' AS direction, event_type AS message_type, NULL AS body, payload, created_at
         FROM inbound_events
         WHERE phone = ?
       )
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(phone, phone, limit) as ThreadEvent[];
}

export type ScheduledMessageRow = {
  id: number;
  phone: string;
  user_id: number | null;
  strapi_order_id: number | null;
  message_type: MessageType;
  scheduled_at: string;
  sent_at: string | null;
  status: MessageStatus;
  payload: string | null;
  error: string | null;
  created_at: string;
};

export function listScheduledMessages(filters: {
  status?: MessageStatus;
  phone?: string;
  messageType?: MessageType;
  limit?: number;
}): ScheduledMessageRow[] {
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.phone) {
    clauses.push("phone LIKE ?");
    params.push(`%${filters.phone}%`);
  }
  if (filters.messageType) {
    clauses.push("message_type = ?");
    params.push(filters.messageType);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getWaDb()
    .prepare(
      `SELECT * FROM scheduled_messages
       ${where}
       ORDER BY scheduled_at DESC
       LIMIT ?`
    )
    .all(...params, limit) as ScheduledMessageRow[];
}

export function cancelScheduledMessage(id: number): boolean {
  const res = getWaDb()
    .prepare(
      `UPDATE scheduled_messages
       SET status = 'cancelled', error = COALESCE(error, 'cancelled_by_admin')
       WHERE id = ? AND status IN ('pending', 'failed')`
    )
    .run(id);
  return res.changes > 0;
}

export function retryScheduledMessage(id: number): boolean {
  const res = getWaDb()
    .prepare(
      `UPDATE scheduled_messages
       SET status = 'pending', error = NULL, scheduled_at = datetime('now')
       WHERE id = ? AND status = 'failed'`
    )
    .run(id);
  return res.changes > 0;
}

export function rescheduleMessage(id: number, scheduledAtIso: string): boolean {
  const res = getWaDb()
    .prepare(
      `UPDATE scheduled_messages
       SET scheduled_at = ?, status = 'pending', error = NULL
       WHERE id = ? AND status IN ('pending', 'failed')`
    )
    .run(scheduledAtIso, id);
  return res.changes > 0;
}

export function listOrderTracking(limit = 200) {
  return getWaDb()
    .prepare(
      `SELECT *
       FROM order_tracking
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    strapi_order_id: number;
    order_number: string | null;
    phone: string;
    user_id: number | null;
    order_status: string | null;
    delivered_at: string | null;
    thank_you_sent: number;
    followups_scheduled: number;
    updated_at: string;
  }>;
}

export function createAdminSession(tokenHash: string, expiresAtIso: string): void {
  getWaDb()
    .prepare(
      `INSERT INTO admin_sessions (token_hash, expires_at)
       VALUES (?, ?)`
    )
    .run(tokenHash, expiresAtIso);
}

export function getAdminSession(tokenHash: string) {
  return getWaDb()
    .prepare(
      `SELECT *
       FROM admin_sessions
       WHERE token_hash = ? AND expires_at > datetime('now')
       LIMIT 1`
    )
    .get(tokenHash) as
    | {
        id: number;
        token_hash: string;
        expires_at: string;
      }
    | undefined;
}

export function deleteAdminSession(tokenHash: string): void {
  getWaDb()
    .prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`)
    .run(tokenHash);
}

export function purgeExpiredAdminSessions(): void {
  getWaDb()
    .prepare(`DELETE FROM admin_sessions WHERE expires_at <= datetime('now')`)
    .run();
}

export function upsertManualTag(name: string): { id: number; name: string } {
  const clean = name.trim().toLowerCase();
  const database = getWaDb();
  database
    .prepare(
      `INSERT INTO manual_tags(name)
       VALUES (?)
       ON CONFLICT(name) DO NOTHING`
    )
    .run(clean);
  const row = database
    .prepare(`SELECT id, name FROM manual_tags WHERE name = ? LIMIT 1`)
    .get(clean) as { id: number; name: string };
  return row;
}

export function listManualTags() {
  return getWaDb()
    .prepare(
      `SELECT t.id, t.name, COUNT(ut.id) AS linked_phones
       FROM manual_tags t
       LEFT JOIN user_tags ut ON ut.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name ASC`
    )
    .all() as Array<{ id: number; name: string; linked_phones: number }>;
}

export function assignTagToPhone(tagId: number, phone: string): void {
  getWaDb()
    .prepare(
      `INSERT INTO user_tags(tag_id, phone)
       VALUES (?, ?)
       ON CONFLICT(tag_id, phone) DO NOTHING`
    )
    .run(tagId, phone);
}

export function removeTagFromPhone(tagId: number, phone: string): void {
  getWaDb()
    .prepare(`DELETE FROM user_tags WHERE tag_id = ? AND phone = ?`)
    .run(tagId, phone);
}

export function phonesByTagIds(tagIds: number[]): string[] {
  if (tagIds.length === 0) return [];
  const placeholders = tagIds.map(() => "?").join(",");
  const rows = getWaDb()
    .prepare(
      `SELECT DISTINCT phone
       FROM user_tags
       WHERE tag_id IN (${placeholders})`
    )
    .all(...tagIds) as Array<{ phone: string }>;
  return rows.map((r) => r.phone);
}

export function createCampaign(input: {
  name: string;
  messageBody: string;
  sendMode: string;
  targetJson: string;
  scheduledAt: string | null;
}): number {
  const result = getWaDb()
    .prepare(
      `INSERT INTO campaigns(name, message_body, send_mode, target_json, scheduled_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.name, input.messageBody, input.sendMode, input.targetJson, input.scheduledAt);
  return Number(result.lastInsertRowid);
}

export function listCampaigns(limit = 100) {
  return getWaDb()
    .prepare(
      `SELECT *
       FROM campaigns
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    name: string;
    message_body: string;
    send_mode: string;
    target_json: string;
    status: CampaignStatus;
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    total_recipients: number;
    queued_recipients: number;
    sent_recipients: number;
    failed_recipients: number;
    created_at: string;
  }>;
}

export function getCampaignById(id: number) {
  return getWaDb()
    .prepare(`SELECT * FROM campaigns WHERE id = ? LIMIT 1`)
    .get(id) as
    | {
        id: number;
        name: string;
        message_body: string;
        send_mode: string;
        target_json: string;
        status: CampaignStatus;
        scheduled_at: string | null;
        started_at: string | null;
        completed_at: string | null;
        total_recipients: number;
        queued_recipients: number;
        sent_recipients: number;
        failed_recipients: number;
        created_at: string;
      }
    | undefined;
}

export function addCampaignRecipients(
  campaignId: number,
  rows: Array<{ phone: string; userId?: number; source: string }>
): number {
  const insert = getWaDb().prepare(
    `INSERT INTO campaign_recipients(campaign_id, phone, user_id, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(campaign_id, phone) DO NOTHING`
  );
  let inserted = 0;
  const tx = getWaDb().transaction(() => {
    for (const row of rows) {
      const res = insert.run(campaignId, row.phone, row.userId ?? null, row.source);
      inserted += res.changes;
    }
  });
  tx();
  return inserted;
}

export function listCampaignRecipients(campaignId: number, limit = 500) {
  return getWaDb()
    .prepare(
      `SELECT *
       FROM campaign_recipients
       WHERE campaign_id = ?
       ORDER BY id ASC
       LIMIT ?`
    )
    .all(campaignId, limit) as Array<{
    id: number;
    campaign_id: number;
    phone: string;
    user_id: number | null;
    source: string;
    status: CampaignRecipientStatus;
    message_id: number | null;
    error: string | null;
    created_at: string;
  }>;
}

export function markCampaignStatus(
  campaignId: number,
  status: CampaignStatus,
  patch?: Partial<{
    started_at: string | null;
    completed_at: string | null;
    total_recipients: number;
    queued_recipients: number;
    sent_recipients: number;
    failed_recipients: number;
  }>
): void {
  getWaDb()
    .prepare(
      `UPDATE campaigns
       SET status = ?,
           started_at = COALESCE(?, started_at),
           completed_at = COALESCE(?, completed_at),
           total_recipients = COALESCE(?, total_recipients),
           queued_recipients = COALESCE(?, queued_recipients),
           sent_recipients = COALESCE(?, sent_recipients),
           failed_recipients = COALESCE(?, failed_recipients),
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      status,
      patch?.started_at ?? null,
      patch?.completed_at ?? null,
      patch?.total_recipients ?? null,
      patch?.queued_recipients ?? null,
      patch?.sent_recipients ?? null,
      patch?.failed_recipients ?? null,
      campaignId
    );
}

export function markCampaignRecipientQueued(
  campaignRecipientId: number,
  scheduledMessageId: number
): void {
  getWaDb()
    .prepare(
      `UPDATE campaign_recipients
       SET status = 'queued', message_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(scheduledMessageId, campaignRecipientId);
}

export function markCampaignRecipientFailed(
  campaignRecipientId: number,
  error: string
): void {
  getWaDb()
    .prepare(
      `UPDATE campaign_recipients
       SET status = 'failed', error = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(error.slice(0, 500), campaignRecipientId);
}

export function updateCampaignMetrics(campaignId: number): void {
  getWaDb()
    .prepare(
      `UPDATE campaigns
       SET
         total_recipients = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ?),
         queued_recipients = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ? AND status = 'queued'),
         sent_recipients = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ? AND status = 'sent'),
         failed_recipients = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = ? AND status = 'failed'),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(campaignId, campaignId, campaignId, campaignId, campaignId);
}

export function analyticsSummary(days = 14) {
  const database = getWaDb();
  const totals = database
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM scheduled_messages`
    )
    .get() as { sent: number | null; failed: number | null; pending: number | null };
  const inbound = database
    .prepare(`SELECT COUNT(*) AS total FROM inbound_events`)
    .get() as { total: number };
  const outboundSeries = database
    .prepare(
      `SELECT DATE(created_at) AS day, COUNT(*) AS total
       FROM message_log
       WHERE created_at >= datetime('now', ?)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    )
    .all(`-${days} days`) as Array<{ day: string; total: number }>;
  return {
    sent: totals.sent ?? 0,
    failed: totals.failed ?? 0,
    pending: totals.pending ?? 0,
    inbound: inbound.total ?? 0,
    outboundSeries,
  };
}

export function listCartSnapshotPhones(limit = 2000) {
  return getWaDb()
    .prepare(
      `SELECT user_id, phone, total_items, total_price, updated_at
       FROM cart_snapshots
       WHERE phone IS NOT NULL AND phone <> '' AND total_items > 0
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    user_id: number;
    phone: string;
    total_items: number;
    total_price: number;
    updated_at: string;
  }>;
}

export function listCampaignRecipientsByMessageStatus(campaignId: number) {
  return getWaDb()
    .prepare(
      `SELECT
         cr.id,
         cr.status,
         sm.status AS message_status,
         sm.error AS message_error
       FROM campaign_recipients cr
       LEFT JOIN scheduled_messages sm ON sm.id = cr.message_id
       WHERE cr.campaign_id = ?`
    )
    .all(campaignId) as Array<{
    id: number;
    status: CampaignRecipientStatus;
    message_status: MessageStatus | null;
    message_error: string | null;
  }>;
}

export function syncCampaignRecipientStatuses(campaignId: number): void {
  const rows = listCampaignRecipientsByMessageStatus(campaignId);
  const update = getWaDb().prepare(
    `UPDATE campaign_recipients
     SET status = ?, error = ?, updated_at = datetime('now')
     WHERE id = ?`
  );
  const tx = getWaDb().transaction(() => {
    for (const row of rows) {
      let nextStatus: CampaignRecipientStatus = row.status;
      if (row.message_status === "sent") nextStatus = "sent";
      if (row.message_status === "failed") nextStatus = "failed";
      if (row.message_status === "cancelled") nextStatus = "cancelled";
      if (nextStatus !== row.status || row.message_error) {
        update.run(nextStatus, row.message_error, row.id);
      }
    }
  });
  tx();
  updateCampaignMetrics(campaignId);
}

export function setAppMeta(key: string, value: string) {
  getWaDb()
    .prepare(
      `INSERT INTO app_kv(key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`
    )
    .run(key, value);
}

export function getAppMeta(key: string) {
  return getWaDb()
    .prepare(`SELECT value, updated_at FROM app_kv WHERE key = ? LIMIT 1`)
    .get(key) as { value: string; updated_at: string } | undefined;
}
