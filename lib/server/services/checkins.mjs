import "server-only"
import crypto from "node:crypto"
import { COLLECTIONS, Query } from "../db/index.mjs"
import { AppError, badRequest, notFound, tooMany } from "../errors.mjs"
import { backfillDay, checkinWindow } from "../../shared/event-days.mjs"
import { extractTagId } from "../../shared/ids.mjs"
import { cleanText, validateManualReason } from "../../shared/validation.mjs"

const MANUAL_LIMIT = 20
const MANUAL_WINDOW_MS = 10 * 60 * 1000

// One check-in per attendee per event day. The document ID is derived from
// (event, attendee, date), so two scanners racing on the same person produce
// one record: the second create fails with 409 and is reported as a duplicate.
export function checkinDocId(eventId, attendeeId, date) {
  return crypto.createHash("sha256").update(`${eventId}:${attendeeId}:${date}`).digest("hex").slice(0, 32)
}

function attendeeSummary(a) {
  return { id: a.$id, fullName: a.fullName, organization: a.organization || "" }
}

async function writeCheckin(db, { attendee, day, date, source, operator, reason = "", note = "" }) {
  const id = checkinDocId(db.eventId, attendee.$id, date)
  try {
    const doc = await db.create(COLLECTIONS.checkins, id, {
      attendeeId: attendee.$id, day, date, source, operatorId: operator.id, reason, note, checkedInAt: new Date().toISOString(),
    })
    return { status: "accepted", attendee: attendeeSummary(attendee), day, date, checkedInAt: doc.checkedInAt }
  } catch (error) {
    if (error?.status !== 409) throw error
    const existing = await db.get(COLLECTIONS.checkins, id)
    return { status: "duplicate", attendee: attendeeSummary(attendee), day, date, checkedInAt: existing?.checkedInAt || null }
  }
}

// Scanner check-in: from a QR code (camera or keyboard scanner) or a desk search.
// The event always comes from the scanner's account, never from the tag.
export async function scannerCheckin(db, event, operator, input) {
  const window = checkinWindow(event)
  if (!window.ok) throw new AppError(409, window.code, window.message)

  if (input?.code !== undefined) {
    const tagId = extractTagId(input.code)
    if (!tagId) throw badRequest("This isn't an event tag QR code.", "invalid_code")
    const attendee = await db.findOne(COLLECTIONS.attendees, [Query.equal("tagId", tagId)])
    if (!attendee) {
      throw notFound(`This tag isn't registered for ${event.shortName || event.name}. It may belong to another event or have been replaced.`)
    }
    return writeCheckin(db, { attendee, ...window, source: "qr", operator })
  }

  const reason = validateManualReason(input?.reason, input?.note)
  if (!reason.ok) throw badRequest(reason.message, "reason_required")
  const since = new Date(Date.now() - MANUAL_WINDOW_MS).toISOString()
  const recentManual = await db.count(COLLECTIONS.checkins, [
    Query.equal("operatorId", operator.id), Query.equal("source", "manual"), Query.greaterThan("checkedInAt", since),
  ])
  if (recentManual >= MANUAL_LIMIT) throw tooMany("Too many manual check-ins in a short time. Ask an admin to review.")
  const attendee = await db.get(COLLECTIONS.attendees, cleanText(input?.attendeeId, 36))
  if (!attendee) throw notFound("Attendee not found for this event.")
  return writeCheckin(db, { attendee, ...window, source: "manual", operator, reason: reason.reason, note: reason.note })
}

// Admin correction for a past or current day, e.g. from the paper backup list.
export async function adminCheckin(db, event, admin, input, audit) {
  const target = backfillDay(event, input?.day)
  if (!target.ok) throw badRequest(target.message)
  const reason = validateManualReason(input?.reason, input?.note)
  if (!reason.ok) throw badRequest(reason.message, "reason_required")
  const attendee = await db.get(COLLECTIONS.attendees, cleanText(input?.attendeeId, 36))
  if (!attendee) throw notFound("Attendee not found for this event.")
  const result = await writeCheckin(db, { attendee, day: target.day, date: target.date, source: "admin", operator: admin, reason: reason.reason, note: reason.note })
  if (result.status === "accepted") {
    await audit({ action: "checkin.admin_add", targetId: attendee.$id, details: { day: target.day, reason: reason.reason, note: reason.note } })
  }
  return result
}

export async function removeCheckin(db, attendeeId, day, reasonInput, audit) {
  const note = cleanText(reasonInput, 200)
  if (note.length < 3) throw badRequest("Say why this check-in is being removed.", "reason_required")
  const existing = await db.findOne(COLLECTIONS.checkins, [Query.equal("attendeeId", cleanText(attendeeId, 36)), Query.equal("day", Number(day))])
  if (!existing) throw notFound("No check-in found for that day.")
  await db.remove(COLLECTIONS.checkins, existing.$id)
  await audit({ action: "checkin.remove", targetId: existing.attendeeId, details: { day: existing.day, source: existing.source, reason: note } })
}

export async function scannerSummary(db, event) {
  const window = checkinWindow(event)
  const total = await db.count(COLLECTIONS.attendees)
  const today = window.date ? await db.count(COLLECTIONS.checkins, [Query.equal("date", window.date)]) : 0
  return { window, total, checkedInToday: today }
}
