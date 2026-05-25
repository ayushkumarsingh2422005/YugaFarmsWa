export default function Home() {
  return (
    <main className="min-h-screen bg-[#fdfbf7] p-8 md:p-12 font-sans">
      <h1 className="text-2xl font-bold text-[#4b2e19]">Yuga Farms WhatsApp</h1>
      <p className="mt-2 text-[#2D2D2D]/70 max-w-xl">
        Messaging service for orders, delivery follow-ups, and cart sync. Configure{" "}
        <code className="text-sm bg-[#f5f2ea] px-1 rounded">.env.local</code> from{" "}
        <code className="text-sm bg-[#f5f2ea] px-1 rounded">.env.example</code>.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-[#4b2e19]">
        <li>
          <a href="/api/health" className="underline hover:text-[#2f4f2f]">
            GET /api/health
          </a>
        </li>
        <li>
          Webhook: <code className="bg-[#f5f2ea] px-1 rounded">/api/webhooks/whatsapp</code>
        </li>
        <li>
          Cron: <code className="bg-[#f5f2ea] px-1 rounded">/api/cron/process-messages</code>
        </li>
      </ul>
    </main>
  );
}
