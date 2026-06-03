"use client";

import { useEffect, useMemo, useState } from "react";

type Conversation = {
  phone: string;
  last_at: string | null;
  last_direction: "inbound" | "outbound";
  last_preview: string | null;
  outbound_count: number;
  inbound_count: number;
  has_activity?: boolean;
};

type ThreadEvent = {
  id: number;
  phone: string;
  direction: "inbound" | "outbound";
  message_type: string | null;
  body: string | null;
  payload: string | null;
  created_at: string;
};

function formatInboundPayload(evt: ThreadEvent): string {
  if (!evt.payload) return "(empty event)";
  try {
    const parsed = JSON.parse(evt.payload) as {
      text?: { body?: string };
      status?: string;
      type?: string;
      from?: string;
    };

    if (parsed.text?.body) return parsed.text.body;
    if (parsed.status) return `Status update: ${parsed.status}`;
    if (parsed.type && parsed.from) {
      return `Incoming ${parsed.type} from ${parsed.from}`;
    }
    return "Webhook event received";
  } catch {
    return evt.payload.slice(0, 200);
  }
}

function renderThreadBody(evt: ThreadEvent): string {
  if (evt.direction === "outbound") {
    return evt.body ?? "(empty outbound message)";
  }
  return formatInboundPayload(evt);
}

