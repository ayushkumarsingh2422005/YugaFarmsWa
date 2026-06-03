"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
      <div className="wa-card overflow-hidden">
        <AdminPageHeader
          title="Campaign Builder"
          description="Free-form campaign sends may fail by WhatsApp policy; errors are retained per recipient."
        />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="wa-input"
          />
          <input
            value={target.manualTagIds}
            onChange={(e) => setTarget((t) => ({ ...t, manualTagIds: e.target.value }))}
            placeholder="Manual tag IDs (comma separated)"
            className="wa-input"
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
            className="wa-input"
          />
          <input
            value={target.deliveredWeightIn}
            onChange={(e) => setTarget((t) => ({ ...t, deliveredWeightIn: e.target.value }))}
            placeholder="Delivered weights (e.g. 500,1000)"
            className="wa-input md:col-span-2"
          />
        </div>
        <textarea
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          rows={4}
          className="wa-textarea mx-4 mb-4"
          placeholder="Campaign message body..."
        />
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <button type="button" onClick={() => void preview()} className="wa-btn-secondary">
            Preview Audience
          </button>
          <button type="button" onClick={() => void createCampaign()} className="wa-btn-primary">
            Create Campaign
          </button>
        </div>
        {previewCount != null ? (
          <p className="wa-subtitle px-4 pb-2">Preview recipients: {previewCount}</p>
        ) : null}
        {feedback ? <p className="wa-subtitle px-4 pb-4">{feedback}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="wa-table-wrap">
          <table className="wa-table">
            <thead>
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
                        type="button"
                        onClick={() => {
                          setSelectedId(row.id);
                          void loadDetails(row.id);
                        }}
                        className="wa-btn-secondary wa-btn-xs"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => void start(row.id)}
                        className="wa-btn-primary wa-btn-xs"
                      >
                        Start
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#2D2D2D]/55">
                    No campaigns yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <aside className="wa-card p-4">
          <h3 className="wa-title">
            Campaign Details {selectedId ? `#${selectedId}` : ""}
          </h3>
          <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-[#f5f2ea] p-3 text-xs text-[#2D2D2D]/80">
            {selectedDetail || "Select a campaign to inspect recipients and statuses."}
          </pre>
        </aside>
      </div>
    </section>
  );
}
