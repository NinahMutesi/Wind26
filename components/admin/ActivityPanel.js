"use client"

import { Fragment, useEffect, useState } from "react"
import { api, formatDate, formatTime } from "@/components/api"
import { localParts } from "@/lib/shared/event-days.mjs"
import { Columns } from "./Charts"
import Icon from "./Icon"
import { plural } from "./Dialog"

const LABELS = {
  "attendee.create": "Added attendee",
  "attendee.update": "Edited attendee",
  "attendee.delete": "Deleted attendee",
  "attendee.import": "Imported attendees",
  "tag.reissue": "Replaced badge QR code",
  "tag.email": "Emailed badges",
  "checkin.scan": "Checked in by QR code",
  "checkin.manual": "Checked in by hand",
  "checkin.admin_add": "Recorded attendance by hand",
  "checkin.remove": "Removed a check-in",
  "certificate.issue": "Issued certificate",
  "certificate.revoke": "Revoked certificate",
  "certificate.restore": "Restored certificate",
  "certificate.refresh_name": "Updated name on certificate",
  "certificate.email": "Emailed certificates",
  "scanner.add": "Added scanner",
  "scanner.assign": "Moved scanner to this event",
  "scanner.enable": "Enabled scanner",
  "scanner.disable": "Disabled scanner",
  "event.status": "Changed event status",
  "attendance.export": "Exported attendance",
  "quiz.create": "Created quiz",
  "quiz.update": "Edited quiz",
  "quiz.open": "Opened quiz",
  "quiz.close": "Closed quiz",
  "quiz.delete": "Deleted quiz",
}
const AREAS = { attendee: "Attendees", tag: "Badges", checkin: "Check-in", quiz: "Quiz", certificate: "Certificates", scanner: "Scanners", event: "Event", attendance: "Event" }
const area = (action) => AREAS[action.split(".")[0]] || "Other"
const FIELD = { fullName: "Name", created: "Added", count: "Count", status: "Status", from: "From", to: "To", day: "Day", reason: "Reason", note: "Note", title: "Title", sent: "Sent", failed: "Failed", skipped: "Skipped" }

const who = (e) => (e.details?.by === "admin@localhost" || e.details?.by === "admin" ? "Admin" : e.details?.by || e.who || "")
const show = (v) => (v && typeof v === "object" ? Object.entries(v).map(([k, x]) => `${FIELD[k] || k}: ${x}`).join(", ") : String(v))

function summary(details) {
  const { by: _by, ...rest } = details || {}
  if (rest.before && rest.after) return `${show(rest.before)} → ${show(rest.after)}`
  return Object.entries(rest).filter(([, v]) => v !== "" && v != null).slice(0, 3).map(([k, v]) => `${FIELD[k] || k}: ${show(v)}`).join(" · ")
}

