"use client";

import { useEffect, useState } from "react";

type AnalyticsPayload = {
  summary: {
    sent: number;
    failed: number;
    pending: number;
    inbound: number;
    outboundSeries: Array<{ day: string; total: number }>;
  };
  campaignStats: {
    total: number;
    completed: number;
    running: number;
    failed: number;
  };
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  async function load() {
    const res = await fetch("/api/admin/analytics/summary");
    const payload = (await res.json()) as AnalyticsPayload;
    setData(payload);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!data) {
    return <p className="text-sm text-neutral-600">Loading analytics...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Outbound Sent" value={data.summary.sent} />
        <Card title="Outbound Failed" value={data.summary.failed} />
        <Card title="Pending Queue" value={data.summary.pending} />
        <Card title="Inbound Events" value={data.summary.inbound} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <h3 className="font-semibold">Outbound Volume (30 days)</h3>
          <div className="mt-3 space-y-2">
            {data.summary.outboundSeries.map((point) => (
              <div key={point.day} className="flex items-center gap-2 text-sm">
                <span className="w-28 text-neutral-600">{point.day}</span>
                <div
                  className="h-2 rounded bg-black"
                  style={{ width: `${Math.max(4, Math.min(point.total * 8, 280))}px` }}
                />
                <span>{point.total}</span>
              </div>
            ))}
            {data.summary.outboundSeries.length === 0 ? (
              <p className="text-sm text-neutral-500">No outbound events yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <h3 className="font-semibold">Campaign Stats</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Total campaigns: {data.campaignStats.total}</li>
            <li>Running/scheduled: {data.campaignStats.running}</li>
            <li>Completed: {data.campaignStats.completed}</li>
            <li>Failed: {data.campaignStats.failed}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded border bg-white p-4">
      <p className="text-sm text-neutral-600">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
