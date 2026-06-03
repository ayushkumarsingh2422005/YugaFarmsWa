"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type SettingsHealth = {
  health: {
    waDb: boolean;
    strapiDb: boolean;
    whatsappConfigured: boolean;
    cronSecretConfigured: boolean;
    internalSecretConfigured: boolean;
    webhookVerifyTokenConfigured: boolean;
    webhookAppSecretConfigured: boolean;
    cronLastStartedAt: string | null;
    cronLastFinishedAt: string | null;
    cronLastResult: string | null;
    manualTagCount: number;
  };
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsHealth | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagPhone, setTagPhone] = useState("");
  const [tagFeedback, setTagFeedback] = useState("");

  async function load() {
    const res = await fetch("/api/admin/settings/health");
    const payload = (await res.json()) as SettingsHealth;
    setData(payload);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function saveTag() {
    setTagFeedback("");
    const res = await fetch("/api/admin/tags/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagName, phone: tagPhone || undefined, action: "add" }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setTagFeedback(err.error ?? "Failed to save tag");
      return;
    }
    setTagFeedback("Tag saved");
    setTagName("");
    setTagPhone("");
    await load();
  }

  if (!data) {
    return <p className="wa-subtitle">Loading settings...</p>;
  }

  const h = data.health;

  return (
    <section className="space-y-4">
      <div className="wa-card overflow-hidden">
        <AdminPageHeader
          title="System Health"
          description="Service connectivity and cron status."
        />
        <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <HealthItem label="WA DB" ok={h.waDb} />
          <HealthItem label="Strapi DB" ok={h.strapiDb} />
          <HealthItem label="WhatsApp API Config" ok={h.whatsappConfigured} />
          <HealthItem label="Cron Secret Configured" ok={h.cronSecretConfigured} />
          <HealthItem label="Internal Secret Configured" ok={h.internalSecretConfigured} />
          <HealthItem label="Webhook Verify Token" ok={h.webhookVerifyTokenConfigured} />
          <HealthItem label="Webhook App Secret" ok={h.webhookAppSecretConfigured} />
        </div>
        <div className="space-y-1 border-t border-[#4b2e19]/10 px-4 py-4 text-sm text-[#2D2D2D]/75">
          <p>Last cron started: {h.cronLastStartedAt ?? "Not recorded"}</p>
          <p>Last cron finished: {h.cronLastFinishedAt ?? "Not recorded"}</p>
          <p className="break-all">Last cron result: {h.cronLastResult ?? "Not recorded"}</p>
          <p>Manual tags: {h.manualTagCount}</p>
        </div>
      </div>

      <div className="wa-card overflow-hidden">
        <AdminPageHeader
          title="Manual Tags"
          description="Create tags and assign phones for campaign segmentation."
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className="wa-label">Tag name</label>
            <input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="Tag name"
              className="wa-input"
            />
          </div>
          <div>
            <label className="wa-label">Phone (optional)</label>
            <input
              value={tagPhone}
              onChange={(e) => setTagPhone(e.target.value)}
              placeholder="Phone number"
              className="wa-input"
            />
          </div>
        </div>
        <div className="px-4 pb-4">
          <button type="button" onClick={() => void saveTag()} className="wa-btn-primary">
            Save Tag
          </button>
          {tagFeedback ? (
            <p className="wa-subtitle mt-3">{tagFeedback}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HealthItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <p className="rounded-lg bg-[#f5f2ea] px-3 py-2">
      {label}:{" "}
      <span className={ok ? "wa-badge-ok" : "wa-badge-bad"}>
        {ok ? "OK" : "Not configured"}
      </span>
    </p>
  );
}
