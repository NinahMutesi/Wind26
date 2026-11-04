"use client"

import { useState } from "react"
import Dialog, { Toast, plural, useAction } from "./Dialog"
import Icon from "./Icon"
import { badgePdfUrl, emailBadges } from "./actions"

export default function BadgesPanel({ event, attendees, reload, go }) {
  const { busy, message, setMessage, run } = useAction(reload)
  const [confirmResend, setConfirmResend] = useState(false)
  const withEmail = attendees.filter((a) => a.email)
  const unsent = withEmail.filter((a) => !a.tagEmailedAt)
  const noEmail = attendees.filter((a) => !a.email)
  const sample = attendees[0]

  const send = (list, resend) => run((progress) => emailBadges(event.id, list.map((a) => a.id), { resend, progress }), (r) => r)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Badges</h1>
          <p>Every attendee gets a badge with a personal QR code as soon as they are registered.</p>
        </div>
      </div>

      {!attendees.length ? (
        <div className="card empty stack" style={{ alignItems: "center" }}>
          <p>Register attendees first.</p>
          <button onClick={() => go("attendees")}>Go to attendees</button>
        </div>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", alignItems: "start" }}>
          <div className="card stack" style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="badge-preview" src={`/api/admin/events/${event.id}/attendees/${sample.id}/tag`} alt={`Badge preview for ${sample.fullName}`} />
            <p className="muted small">Preview · {sample.fullName}</p>
          </div>

          <div className="stack">
            <section className="choice">
              <span className="choice-icon"><Icon name="phone" /></span>
              <div className="stack grow" style={{ gap: 10 }}>
                <div>
                  <h2>Digital</h2>
                  <p className="muted small">Emailed with the badge attached and a link to show on their phone.</p>
                </div>
                <p className="num"><strong>{withEmail.length - unsent.length}</strong> of {withEmail.length} sent</p>
                <div className="row">
                  <button className="accent" disabled={busy || !unsent.length} onClick={() => send(unsent, false)}>
                    <Icon name="send" />{unsent.length ? `Email ${plural(unsent.length, "badge")}` : "All badges sent"}
                  </button>
                  {withEmail.length > unsent.length && (
                    <button className="secondary" disabled={busy} onClick={() => setConfirmResend(true)}>Resend to everyone</button>
                  )}
                </div>
              </div>
            </section>

            <section className="choice">
              <span className="choice-icon"><Icon name="printer" /></span>
              <div className="stack grow" style={{ gap: 10 }}>
                <div>
                  <h2>Print</h2>
                  <p className="muted small">{plural(attendees.length, "badge")}, sorted by name. To print some, select them on Attendees.</p>
                </div>
                <div className="row">
                  <a className="button" href={badgePdfUrl(event.id, { layout: "a4" })}><Icon name="download" />A4 · 4 per sheet</a>
                  <a className="button secondary" href={badgePdfUrl(event.id, { layout: "a6" })}><Icon name="download" />A6 · 1 per page</a>
                </div>
              </div>
            </section>

            {noEmail.length > 0 && (
              <section className="card stack" style={{ gap: 8 }}>
                <div className="card-head">
                  <h3>{plural(noEmail.length, "person", "people")} without an email</h3>
                  <button className="link" onClick={() => go("attendees")}>Add emails</button>
                </div>
                <p className="muted small">{noEmail.slice(0, 8).map((a) => a.fullName).join(", ")}{noEmail.length > 8 ? ` and ${noEmail.length - 8} more` : ""}. Print their badges instead.</p>
              </section>
            )}
          </div>
        </div>
      )}

      <Dialog open={confirmResend} title="Resend every badge?" onClose={() => setConfirmResend(false)}>
        <p>{plural(withEmail.length, "attendee")} will get their badge again.</p>
        <div className="dialog-foot">
          <button className="secondary" onClick={() => setConfirmResend(false)}>Cancel</button>
          <button disabled={busy} onClick={() => { setConfirmResend(false); send(withEmail, true) }}>Resend</button>
        </div>
      </Dialog>

      <Toast message={message} onClose={() => setMessage(null)} />
    </>
  )
}
