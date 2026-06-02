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
      warning?: string;
      usedMode?: "text" | "template";
      fallbackUsed?: boolean;
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
    <div className="grid min-h-[70vh] grid-cols-[340px_1fr] gap-4">
      <section className="rounded border bg-white p-3">
        <div className="mb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by phone"
            className="w-full rounded border px-2 py-2 text-sm"
          />
        </div>
        <div className="space-y-2 overflow-y-auto">
          {conversations.map((row) => (
            <button
              key={row.phone}
              type="button"
              onClick={() => setSelectedPhone(row.phone)}
              className={`w-full rounded border p-2 text-left text-sm ${
                selectedPhone === row.phone ? "bg-neutral-100" : "bg-white"
              }`}
            >
              <p className="font-medium">{row.phone}</p>
              <p className="text-xs text-neutral-600">
                {row.last_preview ?? "No messages yet. You can start chat now."}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                In:{row.inbound_count} Out:{row.outbound_count}
              </p>
            </button>
          ))}
          {conversations.length === 0 ? (
            <p className="text-sm text-neutral-500">No conversations yet.</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col rounded border bg-white">
        <div className="border-b p-3">
          <h2 className="font-semibold">{selectedConversation?.phone ?? "Select a conversation"}</h2>
          <p className="text-xs text-neutral-600">
            You can send free-form text or approved template messages.
          </p>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {thread.map((evt) => (
            <div
              key={`${evt.direction}-${evt.id}`}
              className={`max-w-[80%] rounded border px-3 py-2 text-sm ${
                evt.direction === "outbound" ? "ml-auto bg-green-50" : "bg-neutral-50"
              }`}
            >
              <p className="text-[11px] uppercase text-neutral-500">{evt.direction}</p>
              <p className="whitespace-pre-wrap break-words">
                {evt.body ?? evt.payload ?? "(empty event)"}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {new Date(evt.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {thread.length === 0 ? (
            <p className="text-sm text-neutral-500">No events for this phone.</p>
          ) : null}
        </div>

        <form onSubmit={onSend} className="border-t p-3">
          <div className="mb-2 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === "text"}
                onChange={() => setSendMode("text")}
              />
              Text
            </label>
            <label className="flex items-center gap-1">
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
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Type a manual WhatsApp message..."
              />
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <input
                  value={fallbackTemplateName}
                  onChange={(e) => setFallbackTemplateName(e.target.value)}
                  placeholder="Fallback template name (optional)"
                  className="rounded border px-2 py-2 text-xs"
                />
                <input
                  value={fallbackTemplateLanguage}
                  onChange={(e) => setFallbackTemplateLanguage(e.target.value)}
                  placeholder="Fallback lang (e.g. en)"
                  className="rounded border px-2 py-2 text-xs"
                />
                <input
                  value={fallbackTemplateParams}
                  onChange={(e) => setFallbackTemplateParams(e.target.value)}
                  placeholder="Fallback params comma separated"
                  className="rounded border px-2 py-2 text-xs"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="rounded border px-2 py-2 text-sm"
              />
              <input
                value={templateLanguage}
                onChange={(e) => setTemplateLanguage(e.target.value)}
                placeholder="Language code (e.g. en)"
                className="rounded border px-2 py-2 text-sm"
              />
              <input
                value={templateParams}
                onChange={(e) => setTemplateParams(e.target.value)}
                placeholder="Body params comma separated"
                className="rounded border px-2 py-2 text-sm"
              />
            </div>
          )}
          {sendError ? <p className="mt-2 text-sm text-red-600">{sendError}</p> : null}
          {sendInfo ? <p className="mt-2 text-sm text-green-700">{sendInfo}</p> : null}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={
                sending ||
                !selectedPhone ||
                (sendMode === "text" ? !draft.trim() : !templateName.trim())
              }
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
