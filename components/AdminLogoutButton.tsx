"use client";

export function AdminLogoutButton() {
  async function onLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button type="button" onClick={onLogout} className="wa-btn-ghost">
      Logout
    </button>
  );
}
