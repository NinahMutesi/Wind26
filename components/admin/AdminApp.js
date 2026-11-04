"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { api } from "@/components/api"
import Icon from "./Icon"
import OverviewPanel from "./OverviewPanel"
import AttendeesPanel from "./AttendeesPanel"
import BadgesPanel from "./BadgesPanel"
import CheckinPanel from "./CheckinPanel"
import QuizPanel from "./QuizPanel"
import CertificatesPanel from "./CertificatesPanel"
import ActivityPanel from "./ActivityPanel"

const PAGES = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "attendees", label: "Attendees", icon: "users" },
  { id: "badges", label: "Badges", icon: "badge" },
  { id: "checkin", label: "Check-in", icon: "scan" },
  { id: "quiz", label: "Quiz", icon: "quiz" },
  { id: "certificates", label: "Certificates", icon: "award" },
  { id: "activity", label: "Activity", icon: "activity" },
]
const STATUS = { draft: ["neutral", "Draft"], live: ["live", "Live"], closed: ["warn", "Closed"], archived: ["neutral", "Archived"] }

const pageFromHash = () => {
  const id = typeof window === "undefined" ? "" : window.location.hash.slice(1)
  return PAGES.some((p) => p.id === id) ? id : "overview"
}
const onHashChange = (notify) => {
  window.addEventListener("hashchange", notify)
  return () => window.removeEventListener("hashchange", notify)
}

export default function AdminApp({ staff }) {
  const [events, setEvents] = useState(null)
  const [eventId, setEventId] = useState("")
  const [data, setData] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  // The page lives in the URL hash, so browser back and forward work.
  const page = useSyncExternalStore(onHashChange, pageFromHash, () => "overview")
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

  const load = useCallback(async (id) => {
    const [d, q] = await Promise.all([api(`/api/admin/events/${id}`), api(`/api/admin/events/${id}/quizzes`)])
    return { d, q: q.quizzes }
  }, [])

  const reload = useCallback(async () => {
    if (!eventId) return
    try {
      const { d, q } = await load(eventId)
      setData(d)
      setQuizzes(q)
      setError("")
    } catch (e) {
      setError(e.message)
    }
  }, [eventId, load])

  useEffect(() => {
    if (!eventId) return undefined
    let cancelled = false
    load(eventId)
      .then(({ d, q }) => { if (!cancelled) { setData(d); setQuizzes(q); setError("") } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    try { localStorage.setItem("admin.eventId", eventId) } catch { /* storage unavailable */ }
    return () => { cancelled = true }
  }, [eventId, load])

  const go = useCallback((id) => {
    window.location.hash = id
    window.scrollTo({ top: 0 })
  }, [])

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" }).catch(() => {})
    // Full reload on purpose: it clears all in-memory data after sign-out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login"
  }

  const event = data?.event
  const attendees = data?.attendees || []
  const counts = { attendees: attendees.length, quiz: quizzes.length || "" }
  const [tone, label] = STATUS[event?.status] || STATUS.draft
  const props = { event, attendees, quizzes, reload, go, local: staff.builtin }

  return (
    <div className="shell">
      <aside className="sidebar">
        <span className="logo">NREP<span>Events</span></span>
        <nav className="nav" aria-label="Sections">
          {PAGES.map((p) => (
            <button key={p.id} aria-current={page === p.id ? "page" : undefined} onClick={() => go(p.id)}>
              <Icon name={p.icon} />{p.label}
              {counts[p.id] !== undefined && <span className="count">{counts[p.id]}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          {events && events.length > 1 && (
            <select className="event-switch hide-sm" aria-label="Event" value={eventId} onChange={(e) => { setData(null); setEventId(e.target.value) }}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}
            </select>
          )}
          {event && <span className={`pill ${tone} hide-sm`} style={{ alignSelf: "flex-start" }}>{event.code} · {label}</span>}
          {!staff.local && (
            <button className="ghost" style={{ justifyContent: "flex-start" }} onClick={signOut} title={staff.email}>Sign out</button>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          {error && <p className="notice bad">{error}</p>}
          {events && events.length === 0 && (
            <div className="card stack">
              <h2>No event yet</h2>
              <p className="muted">Create it from its folder in <code>events/</code>:</p>
              <pre className="small" style={{ margin: 0 }}>npm run event:seed -- --event &lt;folder&gt; --apply</pre>
            </div>
          )}
          {!event && !error && events?.length !== 0 && <p className="muted">Loading…</p>}
          {event && (
            <>
              {page === "overview" && <OverviewPanel {...props} />}
              {page === "attendees" && <AttendeesPanel {...props} />}
              {page === "badges" && <BadgesPanel {...props} />}
              {page === "checkin" && <CheckinPanel {...props} />}
              {page === "quiz" && <QuizPanel {...props} />}
              {page === "certificates" && <CertificatesPanel {...props} />}
              {page === "activity" && <ActivityPanel {...props} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
