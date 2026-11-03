export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { adminAttendee, reissueTag } from "@/lib/server/services/attendees.mjs"

export const POST = route(async (_request, { eventId, attendeeId }) => {
  const { db, audit } = await adminContext(eventId)
  return json({ attendee: adminAttendee(await reissueTag(db, attendeeId, audit)) })
})
