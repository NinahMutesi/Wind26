export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { scannerContext } from "@/lib/server/context.mjs"
import { scannerCheckin } from "@/lib/server/services/checkins.mjs"

// Body: { code } from a QR scan, or { attendeeId, reason, note } from the desk search.
export const POST = route(async (request) => {
  const { operator, event, db } = await scannerContext()
  return json(await scannerCheckin(db, event, operator, await readJson(request)))
})
