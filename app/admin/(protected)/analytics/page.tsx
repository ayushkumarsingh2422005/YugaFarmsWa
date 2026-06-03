"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
    return <p className="wa-subtitle">Loading analytics...</p>;
  }

  const maxOutbound = Math.max(
    1,
    ...data.summary.outboundSeries.map((p) => p.total)
  );

  return (
    <section className="space-y-4">
      <div className="wa-card overflow-hidden">
        <AdminPageHeader
          title="Analytics"
          description="WhatsApp delivery volume and campaign performance."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Outbound Sent" value={data.summary.sent} />
        <StatCard title="Outbound Failed" value={data.summary.failed} />
        <StatCard title="Pending Queue" value={data.summary.pending} />
        <StatCard title="Inbound Events" value={data.summary.inbound} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="wa-card p-5">
          <h3 className="wa-title">Outbound Volume (30 days)</h3>
          <div className="mt-4 space-y-3">
            {data.summary.outboundSeries.map((point) => (
              <div key={point.day} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-[#2D2D2D]/65">{point.day}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef2e9]">
                  <div
                    className="wa-bar h-full"
                    style={{ width: `${(point.total / maxOutbound) * 100}%` }}
                  />
                </div>
                <span className="w-8 font-bold text-[#4b2e19]">{point.total}</span>
              </div>
            ))}
            {data.summary.outboundSeries.length === 0 ? (
              <p className="wa-subtitle">No outbound events yet.</p>
            ) : null}
          </div>
        </div>

        <div className="wa-card p-5">
          <h3 className="wa-title">Campaign Stats</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between border-b border-[#4b2e19]/10 pb-2">
              <span className="text-[#2D2D2D]/70">Total campaigns</span>
              <span className="font-bold text-[#4b2e19]">{data.campaignStats.total}</span>
            </li>
            <li className="flex justify-between border-b border-[#4b2e19]/10 pb-2">
              <span className="text-[#2D2D2D]/70">Running / scheduled</span>
              <span className="font-bold text-[#4b2e19]">{data.campaignStats.running}</span>
            </li>
            <li className="flex justify-between border-b border-[#4b2e19]/10 pb-2">
              <span className="text-[#2D2D2D]/70">Completed</span>
              <span className="font-bold text-[#4b2e19]">{data.campaignStats.completed}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#2D2D2D]/70">Failed</span>
              <span className="font-bold text-[#4b2e19]">{data.campaignStats.failed}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="wa-stat-card">
      <p>{title}</p>
      <p>{value}</p>
    </div>
  );
}
