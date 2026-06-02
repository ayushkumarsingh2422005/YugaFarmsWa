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
  const [sending, setSending] = useState(false);

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
    if (!selectedPhone || !draft.trim()) return;
    setSending(true);
    setSendError("");
    const res = await fetch("/api/admin/send/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: selectedPhone, message: draft.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; warning?: string };
    if (!res.ok) {
      setSendError(data.error ?? "Send failed");
      setSending(false);
      return;
    }
    setDraft("");
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
            Free-form sends may fail outside WhatsApp policy windows.
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
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Type a manual WhatsApp message..."
          />
          {sendError ? <p className="mt-2 text-sm text-red-600">{sendError}</p> : null}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={sending || !selectedPhone || !draft.trim()}
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
