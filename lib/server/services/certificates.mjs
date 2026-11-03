import "server-only"
import { COLLECTIONS, Query } from "../db/index.mjs"
import { badRequest, conflict, notFound } from "../errors.mjs"
import { certificateEligibility, daysByAttendee } from "../../shared/attendance.mjs"
import { newUuid } from "../../shared/ids.mjs"
import { cleanText } from "../../shared/validation.mjs"

export function adminCertificate(c) {
  return {
    id: c.$id, attendeeId: c.attendeeId, nameOnCertificate: c.nameOnCertificate, daysAttended: c.daysAttended,
    status: c.status, issuedAt: c.issuedAt, emailedAt: c.emailedAt || null, revokedReason: c.revokedReason || "",
  }
}

// Issues certificates to the given attendees if they meet the event's attendance rule.
// The certificate ID is a new UUID v4, separate from the tag's, and is the document ID.
export async function issueCertificates(db, event, admin, attendeeIds, audit) {
  if (!["live", "closed"].includes(event.status)) throw badRequest("Certificates can be issued only while the event is live or closed.")
  const ids = [...new Set((attendeeIds || []).map((id) => cleanText(id, 36)))].slice(0, 100)
  if (!ids.length) throw badRequest("Choose at least one attendee.")
  const results = []
  for (const attendeeId of ids) {
    const attendee = await db.get(COLLECTIONS.attendees, attendeeId)
    if (!attendee) { results.push({ attendeeId, status: "not_found" }); continue }
    const existing = await db.findOne(COLLECTIONS.certificates, [Query.equal("attendeeId", attendeeId)])
    if (existing) { results.push({ attendeeId, status: "already_issued", certificateId: existing.$id }); continue }
    const checkins = await db.listAll(COLLECTIONS.checkins, [Query.equal("attendeeId", attendeeId)])
    const eligibility = certificateEligibility(event, daysByAttendee(checkins).get(attendeeId))
    if (!eligibility.eligible) { results.push({ attendeeId, status: "not_eligible", ...eligibility }); continue }
    try {
      const doc = await db.create(COLLECTIONS.certificates, newUuid(), {
        attendeeId, nameOnCertificate: attendee.fullName, daysAttended: eligibility.daysAttended,
        status: "issued", issuedAt: new Date().toISOString(), issuedBy: admin.id,
      })
      await audit({ action: "certificate.issue", targetId: doc.$id, details: { attendeeId, name: attendee.fullName } })
      results.push({ attendeeId, status: "issued", certificateId: doc.$id })
    } catch (error) {
      if (error?.status !== 409) throw error
      results.push({ attendeeId, status: "already_issued" })
    }
  }
  return results
}

export async function setCertificateStatus(db, certificateId, action, reasonInput, audit) {
  const cert = await db.get(COLLECTIONS.certificates, certificateId)
  if (!cert) throw notFound("Certificate not found.")
  const reason = cleanText(reasonInput, 200)
  if (action === "revoke") {
    if (cert.status === "revoked") throw conflict("This certificate is already revoked.")
    if (reason.length < 3) throw badRequest("Say why the certificate is being revoked.", "reason_required")
    await db.update(COLLECTIONS.certificates, certificateId, { status: "revoked", revokedAt: new Date().toISOString(), revokedReason: reason })
  } else if (action === "restore") {
    if (cert.status !== "revoked") throw conflict("This certificate isn't revoked.")
    await db.update(COLLECTIONS.certificates, certificateId, { status: "issued", revokedAt: null, revokedReason: null })
  } else if (action === "refresh_name") {
    const attendee = await db.get(COLLECTIONS.attendees, cert.attendeeId)
    if (!attendee) throw notFound("Attendee not found.")
    await db.update(COLLECTIONS.certificates, certificateId, { nameOnCertificate: attendee.fullName })
  } else {
    throw badRequest("Unknown certificate action.")
  }
  await audit({ action: `certificate.${action}`, targetId: certificateId, details: { reason } })
}