export default function ActivityPanel({ event, attendees }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState("")
  const [areaFilter, setAreaFilter] = useState("")
  const [person, setPerson] = useState("")
  const [day, setDay] = useState("")
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(null)

  useEffect(() => {
    api(`/api/admin/events/${event.id}/audit`).then((r) => setEntries(r.entries)).catch((e) => setError(e.message))
  }, [event.id])

  // Scans aren't in the change log, so they are added here from the attendance records.
  const scans = attendees.flatMap((a) => a.checkins.filter((c) => c.at).map((c) => ({
    id: `scan-${a.id}-${c.day}`, action: c.source === "manual" ? "checkin.manual" : "checkin.scan", at: c.at,
    who: c.source === "manual" ? "Desk" : "Scanner", details: { fullName: a.fullName, day: c.day, ...(c.reason ? { reason: c.reason } : {}) },
  })))
  const all = entries ? [...entries, ...scans].sort((x, y) => String(y.at).localeCompare(String(x.at))) : []
  const dateOf = (e) => localParts(event.timezone, new Date(e.at)).date
  const text = (e) => `${LABELS[e.action] || e.action} ${who(e)} ${summary(e.details)}`.toLowerCase()

  const byOthers = (skip) => all.filter((e) =>
    (skip === "area" || !areaFilter || area(e.action) === areaFilter)
    && (skip === "person" || !person || who(e) === person)
    && (skip === "day" || !day || dateOf(e) === day)
    && (!q.trim() || text(e).includes(q.trim().toLowerCase())))
  const shown = byOthers()

  const areaCounts = Object.entries(byOthers("area").reduce((m, e) => ({ ...m, [area(e.action)]: (m[area(e.action)] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
  const people = [...new Set(all.map(who).filter(Boolean))].sort()

  // The last 14 days that had activity, oldest first.
  const perDay = byOthers("day").reduce((m, e) => { const d = dateOf(e); m[d] = (m[d] || 0) + 1; return m }, {})
  const days = Object.keys(perDay).sort().slice(-14)
  const filtered = Boolean(areaFilter || person || day || q.trim())

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>Changes made in the dashboard and every check-in. Click a bar or a type to narrow the list.</p>
        </div>
      </div>
      {error && <p className="notice bad">{error}</p>}
      {!entries && !error && <p className="muted">Loading…</p>}
      {entries && (
        <>
          {days.length > 0 && (
            <section className="card stack">
              <div className="card-head"><h2>Activity per day</h2><span className="small muted">{plural(byOthers("day").length, "entry", "entries")}</span></div>
              <Columns compact={days.length > 7} max={Math.max(1, ...days.map((d) => perDay[d]))} color="var(--brand)"
                items={days.map((d) => {
                  const list = byOthers("day").filter((e) => dateOf(e) === d)
                  const parts = Object.entries(list.reduce((m, e) => ({ ...m, [area(e.action)]: (m[area(e.action)] || 0) + 1 }), {})).map(([k, v]) => `${k}: ${v}`)
                  return {
                    key: d, value: perDay[d], text: perDay[d], label: formatDate(d).replace(/ \d{4}$/, ""),
                    tip: [formatDate(d), plural(perDay[d], "entry", "entries"), ...parts], active: day === d,
                    onClick: () => setDay(day === d ? "" : d),
                  }
                })} />
            </section>
          )}

          <div className="row spread">
            <div className="row">
              <button type="button" className={`an-chip ${!areaFilter ? "on" : ""}`} onClick={() => setAreaFilter("")}>All</button>
              {areaCounts.map(([k, n]) => (
                <button key={k} type="button" className={`an-chip ${areaFilter === k ? "on" : ""}`} onClick={() => setAreaFilter(areaFilter === k ? "" : k)}>{k} <span className="num muted">{n}</span></button>
              ))}
            </div>
            <div className="row">
              <select aria-label="Who" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">Everyone</option>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="search" aria-label="Search activity" placeholder="Search, e.g. a name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          <div className="row">
            <h2>{plural(shown.length, "entry", "entries")}</h2>
            {day && <button type="button" className="an-chip on" onClick={() => setDay("")}>{formatDate(day)}<Icon name="x" size={14} /></button>}
            {filtered && <button type="button" className="ghost small" onClick={() => { setAreaFilter(""); setPerson(""); setDay(""); setQ("") }}>Clear filters</button>}
          </div>

          <div className="table-wrap" style={{ maxHeight: 620, overflowY: "auto" }}>
            <table>
              <thead><tr><th>When</th><th>Who</th><th>What</th><th className="hide-sm">Details</th></tr></thead>
              <tbody>
                {shown.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="an-row" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                      <td className="num small" style={{ whiteSpace: "nowrap" }}>{formatDate(e.at).replace(/ \d{4}$/, "")} {formatTime(e.at, event.timezone)}</td>
                      <td className="small">{who(e)}</td>
                      <td><span className="row" style={{ gap: 6 }}><span className="pill neutral">{area(e.action)}</span>{LABELS[e.action] || e.action}</span></td>
                      <td className="hide-sm small muted">{summary(e.details)}</td>
                    </tr>
                    {open === e.id && (
                      <tr className="an-detail">
                        <td colSpan={4}>
                          <dl>
                            {Object.entries(e.details || {}).filter(([, v]) => v !== "" && v != null).map(([k, v]) => (
                              <Fragment key={k}><dt>{k === "by" ? "Done by" : FIELD[k] || k}</dt><dd>{show(v)}</dd></Fragment>
                            ))}
                            <dt>Time</dt><dd>{formatDate(e.at)} {formatTime(e.at, event.timezone)}</dd>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!shown.length && <tr><td colSpan={4} className="empty">{filtered ? "Nothing matches these filters." : "Nothing yet."}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted small">Shows the latest 500 changes and every check-in.</p>
        </>
      )}
    </>
  )
}
