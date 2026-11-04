import { redirect } from "next/navigation"
import { currentStaff } from "@/lib/server/auth.mjs"
import AdminApp from "@/components/admin/AdminApp"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard · NREP Events" }

export default async function AdminPage() {
  const staff = await currentStaff()
  if (!staff) redirect("/login")
  if (staff.role !== "admin") redirect("/scan")
  return <AdminApp staff={{ name: staff.name, email: staff.email, local: Boolean(staff.local), builtin: Boolean(staff.builtin) }} />
}
