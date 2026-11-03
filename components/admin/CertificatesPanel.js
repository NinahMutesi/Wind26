"use client"

import { useState } from "react"
import { api } from "@/components/api"
import Dialog, { Notice, inBatches } from "./Dialog"

export default function CertificatesPanel({ event, attendees, reload }) {
  const base = `/api/admin/events/${event.id}`
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState(null)

  const eligibleWithout = attendees.filter((a) => a.eligibility.eligible && !a.certificate)
  const issued = attendees.filter((a) => a.certificate?.status === "issued")
  const unsent = issued.filter((a) => a.email && !a.certificate.emailedAt)
  const canIssue = ["live", "closed"].includes(event.status)

  async function batch(label, items, size, call, summarise) {
    setBusy(true)
    setMessage({ tone: "info", text: `${label} 0 of ${items.length}…` })
    try {
      const results = await inBatches(items, size, call, (done, total) => setMessage({ tone: "info", text: `${label} ${done} of ${total}…` }))
      setMessage(summarise(results))
      await reload()
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const issue = (list) => batch("Issuing", list.map((a) => a.id), 20,
    (ids) => api(`${base}/certificates`, { method: "POST", body: { attendeeIds: ids } }).then((r) => r.results),
    (results) => {
      const n = results.filter((r) => r.status === "issued").length
      const skipped = results.length - n
      return { tone: "ok", text: `Issued ${n} certificate${n === 1 ? "" : "s"}.${skipped ? ` ${skipped} skipped (already issued or not eligible).` : ""}` }
    })

  const email = (list, resend = false) => batch("Emailing", list.map((a) => a.certificate.id), 10,
    (ids) => api(`${base}/certificates/email`, { method: "POST", body: { certificateIds: ids, resend } }).then((r) => r.results),
    (results) => {
      const sent = results.filter((r) => r.status === "sent").length
      const failed = results.filter((r) => r.status === "failed").length
      return { tone: failed ? "warn" : "ok", text: `Emailed ${sent} certificate${sent === 1 ? "" : "s"}.${failed ? ` ${failed} failed; try again.` : ""}` }
    })

  async function act(attendee, action, reason = "") {
    setBusy(true)
    setMessage(null)
    try {
      await api(`${base}/certificates/${attendee.certificate.id}`, { method: "POST", body: { action, reason } })
      setMessage({ tone: "ok", text: { revoke: "Certificate revoked. Its verification page now says so.", restore: "Certificate restored.", refresh_name: "Name on the certificate updated." }[action] })
      setRevoking(null)
      await reload()
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stack">
      <div className="card stack" style={{ gap: 10 }}>
        <h2>Who qualifies</h2>
        <p>
          Attendees need at least <strong>{event.certificateMinDays} of {event.days.length} days</strong> checked in.
          To change this rule, update <code>certificateMinDays</code> for the event (see the README).
        </p>
        {!canIssue && <p className="notice warn">Certificates can be issued once the event is live.</p>}
        <div className="row">
          <button className="accent" disabled={busy || !canIssue || !eligibleWithout.length} onClick={() => issue(eligibleWithout)}>
            Issue {eligibleWithout.length} certificate{eligibleWithout.length === 1 ? "" : "s"} to everyone eligible
          </button>
          <button disabled={busy || !unsent.length} onClick={() => email(unsent)}>Email {unsent.length} unsent</button>
        </div>
      </div>

      <Notice message={message} />

      <div className="table-wrap">
        <table>
          <thead><tr><th>Attendee</th><th>Days</th><th>Certificate</th><th /></tr></thead>
          <tbody>
            {attendees.map((a) => {
              const c = a.certificate
              const nameChanged = c && c.nameOnCertificate !== a.fullName
              return (
                <tr key={a.id}>
                  <td><strong>{a.fullName}</strong><div className="muted small">{a.organization}</div></td>
                  <td className="num">
                    {a.eligibility.daysAttended} / {a.eligibility.totalDays}{" "}
                    {a.eligibility.eligible ? <span className="pill ok">Eligible</span> : <span className="pill neutral">Not yet</span>}
                  </td>
                  <td className="small">
                    {!c && <span className="muted">Not issued</span>}
                    {c?.status === "issued" && <><span className="pill ok">Issued</span> {c.emailedAt ? <span className="pill ok">Emailed</span> : <span className="pill neutral">Not emailed</span>}</>}
                    {c?.status === "revoked" && <span className="pill bad" title={c.revokedReason}>Revoked</span>}
                    {nameChanged && <div className="field-error">Shows &ldquo;{c.nameOnCertificate}&rdquo;</div>}
                  </td>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>
                    {!c && a.eligibility.eligible && canIssue && <button className="link" disabled={busy} onClick={() => issue([a])}>Issue</button>}
                    {c && (
                      <>
                        <a href={`/verify/${c.id}`} target="_blank" rel="noreferrer">View</a>{" "}
                        <a href={`${base}/certificates/${c.id}/pdf`}>PDF</a>
                        {c.status === "issued" && a.email && <button className="link" disabled={busy} onClick={() => email([a], true)}>{c.emailedAt ? "Resend" : "Email"}</button>}
                        {nameChanged && <button className="link" disabled={busy} onClick={() => act(a, "refresh_name")}>Use current name</button>}
                        {c.status === "issued"
                          ? <button className="link" disabled={busy} onClick={() => setRevoking(a)}>Revoke</button>
                          : <button className="link" disabled={busy} onClick={() => act(a, "restore")}>Restore</button>}
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(revoking)} title="Revoke certificate?" onClose={() => setRevoking(null)}>
        {revoking && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); act(revoking, "revoke", new FormData(e.currentTarget).get("reason")) }}>
            <p>Anyone who opens {revoking.fullName}&apos;s certificate link will see that it has been revoked.</p>
            <label htmlFor="revoke-reason">Reason<input id="revoke-reason" name="reason" required minLength={3} maxLength={200} /></label>
            <div className="row"><button className="danger" type="submit" disabled={busy}>Revoke certificate</button></div>
          </form>
        )}
      </Dialog>
    </section>
  )
}
