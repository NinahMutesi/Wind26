import { redirect } from "next/navigation"
import { env } from "@/lib/server/env.mjs"
import LoginForm from "@/components/LoginForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Sign in · NREP Events" }

export default function LoginPage() {
  if (env().adminOpen) redirect("/admin")
  return <LoginForm mode={env().adminAccess} />
}
