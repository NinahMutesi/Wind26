export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { importAttendees } from "@/lib/server/services/attendees.mjs"

// Send { csv, commit: false } to preview, then { csv, commit: true } to import.
export const POST = route(async (request, { eventId }) => {
  const { db, audit } = await adminContext(eventId)
  const body = await readJson(request)
  return json(await importAttendees(db, String(body.csv || ""), { commit: body.commit === true }, audit))
})
