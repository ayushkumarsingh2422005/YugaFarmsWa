"use client";

import { useEffect, useState } from "react";

type CampaignRow = {
  id: number;
  name: string;
  status: string;
  total_recipients: number;
  queued_recipients: number;
  sent_recipients: number;
  failed_recipients: number;
  created_at: string;
};

type TargetState = {
  includeExistingUsers: boolean;
  includeCartAbandoners: boolean;
  includeDeliveredOrders: boolean;
  deliveredAfter: string;
  deliveredWeightIn: string;
  manualTagIds: string;
};

const defaultTarget: TargetState = {
  includeExistingUsers: true,
  includeCartAbandoners: false,
  includeDeliveredOrders: false,
  deliveredAfter: "",
  deliveredWeightIn: "",
  manualTagIds: "",
};

export default function CampaignsPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [name, setName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [target, setTarget] = useState<TargetState>(defaultTarget);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<string>("");

  function normalizedTarget() {
    return {
      includeExistingUsers: target.includeExistingUsers,
      includeCartAbandoners: target.includeCartAbandoners,
      includeDeliveredOrders: target.includeDeliveredOrders,
      deliveredAfter: target.deliveredAfter || undefined,
      deliveredWeightIn: target.deliveredWeightIn
        ? target.deliveredWeightIn
            .split(",")
            .map((x) => Number(x.trim()))
            .filter((x) => Number.isFinite(x))
        : [],
      manualTagIds: target.manualTagIds
        ? target.manualTagIds
            .split(",")
            .map((x) => Number(x.trim()))
            .filter((x) => Number.isFinite(x))
        : [],
    };
  }

  async function loadCampaigns() {
    const res = await fetch("/api/admin/campaigns/list");
    const data = (await res.json()) as { rows: CampaignRow[] };
    setRows(data.rows ?? []);
  }

  async function loadDetails(id: number) {
    const res = await fetch(`/api/admin/campaigns/${id}`);
    const data = (await res.json().catch(() => ({}))) as {
      campaign?: CampaignRow;
      recipients?: Array<{ phone: string; status: string; error: string | null }>;
    };
    if (data.recipients) {
      setSelectedDetail(
        data.recipients
          .slice(0, 50)
          .map((r) => `${r.phone} | ${r.status}${r.error ? ` | ${r.error}` : ""}`)
          .join("\n")
      );
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCampaigns();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function preview() {
    const res = await fetch("/api/admin/campaigns/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: normalizedTarget() }),
    });
    const data = (await res.json()) as { total?: number };
    setPreviewCount(data.total ?? 0);
  }

  async function createCampaign() {
    setFeedback("");
    const res = await fetch("/api/admin/campaigns/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        messageBody,
        sendMode: "freeform_anytime",
        target: normalizedTarget(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { campaign?: { id: number }; error?: string };
    if (!res.ok) {
      setFeedback(data.error ?? "Failed to create campaign");
      return;
    }
    setFeedback("Campaign created");
    setName("");
    setMessageBody("");
    setTarget(defaultTarget);
    setPreviewCount(null);
    await loadCampaigns();
    if (data.campaign?.id) {
      setSelectedId(data.campaign.id);
      await loadDetails(data.campaign.id);
    }
  }

  async function start(id: number) {
    const res = await fetch("/api/admin/campaigns/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setFeedback(data.error ?? "Failed to start campaign");
      return;
    }
    await loadCampaigns();
    await loadDetails(id);
  }

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Campaign Builder</h2>
        <p className="text-sm text-neutral-600">
          Free-form campaign sends may fail by WhatsApp policy; errors are retained per recipient.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={target.manualTagIds}
            onChange={(e) => setTarget((t) => ({ ...t, manualTagIds: e.target.value }))}
            placeholder="Manual tag IDs (comma separated)"
            className="rounded border px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={target.includeExistingUsers}
              onChange={(e) =>
                setTarget((t) => ({ ...t, includeExistingUsers: e.target.checked }))
              }
            />
            Existing users
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={target.includeCartAbandoners}
              onChange={(e) =>
                setTarget((t) => ({ ...t, includeCartAbandoners: e.target.checked }))
              }
            />
            Cart abandoners
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={target.includeDeliveredOrders}
              onChange={(e) =>
                setTarget((t) => ({ ...t, includeDeliveredOrders: e.target.checked }))
              }
            />
            Delivered orders
          </label>
          <input
            type="date"
            value={target.deliveredAfter}
            onChange={(e) => setTarget((t) => ({ ...t, deliveredAfter: e.target.value }))}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={target.deliveredWeightIn}
            onChange={(e) => setTarget((t) => ({ ...t, deliveredWeightIn: e.target.value }))}
            placeholder="Delivered weights (e.g. 500,1000)"
            className="rounded border px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        <textarea
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          rows={4}
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          placeholder="Campaign message body..."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void preview()} className="rounded border px-3 py-2 text-sm">
            Preview Audience
          </button>
          <button
            onClick={() => void createCampaign()}
            className="rounded bg-black px-3 py-2 text-sm text-white"
          >
            Create Campaign
          </button>
        </div>
        {previewCount != null ? (
          <p className="mt-2 text-sm text-neutral-700">Preview recipients: {previewCount}</p>
        ) : null}
        {feedback ? <p className="mt-1 text-sm text-neutral-700">{feedback}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Recipients</th>
                <th className="px-3 py-2">Sent/Fail</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.total_recipients}</td>
                  <td className="px-3 py-2">
                    {row.sent_recipients}/{row.failed_recipients}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedId(row.id);
                          void loadDetails(row.id);
                        }}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() => void start(row.id)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Start
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                    No campaigns yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <aside className="rounded border bg-white p-3">
          <h3 className="font-semibold">
            Campaign Details {selectedId ? `#${selectedId}` : ""}
          </h3>
          <pre className="mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap text-xs text-neutral-700">
            {selectedDetail || "Select a campaign to inspect recipients and statuses."}
          </pre>
        </aside>
      </div>
    </section>
  );
}
