export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { adminAttendee, createAttendee } from "@/lib/server/services/attendees.mjs"

export const POST = route(async (request, { eventId }) => {
  const { db, audit } = await adminContext(eventId)
  const doc = await createAttendee(db, await readJson(request), audit)
  return json({ attendee: adminAttendee(doc) }, { status: 201 })
})
