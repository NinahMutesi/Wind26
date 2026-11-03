"use client"

import { useEffect, useState } from "react"
import { api, formatDate, formatTime } from "@/components/api"

const LABELS = {
  "attendee.create": "Added attendee",
  "attendee.update": "Edited attendee",
  "attendee.delete": "Deleted attendee",
  "attendee.import": "Imported attendees",
  "tag.reissue": "Reissued tag",
  "tag.email": "Emailed tags",
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

  if (error) return <p className="notice bad">{error}</p>
  if (!entries) return <p className="muted">Loading…</p>
  return (
    <section className="stack">
      <p className="muted small">The latest 100 admin actions for this event. Scanner check-ins are not listed here; they are on the Attendees tab.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th className="hide-sm">Details</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="num small" style={{ whiteSpace: "nowrap" }}>{formatDate(e.at)} {formatTime(e.at, event.timezone)}</td>
                <td className="small">{e.details?.by || ""}</td>
                <td>{LABELS[e.action] || e.action}</td>
                <td className="hide-sm small muted">{describe(e.details)}</td>
              </tr>
            ))}
            {!entries.length && <tr><td colSpan={4} className="muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
