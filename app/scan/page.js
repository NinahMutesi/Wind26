import { redirect } from "next/navigation"
import { currentStaff } from "@/lib/server/auth.mjs"
import ScannerApp from "@/components/scan/ScannerApp"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scanner · NREP Events" }

export default async function ScanPage() {
  const staff = await currentStaff()
  if (!staff) redirect("/login")
  if (staff.role !== "scanner") redirect("/admin")
  return <ScannerApp />
}
