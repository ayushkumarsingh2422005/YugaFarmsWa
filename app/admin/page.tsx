import { redirect } from "next/navigation";
import { requireAdminFromCookies } from "@/lib/auth/admin";

export default async function AdminIndexPage() {
  const authed = await requireAdminFromCookies();
  if (authed) {
    redirect("/admin/inbox");
  }
  redirect("/admin/login");
}
