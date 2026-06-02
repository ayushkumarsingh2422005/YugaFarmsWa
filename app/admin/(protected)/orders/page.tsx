"use client";

import { useEffect, useState } from "react";

type OrderRow = {
  strapi_order_id: number;
  order_number: string | null;
  phone: string;
  order_status: string | null;
  delivered_at: string | null;
  thank_you_sent: number;
  followups_scheduled: number;
  updated_at: string;
};

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/orders/list");
    const data = (await res.json()) as { rows: OrderRow[] };
    setRows(data.rows ?? []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function syncDeliveredNow() {
    setSyncing(true);
    await fetch("/api/admin/orders/sync-delivered-now", { method: "POST" });
    await load();
    setSyncing(false);
  }

  async function recompute(strapiOrderId: number) {
    await fetch("/api/admin/orders/recompute-followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strapiOrderId }),
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Order Tracking</h2>
        <p className="text-sm text-neutral-600">
          Review delivery sync state and follow-up scheduling.
        </p>
        <button
          onClick={() => void syncDeliveredNow()}
          disabled={syncing}
          className="mt-3 rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync Delivered Orders Now"}
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Delivered At</th>
              <th className="px-3 py-2">Thank You</th>
              <th className="px-3 py-2">Followups</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.strapi_order_id} className="border-t">
                <td className="px-3 py-2">
                  {row.order_number ?? row.strapi_order_id}
                </td>
                <td className="px-3 py-2">{row.phone}</td>
                <td className="px-3 py-2">{row.order_status ?? "-"}</td>
                <td className="px-3 py-2">
                  {row.delivered_at ? new Date(row.delivered_at).toLocaleString() : "-"}
                </td>
                <td className="px-3 py-2">{row.thank_you_sent ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{row.followups_scheduled ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{new Date(row.updated_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => void recompute(row.strapi_order_id)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Recompute Followups
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  No order tracking rows yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
