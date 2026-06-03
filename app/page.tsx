export default function Home() {
  return (
    <main className="wa-main min-h-screen">
      <div className="wa-card max-w-2xl overflow-hidden">
        <div className="wa-card-header">
          <p className="font-brand text-2xl text-[#4b2e19]">YugaFarms</p>
          <h1 className="wa-page-title mt-1">WhatsApp Service</h1>
          <p className="wa-subtitle mt-2">
            Messaging for orders, delivery follow-ups, cart sync, and the admin
            chat console.
          </p>
        </div>
        <ul className="space-y-3 p-6 text-sm text-[#4b2e19]">
          <li>
            <a href="/admin/inbox" className="font-semibold underline hover:text-[#2f4f2f]">
              Open WhatsApp Inbox →
            </a>
          </li>
          <li>
            <a href="/api/health" className="underline hover:text-[#2f4f2f]">
              GET /api/health
            </a>
          </li>
          <li>
            Webhook:{" "}
            <code className="rounded bg-[#f5f2ea] px-1.5 py-0.5 text-xs">
              /api/webhooks/whatsapp
            </code>
          </li>
          <li>
            Cron:{" "}
            <code className="rounded bg-[#f5f2ea] px-1.5 py-0.5 text-xs">
              /api/cron/process-messages
            </code>
          </li>
        </ul>
      </div>
    </main>
  );
}
