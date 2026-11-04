"use client"

import { useMemo, useState } from "react"
import { api, formatTime } from "@/components/api"
import { MANUAL_REASONS, ROLES } from "@/lib/shared/validation.mjs"
import Dialog, { Toast, plural, useAction } from "./Dialog"
import Icon from "./Icon"
import { badgePdfUrl, emailBadges } from "./actions"

const EMPTY = { fullName: "", organization: "", email: "", phone: "", role: "participant" }
const FIELDS = [
  ["fullName", "Full name", "text", "full"],
  ["organization", "Organisation", "text", "full"],
  ["email", "Email", "email", ""],
  ["phone", "Phone", "tel", ""],
]
const closeMenu = (e) => { const d = e.currentTarget.closest("details"); if (d) d.open = false }

export default function AttendeesPanel({ event, attendees, reload }) {
  const base = `/api/admin/events/${event.id}`
  const { busy, message, setMessage, clear, run } = useAction(reload)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(() => new Set())
  const [editing, setEditing] = useState(null) // { id?, values, errors, error }
  const [importing, setImporting] = useState(null) // { csv, preview, error }
  const [dayAction, setDayAction] = useState(null) // { attendee, day, present }
  const [confirm, setConfirm] = useState(null) // { kind, attendee }

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return attendees.filter((a) => words.every((w) => `${a.fullName} ${a.organization} ${a.email} ${a.phone}`.toLowerCase().includes(w)))
  }, [attendees, query])

  const chosen = attendees.filter((a) => selected.has(a.id))
  const allShown = filtered.length > 0 && filtered.every((a) => selected.has(a.id))
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected(allShown ? new Set() : new Set(filtered.map((a) => a.id)))

  async function saveAttendee(e) {
    e.preventDefault()
    const { id, values } = editing
    const ok = await run(
      () => (id ? api(`${base}/attendees/${id}`, { method: "PATCH", body: values }) : api(`${base}/attendees`, { method: "POST", body: values }))
        .catch((error) => { setEditing((cur) => ({ ...cur, errors: error.data?.fields || {}, error: error.message })); throw error }),
      id ? `Saved ${values.fullName}.` : `Added ${values.fullName}. Their badge is ready.`,
    )
    if (ok) setEditing(null)
    else clear()
  }

  async function checkImport() {
    try {
      const preview = await api(`${base}/import`, { method: "POST", body: { csv: importing.csv, commit: false } })
      setImporting((cur) => ({ ...cur, preview, error: "" }))
    } catch (error) {
      setImporting((cur) => ({ ...cur, preview: null, error: error.message }))
    }
  }

  async function commitImport() {
    const ok = await run(() => api(`${base}/import`, { method: "POST", body: { csv: importing.csv, commit: true } }),
      (r) => `Imported ${plural(r.created, "attendee")}. Their badges are ready.`)
    if (ok) setImporting(null)
  }

  async function readFile(file) {
    if (!file) return
    if (file.size > 1_000_000) { setImporting({ csv: "", preview: null, error: "That file is larger than 1 MB." }); return }
    const csv = await file.text()
    setImporting({ csv, preview: null, error: "" })
    try {
      const preview = await api(`${base}/import`, { method: "POST", body: { csv, commit: false } })
      setImporting({ csv, preview, error: "" })
    } catch (error) {
      setImporting({ csv, preview: null, error: error.message })
    }
  }

  async function submitDay(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const { attendee, day, present } = dayAction
    const ok = await run(
      () => present
        ? api(`${base}/checkins`, { method: "DELETE", body: { attendeeId: attendee.id, day, reason: form.get("note") } })
        : api(`${base}/checkins`, { method: "POST", body: { attendeeId: attendee.id, day, reason: form.get("reason"), note: form.get("note") } }),
      present ? `Removed day ${day} for ${attendee.fullName}.` : `Recorded day ${day} for ${attendee.fullName}.`,
    )
    if (ok) setDayAction(null)
  }

  async function confirmAction() {
    const { kind, attendee } = confirm
    const ok = kind === "reissue"
      ? await run(() => api(`${base}/attendees/${attendee.id}/reissue-tag`, { method: "POST" }), `New badge issued for ${attendee.fullName}. The old QR code no longer works.`)
      : await run(() => api(`${base}/attendees/${attendee.id}`, { method: "DELETE" }), `Deleted ${attendee.fullName}.`)
    if (ok) {
      setConfirm(null)
      setSelected((s) => { const n = new Set(s); n.delete(attendee.id); return n })
    }
  }

  const emailOne = (a) => run((progress) => emailBadges(event.id, [a.id], { resend: true, progress }), (r) => r)
  const emailChosen = () => run((progress) => emailBadges(event.id, chosen.filter((a) => a.email).map((a) => a.id), { resend: true, progress }), (r) => r)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Attendees</h1>
          <p>{plural(attendees.length, "person", "people")} registered</p>
        </div>
        <div className="row">
          <a className="button secondary" href={`${base}/attendance-csv`}><Icon name="download" />Export</a>
          <button className="secondary" onClick={() => setImporting({ csv: "", preview: null, error: "" })}><Icon name="upload" />Import</button>
          <button onClick={() => setEditing({ values: EMPTY, errors: {} })}><Icon name="plus" />Add attendee</button>
        </div>
      </div>

      <div className="row">
        <label className="search" aria-label="Search attendees">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {chosen.length > 0 && (
        <div className="selection">
          <strong className="grow">{chosen.length} selected</strong>
          <a className="button secondary" href={badgePdfUrl(event.id, { layout: "a4", ids: chosen.map((a) => a.id) })}><Icon name="printer" />Print A4</a>
          <a className="button secondary" href={badgePdfUrl(event.id, { layout: "a6", ids: chosen.map((a) => a.id) })}><Icon name="printer" />Print A6</a>
          <button className="secondary" disabled={busy || !chosen.some((a) => a.email)} onClick={emailChosen}><Icon name="mail" />Email badges</button>
          <button className="secondary" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check"><input type="checkbox" aria-label="Select all" checked={allShown} onChange={toggleAll} /></th>
              <th>Name</th>
              <th className="hide-sm">Email</th>
              <th>Attendance</th>
              <th>Badge</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="check"><input type="checkbox" aria-label={`Select ${a.fullName}`} checked={selected.has(a.id)} onChange={() => toggle(a.id)} /></td>
                <td className="person">
                  <b>{a.fullName}</b>
                  <span>{a.organization || "—"}{a.role !== "participant" ? ` · ${a.role}` : ""}</span>
                </td>
                <td className="hide-sm small">{a.email || <span className="muted">—</span>}</td>
                <td>
                  <div className="days">
                    {event.days.map((d) => {
                      const c = a.checkins.find((x) => x.day === d.day)
                      const label = c ? `Day ${d.day}: ${c.source === "qr" ? "scanned" : "added by hand"} at ${formatTime(c.at, event.timezone)}` : `Day ${d.day}: not checked in`
                      return (
                        <button key={d.day} title={label} aria-label={label}
                          className={`day ${c ? "on" : ""} ${c && c.source !== "qr" ? "manual" : ""}`}
                          onClick={() => setDayAction({ attendee: a, day: d.day, present: Boolean(c) })}>{d.day}</button>
                      )
                    })}
                  </div>
                </td>
                <td>
                  {a.tagEmailedAt ? <span className="pill ok">Emailed</span> : a.email ? <span className="pill neutral">Not sent</span> : <span className="pill warn">No email</span>}
                </td>
                <td className="actions">
                  <details className="menu">
                    <summary className="button ghost icon-btn" aria-label={`Actions for ${a.fullName}`}><Icon name="more" /></summary>
                    <div className="menu-list" onClick={closeMenu}>
                      <button onClick={() => setEditing({ id: a.id, values: { fullName: a.fullName, organization: a.organization, email: a.email, phone: a.phone, role: a.role }, errors: {} })}>Edit details</button>
                      <a href={`/t/${a.tagId}`} target="_blank" rel="noreferrer">Open digital badge</a>
                      <a href={`${base}/attendees/${a.id}/tag`}>Download badge image</a>
                      <a href={badgePdfUrl(event.id, { layout: "a6", ids: [a.id] })}>Print badge (A6)</a>
                      {a.email && <button disabled={busy} onClick={() => emailOne(a)}>{a.tagEmailedAt ? "Resend badge" : "Email badge"}</button>}
                      <button onClick={() => setConfirm({ kind: "reissue", attendee: a })}>Replace QR code</button>
                      {!a.days.length && !a.certificate && <button className="danger-item" onClick={() => setConfirm({ kind: "delete", attendee: a })}>Delete</button>}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={6} className="empty">{attendees.length ? "No one matches your search." : "No attendees yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} title={editing?.id ? "Edit attendee" : "Add attendee"} onClose={() => setEditing(null)}>
        {editing && (
          <form className="stack" onSubmit={saveAttendee}>
            {editing.error && <p className="notice bad">{editing.error}</p>}
            <div className="form-grid">
              {FIELDS.map(([key, label, type, span]) => (
                <label key={key} htmlFor={`f-${key}`} className={span}>
                  {label}
                  <input id={`f-${key}`} type={type} value={editing.values[key]} required={key === "fullName"} autoFocus={key === "fullName"}
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
            </div>
            <div className="dialog-foot">
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" disabled={busy}>{editing.id ? "Save" : "Add attendee"}</button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={Boolean(importing)} title="Import attendees" wide onClose={() => setImporting(null)}>
        {importing && (
          <div className="stack">
            <p className="muted small">CSV with a header row: <strong>Name</strong>, Organisation, Email, Phone, Role.</p>
            <label htmlFor="csv-file">File<input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} /></label>
            <label htmlFor="csv-text">Or paste
              <textarea id="csv-text" value={importing.csv} onChange={(e) => setImporting({ csv: e.target.value, preview: null, error: "" })} placeholder={"Name,Organisation,Email\nGrace Achieng,Example Energy Ltd,grace@example.org"} />
            </label>
            {importing.error && <p className="notice bad">{importing.error}</p>}
            {importing.preview && (
              <>
                <p className={`notice ${importing.preview.invalid ? "warn" : "ok"}`}>
                  {importing.preview.valid} ready{importing.preview.invalid ? ` · ${importing.preview.invalid} with problems` : ""}
                </p>
                <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                  <table>
                    <tbody>
                      {importing.preview.preview.map((r) => (
                        <tr key={r.line}>
                          <td className="num muted small">{r.line}</td>
                          <td className="person"><b>{r.value.fullName || "—"}</b><span>{r.value.organization}</span></td>
                          <td className="small">{r.value.email}</td>
                          <td className="small">{r.errors.length ? <span className="field-error">{r.errors.join(" ")}</span> : <span className="pill ok">OK</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="dialog-foot">
              <button className="secondary" disabled={busy || !importing.csv.trim()} onClick={checkImport}>Check</button>
              <button disabled={busy || !importing.preview || importing.preview.invalid > 0 || !importing.preview.valid} onClick={commitImport}>
                Import {importing.preview?.valid || ""}
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(dayAction)} title={dayAction ? `${dayAction.present ? "Remove" : "Record"} day ${dayAction.day}` : ""} onClose={() => setDayAction(null)}>
        {dayAction && (
          <form className="stack" onSubmit={submitDay}>
            <p><strong>{dayAction.attendee.fullName}</strong></p>
            {dayAction.present ? (
              <label htmlFor="d-note">Reason<input id="d-note" name="note" required minLength={3} maxLength={200} autoFocus /></label>
            ) : (
              <>
                <label htmlFor="d-reason">Reason
                  <select id="d-reason" name="reason" defaultValue="paper_list">{MANUAL_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                </label>
                <label htmlFor="d-note">Note<input id="d-note" name="note" maxLength={200} /></label>
              </>
            )}
            <div className="dialog-foot">
              <button type="button" className="secondary" onClick={() => setDayAction(null)}>Cancel</button>
              <button type="submit" className={dayAction.present ? "danger solid" : ""} disabled={busy}>{dayAction.present ? "Remove" : "Record"}</button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={Boolean(confirm)} title={confirm?.kind === "reissue" ? "Replace QR code?" : "Delete attendee?"} onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="stack">
            <p>{confirm.kind === "reissue"
              ? `${confirm.attendee.fullName}'s current badge stops working, on paper and on their phone. Send or print the new one.`
              : `${confirm.attendee.fullName} will be removed and their badge will stop working.`}</p>
            <div className="dialog-foot">
              <button className="secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="danger solid" disabled={busy} onClick={confirmAction}>{confirm.kind === "reissue" ? "Replace" : "Delete"}</button>
            </div>
          </div>
        )}
      </Dialog>

      <Toast message={message} onClose={() => setMessage(null)} />
    </>
  )
}
