import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminFromCookies } from "@/lib/auth/admin";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

const navItems = [
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/scheduled", label: "Scheduled" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await requireAdminFromCookies();
  if (!authed) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Yuga Farms WA Dashboard</h1>
            <nav className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
    </div>
  );
}
