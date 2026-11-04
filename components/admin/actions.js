"use client"

import { api } from "@/components/api"
import { inBatches, plural } from "./Dialog"

// Bulk jobs shared by several pages. The server skips anything already done,
// so running one twice, or after an interruption, never sends twice.

export async function emailBadges(eventId, attendeeIds, { resend = false, progress } = {}) {
  const results = await inBatches(attendeeIds, 10,
    (ids) => api(`/api/admin/events/${eventId}/tags/email`, { method: "POST", body: { attendeeIds: ids, resend } }).then((r) => r.results),
    (done, total) => progress?.(`Emailing badges… ${done} of ${total}`))
  return summarise(results, "badge")
}

export async function issueCertificates(eventId, attendeeIds, progress) {
  const results = await inBatches(attendeeIds, 20,
    (ids) => api(`/api/admin/events/${eventId}/certificates`, { method: "POST", body: { attendeeIds: ids } }).then((r) => r.results),
    (done, total) => progress?.(`Issuing certificates… ${done} of ${total}`))
  return results
}

export async function emailCertificates(eventId, certificateIds, { resend = false, progress } = {}) {
  const results = await inBatches(certificateIds, 10,
    (ids) => api(`/api/admin/events/${eventId}/certificates/email`, { method: "POST", body: { certificateIds: ids, resend } }).then((r) => r.results),
    (done, total) => progress?.(`Emailing certificates… ${done} of ${total}`))
  return summarise(results, "certificate")
}

function summarise(results, noun) {
  const sent = results.filter((r) => r.status === "sent").length
  const failed = results.filter((r) => r.status === "failed").length
  const noEmail = results.filter((r) => r.status === "no_email").length
  const parts = [`Sent ${plural(sent, noun)}.`]
  if (noEmail) parts.push(`${noEmail} without an email address.`)
  if (failed) parts.push(`${failed} failed. Run it again to retry them.`)
  return { tone: failed ? "warn" : "ok", text: parts.join(" "), sent, failed }
}

export const badgePdfUrl = (eventId, { layout = "a4", ids = [] } = {}) =>
  `/api/admin/events/${eventId}/tags/pdf?layout=${layout}${ids.length ? `&ids=${ids.join(",")}` : ""}`