export default function InboxPage() {
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [thread, setThread] = useState<ThreadEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendInfo, setSendInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<"text" | "template">("text");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en");
  const [templateParams, setTemplateParams] = useState("");
  const [fallbackTemplateName, setFallbackTemplateName] = useState("");
  const [fallbackTemplateLanguage, setFallbackTemplateLanguage] = useState("en");
  const [fallbackTemplateParams, setFallbackTemplateParams] = useState("");

  async function loadConversations() {
    const res = await fetch(
      `/api/admin/inbox/conversations?search=${encodeURIComponent(search)}`
    );
    const data = (await res.json()) as { rows: Conversation[] };
    setConversations(data.rows ?? []);
    if (!selectedPhone && data.rows?.[0]?.phone) {
      setSelectedPhone(data.rows[0].phone);
    }
  }

  async function loadThread(phone: string) {
    if (!phone) return;
    const res = await fetch(`/api/admin/inbox/thread?phone=${encodeURIComponent(phone)}`);
    const data = (await res.json()) as { rows: ThreadEvent[] };
    setThread(data.rows ?? []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversations();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadThread(selectedPhone);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedPhone]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.phone === selectedPhone),
    [conversations, selectedPhone]
  );

  async function onSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPhone) return;
    if (sendMode === "text" && !draft.trim()) return;
    if (sendMode === "template" && !templateName.trim()) return;
    setSending(true);
    setSendError("");
    setSendInfo("");
    const res = await fetch("/api/admin/send/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: selectedPhone,
        mode: sendMode,
        message: draft.trim(),
        templateName: templateName.trim() || undefined,
        templateLanguage: templateLanguage.trim() || "en",
        templateParams: templateParams
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        fallbackTemplateName: fallbackTemplateName.trim() || undefined,
        fallbackTemplateLanguage: fallbackTemplateLanguage.trim() || "en",
        fallbackTemplateParams: fallbackTemplateParams
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      fallbackUsed?: boolean;
      usedMode?: "text" | "template";
    };
    if (!res.ok) {
      setSendError(data.error ?? "Send failed");
      setSending(false);
      return;
    }
    setDraft("");
    if (data.fallbackUsed) {
      setSendInfo("Free-form failed; template fallback sent successfully.");
    } else {
      setSendInfo(
        data.usedMode === "template"
          ? "Template message sent successfully."
          : "Text message sent successfully."
      );
    }
    setSending(false);
    await loadThread(selectedPhone);
    await loadConversations();
  }

  return (
    <div className="wa-inbox">
      <aside className="wa-chat-sidebar">
        <div className="wa-chat-sidebar-head">
          <h2 className="wa-title">Conversations</h2>
          <p className="wa-subtitle mt-1">Customer WhatsApp threads</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by phone number..."
            className="wa-input mt-3"
          />
        </div>
        <div className="wa-conversation-list">
          {conversations.map((row) => (
            <button
              key={row.phone}
              type="button"
              onClick={() => setSelectedPhone(row.phone)}
              className={`wa-conversation-item ${
                selectedPhone === row.phone ? "wa-conversation-item--active" : ""
              }`}
            >
              <p className="font-bold text-[#4b2e19]">{row.phone}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[#2D2D2D]/70">
                {row.last_preview ?? "No messages yet — start the chat"}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[#4b2e19]/55">
                In {row.inbound_count} · Out {row.outbound_count}
              </p>
            </button>
          ))}
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-[#2D2D2D]/60">
              No conversations yet.
            </p>
          ) : null}
        </div>
      </aside>

      <section className="wa-chat-main">
        <div className="wa-chat-header">
          <h2>{selectedConversation?.phone ?? "Select a conversation"}</h2>
          <p>
            Reply with free-form text (24h window) or an approved Meta template.
          </p>
        </div>

        <div className="wa-chat-thread">
          {thread.map((evt) => (
            <div
              key={`${evt.direction}-${evt.id}`}
              className={`wa-bubble ${
                evt.direction === "outbound" ? "wa-bubble--out" : "wa-bubble--in"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{renderThreadBody(evt)}</p>
              {evt.message_type ? (
                <p className="wa-bubble-meta">Type: {evt.message_type}</p>
              ) : null}
              <p className="wa-bubble-meta">
                {evt.direction === "outbound" ? "Sent" : "Received"} ·{" "}
                {new Date(evt.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {thread.length === 0 ? (
            <div className="mx-auto max-w-sm rounded-xl border border-dashed border-[#4b2e19]/20 bg-white/80 px-6 py-8 text-center">
              <p className="text-sm font-semibold text-[#4b2e19]">No messages yet</p>
              <p className="mt-1 text-xs text-[#2D2D2D]/65">
                Pick a customer on the left or send the first message below.
              </p>
            </div>
          ) : null}
        </div>

        <form onSubmit={onSend} className="wa-chat-compose">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="wa-radio-pill">
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === "text"}
                onChange={() => setSendMode("text")}
              />
              Text
            </label>
            <label className="wa-radio-pill">
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === "template"}
                onChange={() => setSendMode("template")}
              />
              Template
            </label>
          </div>

          {sendMode === "text" ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="wa-textarea"
                placeholder="Type your WhatsApp reply..."
              />
              <p className="wa-subtitle mt-2 text-xs">
                Optional template fallback if free-form is blocked
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <input
                  value={fallbackTemplateName}
                  onChange={(e) => setFallbackTemplateName(e.target.value)}
                  placeholder="Fallback template name"
                  className="wa-input text-xs"
                />
                <input
                  value={fallbackTemplateLanguage}
                  onChange={(e) => setFallbackTemplateLanguage(e.target.value)}
                  placeholder="Language (en)"
                  className="wa-input text-xs"
                />
                <input
                  value={fallbackTemplateParams}
                  onChange={(e) => setFallbackTemplateParams(e.target.value)}
                  placeholder="Params, comma separated"
                  className="wa-input text-xs"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="wa-input"
              />
              <input
                value={templateLanguage}
                onChange={(e) => setTemplateLanguage(e.target.value)}
                placeholder="Language (en)"
                className="wa-input"
              />
              <input
                value={templateParams}
                onChange={(e) => setTemplateParams(e.target.value)}
                placeholder="Body params, comma separated"
                className="wa-input"
              />
            </div>
          )}

          {sendError ? <p className="wa-alert-error mt-3">{sendError}</p> : null}
          {sendInfo ? <p className="wa-alert-success mt-3">{sendInfo}</p> : null}

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={
                sending ||
                !selectedPhone ||
                (sendMode === "text" ? !draft.trim() : !templateName.trim())
              }
              className="wa-btn-gold min-w-[140px]"
            >
              {sending ? "Sending..." : "Send message"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
