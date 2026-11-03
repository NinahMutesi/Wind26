export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route } from "@/lib/server/http.mjs"
import { adminContext, fileResponse } from "@/lib/server/context.mjs"
import { COLLECTIONS } from "@/lib/server/db/index.mjs"
import { attendanceCsv } from "@/lib/shared/attendance.mjs"

export const GET = route(async (_request, { eventId }) => {
  const { db, event, audit } = await adminContext(eventId)
  const [attendees, checkins] = await Promise.all([db.listAll(COLLECTIONS.attendees), db.listAll(COLLECTIONS.checkins)])
  attendees.sort((a, b) => a.fullName.localeCompare(b.fullName))
  await audit({ action: "attendance.export", details: { rows: attendees.length } })
  return fileResponse("\uFEFF" + attendanceCsv(event, attendees, checkins), { type: "text/csv; charset=utf-8", filename: `${event.code}-attendance.csv` })
})
