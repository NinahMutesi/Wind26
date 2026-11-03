export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { requireAdmin } from "@/lib/server/auth.mjs"
import { listEvents } from "@/lib/server/services/events.mjs"

export const GET = route(async () => {
  await requireAdmin()
  return json({ events: await listEvents() })
})
