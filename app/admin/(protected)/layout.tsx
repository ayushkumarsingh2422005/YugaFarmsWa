import { redirect } from "next/navigation";
import { requireAdminFromCookies } from "@/lib/auth/admin";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";

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
    <div className="wa-shell">
      <header className="wa-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="font-brand text-xl text-[#f5d26a] leading-none">
                YugaFarms
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/75">
                WhatsApp Console
              </p>
            </div>
            <AdminNav />
          </div>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="wa-main">{children}</main>
    </div>
  );
}
