"use client";

import { useEffect, useState } from "react";

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
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setTagFeedback(data.error ?? "Failed to save tag");
      return;
    }
    setTagFeedback("Tag saved");
    setTagName("");
    setTagPhone("");
    await load();
  }

  if (!data) {
    return <p className="text-sm text-neutral-600">Loading settings...</p>;
  }

  const h = data.health;

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">System Health</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <HealthItem label="WA DB" ok={h.waDb} />
          <HealthItem label="Strapi DB" ok={h.strapiDb} />
          <HealthItem label="WhatsApp API Config" ok={h.whatsappConfigured} />
          <HealthItem label="Cron Secret Configured" ok={h.cronSecretConfigured} />
          <HealthItem label="Internal Secret Configured" ok={h.internalSecretConfigured} />
          <HealthItem label="Webhook Verify Token Configured" ok={h.webhookVerifyTokenConfigured} />
          <HealthItem label="Webhook App Secret Configured" ok={h.webhookAppSecretConfigured} />
        </div>
        <div className="mt-4 space-y-1 text-sm text-neutral-700">
          <p>Last cron started: {h.cronLastStartedAt ?? "Not recorded"}</p>
          <p>Last cron finished: {h.cronLastFinishedAt ?? "Not recorded"}</p>
          <p className="break-all">Last cron result: {h.cronLastResult ?? "Not recorded"}</p>
          <p>Manual tags: {h.manualTagCount}</p>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold">Manual Tags</h3>
        <p className="text-sm text-neutral-600">
          Create/update tags and assign to a phone for campaign segmentation.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Tag name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={tagPhone}
            onChange={(e) => setTagPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <button onClick={() => void saveTag()} className="mt-3 rounded border px-3 py-2 text-sm">
          Save Tag
        </button>
        {tagFeedback ? <p className="mt-2 text-sm text-neutral-700">{tagFeedback}</p> : null}
      </div>
    </section>
  );
}

function HealthItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <p>
      {label}:{" "}
      <span className={ok ? "font-medium text-green-700" : "font-medium text-red-700"}>
        {ok ? "OK" : "Not configured"}
      </span>
    </p>
  );
}
