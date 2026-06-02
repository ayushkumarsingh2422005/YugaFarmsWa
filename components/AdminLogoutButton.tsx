"use client";

export function AdminLogoutButton() {
  async function onLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="rounded border px-3 py-1 text-sm hover:bg-neutral-100"
    >
      Logout
    </button>
  );
}
