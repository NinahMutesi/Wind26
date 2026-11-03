export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route } from "@/lib/server/http.mjs"
import { adminContext, fileResponse } from "@/lib/server/context.mjs"
import { COLLECTIONS } from "@/lib/server/db/index.mjs"
import { badRequest } from "@/lib/server/errors.mjs"
import { tagsPdf } from "@/lib/server/services/documents.mjs"

// Print sheet: four A6 tags per A4 page. ?ids=a,b,c limits it to some attendees.
export const GET = route(async (request, { eventId }) => {
  const { db, event } = await adminContext(eventId)
  const ids = new Set((new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean))
  let attendees = (await db.listAll(COLLECTIONS.attendees)).sort((a, b) => a.fullName.localeCompare(b.fullName))
  if (ids.size) attendees = attendees.filter((a) => ids.has(a.$id))
  if (!attendees.length) throw badRequest("There are no tags to print.")
  if (attendees.length > 400) throw badRequest("Print at most 400 tags at a time.")
  return fileResponse(await tagsPdf(event, attendees), { type: "application/pdf", filename: `${event.code}-tags.pdf` })
})
