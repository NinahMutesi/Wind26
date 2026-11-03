export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { adminAttendee, deleteAttendee, updateAttendee } from "@/lib/server/services/attendees.mjs"

export const PATCH = route(async (request, { eventId, attendeeId }) => {
  const { db, audit } = await adminContext(eventId)
  const doc = await updateAttendee(db, attendeeId, await readJson(request), audit)
  return json({ attendee: adminAttendee(doc) })
})

export const DELETE = route(async (_request, { eventId, attendeeId }) => {
  const { db, audit } = await adminContext(eventId)
  await deleteAttendee(db, attendeeId, audit)
  return json({ ok: true })
})
