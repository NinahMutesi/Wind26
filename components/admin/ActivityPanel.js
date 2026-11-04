"use client"

import { useEffect, useState } from "react"
import { api, formatDate, formatTime } from "@/components/api"

const LABELS = {
  "attendee.create": "Added attendee",
  "attendee.update": "Edited attendee",
  "attendee.delete": "Deleted attendee",
  "attendee.import": "Imported attendees",
  "tag.reissue": "Replaced badge QR code",
  "tag.email": "Emailed badges",
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

function describe(details) {
  const { by: _by, ...rest } = details || {}
  return Object.entries(rest).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ")
}

export default function ActivityPanel({ event }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    api(`/api/admin/events/${event.id}/audit`).then((r) => setEntries(r.entries)).catch((e) => setError(e.message))
  }, [event.id])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>The latest 100 changes. Scans are shown on Attendees.</p>
        </div>
      </div>
      {error && <p className="notice bad">{error}</p>}
      {!entries && !error && <p className="muted">Loading…</p>}
      {entries && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>What</th><th className="hide-sm">Details</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="num small" style={{ whiteSpace: "nowrap" }}>{formatDate(e.at)} {formatTime(e.at, event.timezone)}</td>
                  <td className="small">{e.details?.by === "admin@localhost" ? "Admin" : e.details?.by || ""}</td>
                  <td>{LABELS[e.action] || e.action}</td>
                  <td className="hide-sm small muted">{describe(e.details)}</td>
                </tr>
              ))}
              {!entries.length && <tr><td colSpan={4} className="empty">Nothing yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
