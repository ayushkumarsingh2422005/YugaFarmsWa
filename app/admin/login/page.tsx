"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Login failed");
      }
      window.location.href = "/admin/inbox";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <form onSubmit={onSubmit} className="wa-card w-full overflow-hidden p-0">
        <div className="wa-card-header text-center">
          <p className="font-brand text-3xl text-[#4b2e19]">YugaFarms</p>
          <h1 className="wa-page-title mt-2">WhatsApp Admin</h1>
          <p className="wa-subtitle mt-1">
            Sign in to manage customer chats, campaigns, and automations.
          </p>
        </div>
        <div className="p-6">
          <label className="wa-label" htmlFor="admin-password">
            Dashboard password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="wa-input"
            placeholder="Enter admin password"
            required
          />
          {error ? <p className="wa-alert-error mt-3">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="wa-btn-primary mt-5 w-full py-3"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
