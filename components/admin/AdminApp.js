"use client"

import { useCallback, useEffect, useState } from "react"
import { api, formatDate } from "@/components/api"
import AttendeesPanel from "./AttendeesPanel"
import CertificatesPanel from "./CertificatesPanel"
import SettingsPanel from "./SettingsPanel"
import ActivityPanel from "./ActivityPanel"

const TABS = [
  { id: "attendees", label: "Attendees and tags" },
  { id: "certificates", label: "Certificates" },
  { id: "settings", label: "Scanners and event status" },
  { id: "activity", label: "Activity log" },
]

const STATUS_TONE = { draft: "neutral", live: "live", closed: "warn", archived: "neutral" }

export default function AdminApp({ staff }) {
  const [events, setEvents] = useState(null)
  const [eventId, setEventId] = useState("")
  const [data, setData] = useState(null)
  const [tab, setTab] = useState("attendees")
  const [error, setError] = useState("")

  useEffect(() => {
    api("/api/admin/events")
      .then(({ events }) => {
        setEvents(events)
        let saved = ""
        try { saved = localStorage.getItem("admin.eventId") || "" } catch { /* storage unavailable */ }
        const pick = events.find((e) => e.id === saved) || events.find((e) => e.status === "live") || events[0]
        if (pick) setEventId(pick.id)
      })
      .catch((e) => setError(e.message))
  }, [])

  const reload = useCallback(async () => {
    if (!eventId) return
    try {
      setData(await api(`/api/admin/events/${eventId}`))
      setError("")
    } catch (e) {
      setError(e.message)
    }
  }, [eventId])

  // Initial load whenever the selected event changes; reload() is for after edits.
  useEffect(() => {
    if (!eventId) return undefined
    let cancelled = false
    api(`/api/admin/events/${eventId}`)
      .then((d) => { if (!cancelled) { setData(d); setError("") } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    try { localStorage.setItem("admin.eventId", eventId) } catch { /* storage unavailable */ }
    return () => { cancelled = true }
  }, [eventId])

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" }).catch(() => {})
    window.location.href = "/login"
  }

  const event = data?.event
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <span className="brand">NREP <span>Events</span></span>
          <div className="row">
            {events && events.length > 0 && (
              <select aria-label="Event" value={eventId} onChange={(e) => { setData(null); setEventId(e.target.value) }}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.shortName || e.name}</option>)}
              </select>
            )}
            <span className="small hide-sm">{staff.email}</span>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="wrap stack">
        {error && <p className="notice bad">{error}</p>}
        {events && events.length === 0 && (
          <p className="notice info">No events yet. Create one with <code>npm run event:seed</code> (see the README).</p>
        )}
        {event && (
          <>
            <div className="row spread">
              <div className="stack" style={{ gap: 4 }}>
                <h1>{event.name}</h1>
                <p className="muted">
                  {formatDate(event.startDate)} – {formatDate(event.endDate)}{event.venue ? ` · ${event.venue}` : ""}
                </p>
              </div>
              <span className={`pill ${STATUS_TONE[event.status]}`}>{event.status.toUpperCase()}</span>
            </div>
            <nav className="tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </nav>
            {tab === "attendees" && <AttendeesPanel event={event} attendees={data.attendees} reload={reload} />}
            {tab === "certificates" && <CertificatesPanel event={event} attendees={data.attendees} reload={reload} />}
            {tab === "settings" && <SettingsPanel event={event} reload={reload} />}
            {tab === "activity" && <ActivityPanel event={event} />}
          </>
        )}
        {!event && !error && events?.length > 0 && <p className="muted">Loading…</p>}
      </main>
    </>
  )
}
