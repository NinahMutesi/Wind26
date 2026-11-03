export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { COLLECTIONS } from "@/lib/server/db/index.mjs"
import { changeEventStatus, publicEvent } from "@/lib/server/services/events.mjs"
import { adminAttendee } from "@/lib/server/services/attendees.mjs"
import { adminCertificate } from "@/lib/server/services/certificates.mjs"
import { certificateEligibility, daysByAttendee } from "@/lib/shared/attendance.mjs"

// Everything the admin page needs in one call. Fine for events of a few hundred people.
export const GET = route(async (_request, { eventId }) => {
  const { event, db } = await adminContext(eventId)
  const [attendees, checkins, certificates] = await Promise.all([
    db.listAll(COLLECTIONS.attendees),
    db.listAll(COLLECTIONS.checkins),
    db.listAll(COLLECTIONS.certificates),
  ])
  const days = daysByAttendee(checkins)
  const certByAttendee = new Map(certificates.map((c) => [c.attendeeId, adminCertificate(c)]))
  const rows = attendees
    .map((a) => {
      const attended = days.get(a.$id) || new Set()
      return {
        ...adminAttendee(a),
        days: [...attended].sort(),
        checkins: checkins.filter((c) => c.attendeeId === a.$id).map((c) => ({ day: c.day, source: c.source, reason: c.reason || "", at: c.checkedInAt })),
        eligibility: certificateEligibility(event, attended),
        certificate: certByAttendee.get(a.$id) || null,
      }
    })
    .sort((x, y) => x.fullName.localeCompare(y.fullName))
  return json({ event: publicEvent(event), attendees: rows })
})

export const PATCH = route(async (request, { eventId }) => {
  const { event, audit } = await adminContext(eventId)
  const body = await readJson(request)
  if (body.confirmCode !== event.code) {
    return json({ error: { code: "confirmation_required", message: `Type the event code ${event.code} to confirm.` } }, { status: 400 })
  }
  const updated = await changeEventStatus(event, String(body.status || ""), audit)
  return json({ event: publicEvent(updated) })
})
