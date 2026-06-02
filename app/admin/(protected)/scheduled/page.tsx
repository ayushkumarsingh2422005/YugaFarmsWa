"use client";

import { useEffect, useState } from "react";

type ScheduledRow = {
  id: number;
  phone: string;
  message_type: string;
  scheduled_at: string;
  status: string;
  error: string | null;
};

export default function ScheduledPage() {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [status, setStatus] = useState("all");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (phone.trim()) params.set("phone", phone.trim());
    const res = await fetch(`/api/admin/scheduled/list?${params.toString()}`);
    const data = (await res.json()) as { rows: ScheduledRow[] };
    setRows(data.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function doAction(path: string, payload: Record<string, unknown>) {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Scheduled Messages</h2>
        <p className="text-sm text-neutral-600">
          Manage pending, failed, and cancelled queue items.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Filter by phone"
            className="rounded border px-2 py-2 text-sm"
          />
          <button onClick={() => void load()} className="rounded border px-3 py-2 text-sm">
            Apply
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scheduled</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2">{row.phone}</td>
                <td className="px-3 py-2">{row.message_type}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{new Date(row.scheduled_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-red-700">{row.error ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void doAction("/api/admin/scheduled/retry", { id: row.id })}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => void doAction("/api/admin/scheduled/cancel", { id: row.id })}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        void doAction("/api/admin/scheduled/reschedule", {
                          id: row.id,
                          scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                        })
                      }
                      className="rounded border px-2 py-1 text-xs"
                    >
                      +5m
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                  No records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
