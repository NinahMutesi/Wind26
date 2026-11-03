"use client"

import { useMemo, useState } from "react"
import { api, formatDate, formatTime } from "@/components/api"
import { MANUAL_REASONS, ROLES } from "@/lib/shared/validation.mjs"
import Dialog, { Notice, inBatches } from "./Dialog"

const EMPTY = { fullName: "", organization: "", email: "", phone: "", role: "participant" }

export default function AttendeesPanel({ event, attendees, reload }) {
  const base = `/api/admin/events/${event.id}`
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState(null)
  const [editing, setEditing] = useState(null) // { id?, values, errors }
  const [importing, setImporting] = useState(null) // { csv, preview }
  const [dayAction, setDayAction] = useState(null) // { attendee, day, present }
  const [confirm, setConfirm] = useState(null) // { kind, attendee }
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return attendees.filter((a) => words.every((w) => `${a.fullName} ${a.organization} ${a.email} ${a.phone}`.toLowerCase().includes(w)))
  }, [attendees, query])

  const perDay = event.days.map((d) => attendees.filter((a) => a.days.includes(d.day)).length)
  const notEmailed = attendees.filter((a) => a.email && !a.tagEmailedAt)

  async function run(action, success) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action()
      if (success) setMessage({ tone: "ok", text: typeof success === "function" ? success(result) : success })
      await reload()
      return result
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function saveAttendee(e) {
    e.preventDefault()
    const { id, values } = editing
    setBusy(true)
    try {
      if (id) await api(`${base}/attendees/${id}`, { method: "PATCH", body: values })
      else await api(`${base}/attendees`, { method: "POST", body: values })
      setEditing(null)
      setMessage({ tone: "ok", text: id ? `Saved changes to ${values.fullName}.` : `Added ${values.fullName}. Their tag is ready.` })
      await reload()
    } catch (error) {
      setEditing({ ...editing, errors: error.data?.fields || {}, error: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function emailTags(list, resend = false) {
    setBusy(true)
    setMessage({ tone: "info", text: `Sending 0 of ${list.length}…` })
    try {
      const results = await inBatches(list.map((a) => a.id), 10,
        (ids) => api(`${base}/tags/email`, { method: "POST", body: { attendeeIds: ids, resend } }).then((r) => r.results),
        (done, total) => setMessage({ tone: "info", text: `Sending ${done} of ${total}…` }))
      const sent = results.filter((r) => r.status === "sent").length
      const failed = results.filter((r) => r.status === "failed").length
      setMessage({ tone: failed ? "warn" : "ok", text: `Sent ${sent} tag email${sent === 1 ? "" : "s"}.${failed ? ` ${failed} failed; try again in a moment.` : ""}` })
      await reload()
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function previewImport() {
    setBusy(true)
    try {
      const result = await api(`${base}/import`, { method: "POST", body: { csv: importing.csv, commit: false } })
      setImporting({ ...importing, preview: result, error: "" })
    } catch (error) {
      setImporting({ ...importing, preview: null, error: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function commitImport() {
    const result = await run(() => api(`${base}/import`, { method: "POST", body: { csv: importing.csv, commit: true } }), (r) => `Imported ${r.created} attendees. Their tags are ready.`)
    if (result) setImporting(null)
  }

  async function readFile(file) {
    if (!file) return
    if (file.size > 1_000_000) return setImporting({ ...importing, error: "That file is larger than 1 MB." })
    setImporting({ csv: await file.text(), preview: null, error: "" })
  }

  async function submitDay(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const { attendee, day, present } = dayAction
    const ok = await run(
      () => present
        ? api(`${base}/checkins`, { method: "DELETE", body: { attendeeId: attendee.id, day, reason: form.get("note") } })
        : api(`${base}/checkins`, { method: "POST", body: { attendeeId: attendee.id, day, reason: form.get("reason"), note: form.get("note") } }),
      present ? `Removed Day ${day} for ${attendee.fullName}.` : `Recorded Day ${day} for ${attendee.fullName}.`,
    )
    if (ok) setDayAction(null)
  }

  async function confirmAction() {
    const { kind, attendee } = confirm
    const ok = kind === "reissue"
      ? await run(() => api(`${base}/attendees/${attendee.id}/reissue-tag`, { method: "POST" }), `Reissued ${attendee.fullName}'s tag. The old QR code no longer works. Send them the new one.`)
      : await run(() => api(`${base}/attendees/${attendee.id}`, { method: "DELETE" }), `Deleted ${attendee.fullName}.`)
    if (ok) setConfirm(null)
  }

  return (
    <section className="stack">
      <div className="stats">
        <div className="stat"><b>{attendees.length}</b><span>Registered</span></div>
        {event.days.map((d, i) => (
          <div className="stat" key={d.day}><b>{perDay[i]}</b><span>Day {d.day} · {formatDate(d.date).replace(/ \d{4}$/, "")}</span></div>
        ))}
        <div className="stat"><b>{attendees.length - notEmailed.length}</b><span>Tags emailed</span></div>
      </div>

      <Notice message={message} />

      <div className="row spread">
        <input type="search" aria-label="Search attendees" placeholder="Search name, organisation, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: "1 1 260px" }} />
        <div className="row">
          <button onClick={() => setEditing({ values: EMPTY, errors: {} })}>Add attendee</button>
          <button className="secondary" onClick={() => setImporting({ csv: "", preview: null, error: "" })}>Import CSV</button>
          <a className="button secondary" href={`${base}/tags/pdf`}>Print all tags (PDF)</a>
          <button className="accent" disabled={busy || !notEmailed.length} onClick={() => emailTags(notEmailed)}>
            Email {notEmailed.length} unsent tag{notEmailed.length === 1 ? "" : "s"}
          </button>
          <a className="button secondary" href={`${base}/attendance-csv`}>Export attendance</a>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Attendee</th>
              <th className="hide-sm">Contact</th>
              <th>Attendance</th>
              <th>Tag</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.fullName}</strong>
                  <div className="muted small">{a.organization || "—"}{a.role !== "participant" ? ` · ${a.role}` : ""}</div>
                </td>
                <td className="hide-sm small">
                  <div>{a.email || <span className="muted">No email</span>}</div>
                  <div className="muted">{a.phone}</div>
                </td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    {event.days.map((d) => {
                      const checkin = a.checkins.find((c) => c.day === d.day)
                      const label = checkin
                        ? `Day ${d.day}: ${checkin.source === "qr" ? "scanned" : "added by hand"} at ${formatTime(checkin.at, event.timezone)}. Click to remove.`
                        : `Day ${d.day}: not checked in. Click to record attendance.`
                      return (
                        <button key={d.day} title={label} aria-label={label}
                          className={`day ${checkin ? "on" : ""} ${checkin && checkin.source !== "qr" ? "manual" : ""}`}
                          onClick={() => setDayAction({ attendee: a, day: d.day, present: Boolean(checkin) })}>
                          {d.day}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="small">
                  <div className="row" style={{ gap: 2 }}>
                    <a href={`/t/${a.tagId}`} target="_blank" rel="noreferrer">Open</a>
                    <span className="muted">·</span>
                    <a href={`${base}/attendees/${a.id}/tag`}>PNG</a>
                    {a.email && (<><span className="muted">·</span><button className="link" disabled={busy} onClick={() => emailTags([a], true)}>{a.tagEmailedAt ? "Resend" : "Email"}</button></>)}
                  </div>
                  <div>{a.tagEmailedAt ? <span className="pill ok">Emailed</span> : <span className="pill neutral">Not emailed</span>}</div>
                </td>
                <td className="small" style={{ whiteSpace: "nowrap" }}>
                  <button className="link" onClick={() => setEditing({ id: a.id, values: { fullName: a.fullName, organization: a.organization, email: a.email, phone: a.phone, role: a.role }, errors: {} })}>Edit</button>
                  <button className="link" onClick={() => setConfirm({ kind: "reissue", attendee: a })}>Reissue tag</button>
                  {!a.days.length && !a.certificate && <button className="link" onClick={() => setConfirm({ kind: "delete", attendee: a })}>Delete</button>}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={5} className="muted">{attendees.length ? "No attendees match your search." : "No attendees yet. Add them one by one or import a CSV file."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">Green days were scanned at the desk. Amber days were added by hand and have a reason in the activity log.</p>

      <Dialog open={Boolean(editing)} title={editing?.id ? "Edit attendee" : "Add attendee"} onClose={() => setEditing(null)}>
        {editing && (
          <form className="stack" onSubmit={saveAttendee}>
            {editing.error && <p className="notice bad">{editing.error}</p>}
            {[["fullName", "Full name (as it should appear on the tag and certificate)", "text"], ["organization", "Organisation", "text"], ["email", "Email (tag and certificate are sent here)", "email"], ["phone", "Phone", "tel"]].map(([key, label, type]) => (
              <label key={key} htmlFor={`f-${key}`}>
                {label}
                <input id={`f-${key}`} type={type} value={editing.values[key]} required={key === "fullName"}
                  onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [key]: e.target.value } })} />
                {editing.errors?.[key] && <span className="field-error">{editing.errors[key]}</span>}
              </label>
            ))}
            <label htmlFor="f-role">
              Role
              <select id="f-role" value={editing.values.role} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, role: e.target.value } })}>
                {ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
              </select>
            </label>
            {editing.id && <p className="muted small">Changing the name updates the tag straight away. Issued certificates keep the old name until you refresh it on the Certificates tab.</p>}
            <div className="row"><button type="submit" disabled={busy}>{editing.id ? "Save changes" : "Add attendee"}</button></div>
          </form>
        )}
      </Dialog>

      <Dialog open={Boolean(importing)} title="Import attendees from CSV" onClose={() => setImporting(null)}>
        {importing && (
          <div className="stack">
            <p className="muted small">The first row must be a header. Columns: <strong>Name</strong> (required), Organisation, Email, Phone, Role. Save Excel files as &ldquo;CSV UTF-8&rdquo;.</p>
            <label htmlFor="csv-file">Choose a file<input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} /></label>
            <label htmlFor="csv-text">Or paste the rows
              <textarea id="csv-text" value={importing.csv} onChange={(e) => setImporting({ csv: e.target.value, preview: null, error: "" })} placeholder={"Name,Organisation,Email,Phone\nGrace Achieng,Example Energy Ltd,grace@example.org,0772000000"} />
            </label>
            {importing.error && <p className="notice bad">{importing.error}</p>}
            {importing.preview && (
              <div className="stack" style={{ gap: 8 }}>
                <p className={`notice ${importing.preview.invalid ? "warn" : "ok"}`}>
                  {importing.preview.valid} ready to import{importing.preview.invalid ? `, ${importing.preview.invalid} with problems. Fix them and check again.` : "."}
                </p>
                <div className="table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
                  <table>
                    <tbody>
                      {importing.preview.preview.map((r) => (
                        <tr key={r.line}>
                          <td className="num muted">{r.line}</td>
                          <td>{r.value.fullName || <em>blank</em>}<div className="muted small">{r.value.organization}</div></td>
                          <td className="small">{r.errors.length ? <span className="field-error">{r.errors.join(" ")}</span> : <span className="pill ok">OK</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="row">
              <button className="secondary" disabled={busy || !importing.csv.trim()} onClick={previewImport}>Check file</button>
              <button disabled={busy || !importing.preview || importing.preview.invalid > 0 || !importing.preview.valid} onClick={commitImport}>
                Import {importing.preview?.valid || ""} attendees
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(dayAction)} title={dayAction ? `${dayAction.present ? "Remove" : "Record"} Day ${dayAction.day} for ${dayAction.attendee.fullName}` : ""} onClose={() => setDayAction(null)}>
        {dayAction && (
          <form className="stack" onSubmit={submitDay}>
            {dayAction.present ? (
              <label htmlFor="d-note">Why remove this check-in?<input id="d-note" name="note" required minLength={3} maxLength={200} placeholder="e.g. Scanned the wrong person's tag" /></label>
            ) : (
              <>
                <label htmlFor="d-reason">Reason
                  <select id="d-reason" name="reason" defaultValue="paper_list">{MANUAL_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                </label>
                <label htmlFor="d-note">Note (required for &ldquo;Other&rdquo;)<input id="d-note" name="note" maxLength={200} /></label>
              </>
            )}
            <p className="muted small">This is recorded in the activity log with your name.</p>
            <div className="row"><button type="submit" className={dayAction.present ? "danger" : ""} disabled={busy}>{dayAction.present ? "Remove check-in" : "Record attendance"}</button></div>
          </form>
        )}
      </Dialog>

      <Dialog open={Boolean(confirm)} title={confirm?.kind === "reissue" ? "Reissue tag?" : "Delete attendee?"} onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="stack">
            <p>{confirm.kind === "reissue"
              ? `${confirm.attendee.fullName}'s current QR code will stop working immediately, on paper and on their phone. Use this if a tag was lost or shared.`
              : `${confirm.attendee.fullName} will be removed from this event and their tag will stop working.`}</p>
            <div className="row">
              <button className="danger" disabled={busy} onClick={confirmAction}>{confirm.kind === "reissue" ? "Reissue tag" : "Delete attendee"}</button>
              <button className="secondary" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  )
}
