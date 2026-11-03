export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { currentStaff } from "@/lib/server/auth.mjs"

export const GET = route(async () => {
  const staff = await currentStaff()
  return json({ staff: staff ? { name: staff.name, email: staff.email, role: staff.role } : null })
})
