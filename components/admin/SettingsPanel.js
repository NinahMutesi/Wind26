"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "@/components/api"
import Dialog, { Notice } from "./Dialog"

const NEXT = {
  draft: [{ status: "live", label: "Open check-in (go live)" }],
  live: [{ status: "closed", label: "Close the event" }],
  closed: [{ status: "live", label: "Reopen check-in" }, { status: "archived", label: "Archive (tag links stop working)" }],
  archived: [],
}

export default function SettingsPanel({ event, reload }) {
  const base = `/api/admin/events/${event.id}`
  const [scanners, setScanners] = useState([])
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [statusChange, setStatusChange] = useState(null)

  const load = useCallback(() => api(`${base}/scanners`).then((r) => setScanners(r.scanners)).catch((e) => setMessage({ tone: "bad", text: e.message })), [base])
  useEffect(() => { load() }, [load])

  async function addScanner(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    setBusy(true)
    try {
      await api(`${base}/scanners`, { method: "POST", body: data })
      form.reset()
      setMessage({ tone: "ok", text: `${data.name} can now sign in at /login and scan for this event.` })
      await load()
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function toggle(scanner) {
    setBusy(true)
    try {
      await api(`${base}/scanners/${scanner.id}`, { method: "PATCH", body: { status: scanner.status === "active" ? "disabled" : "active" } })
      await load()
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(base, { method: "PATCH", body: { status: statusChange.status, confirmCode: new FormData(e.currentTarget).get("code") } })
      setStatusChange(null)
      setMessage({ tone: "ok", text: "Event status updated." })
      await reload()
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stack">
      <Notice message={message} />
      <div className="card stack">
        <h2>Scanners</h2>
        <p className="muted small">Scanner accounts can only check people in for this event. Disabling one signs it out immediately.</p>
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
          {scanners.map((s) => (
            <li key={s.id} className="row spread">
              <span><strong>{s.name}</strong> <span className="muted small">{s.email}</span></span>
              <span className="row">
                <span className={`pill ${s.status === "active" ? "ok" : "neutral"}`}>{s.status}</span>
                <button className="secondary" disabled={busy} onClick={() => toggle(s)}>{s.status === "active" ? "Disable" : "Enable"}</button>
              </span>
            </li>
          ))}
          {!scanners.length && <li className="muted">No scanners yet.</li>}
        </ul>
        <form className="row" onSubmit={addScanner} style={{ alignItems: "flex-end" }}>
          <label htmlFor="s-name" style={{ flex: "1 1 160px" }}>Name<input id="s-name" name="name" required /></label>
          <label htmlFor="s-email" style={{ flex: "2 1 220px" }}>Email<input id="s-email" name="email" type="email" required /></label>
          <button type="submit" disabled={busy}>Add scanner</button>
        </form>
      </div>

      <div className="card stack">
        <h2>Event status</h2>
        <p className="muted small">
          Scanners can check people in only while the event is <strong>live</strong>, on event days, between {event.checkinOpens} and {event.checkinCloses} ({event.timezone}).
        </p>
        <div className="row">
          {NEXT[event.status].map((n) => (
            <button key={n.status} className={n.status === "archived" ? "danger" : "secondary"} onClick={() => setStatusChange(n)}>{n.label}</button>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(statusChange)} title={statusChange?.label || ""} onClose={() => setStatusChange(null)}>
        {statusChange && (
          <form className="stack" onSubmit={changeStatus}>
            <label htmlFor="confirm-code">Type the event code <strong>{event.code}</strong> to confirm<input id="confirm-code" name="code" autoComplete="off" required /></label>
            <div className="row"><button type="submit" disabled={busy}>Confirm</button></div>
          </form>
        )}
      </Dialog>
    </section>
  )
}
