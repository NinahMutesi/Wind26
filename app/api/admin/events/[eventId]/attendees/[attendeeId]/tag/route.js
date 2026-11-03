export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route } from "@/lib/server/http.mjs"
import { adminContext, fileResponse } from "@/lib/server/context.mjs"
import { COLLECTIONS } from "@/lib/server/db/index.mjs"
import { notFound } from "@/lib/server/errors.mjs"
import { fileSafe, tagPng } from "@/lib/server/services/documents.mjs"

export const GET = route(async (_request, { eventId, attendeeId }) => {
  const { db, event } = await adminContext(eventId)
  const attendee = await db.get(COLLECTIONS.attendees, attendeeId)
  if (!attendee) throw notFound("Attendee not found.")
  return fileResponse(tagPng(event, attendee), { type: "image/png", filename: `${fileSafe(attendee.fullName)}-tag.png` })
})
