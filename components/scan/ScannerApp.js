"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { api, formatDate, formatTime } from "@/components/api"

const SAME_CODE_COOLDOWN_MS = 4000

function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35))
  } catch { /* sound is optional */ }
}

export default function ScannerApp() {
  const [summary, setSummary] = useState(null)
  const [result, setResult] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [online, setOnline] = useState(true)
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState([])
  const [chosen, setChosen] = useState(null)
  const [busy, setBusy] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const lastCode = useRef({ code: "", at: 0 })
  const sending = useRef(false)
  const wedgeRef = useRef(null)

  const loadSummary = useCallback(() => api("/api/scan/summary").then(setSummary).catch((e) => setResult({ tone: "bad", title: e.message })), [])

  useEffect(() => {
    loadSummary()
    const timer = setInterval(loadSummary, 60_000)
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      clearInterval(timer)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [loadSummary])

  const submit = useCallback(async (body) => {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    try {
      const r = await api("/api/scan/checkin", { method: "POST", body })
      const tz = summary?.event?.timezone
      if (r.status === "accepted") {
        setResult({ tone: "ok", title: `Checked in · Day ${r.day}`, who: r.attendee.fullName, org: r.attendee.organization })
        beep(true)
      } else {
        setResult({ tone: "warn", title: `Already checked in today at ${formatTime(r.checkedInAt, tz)}`, who: r.attendee.fullName, org: r.attendee.organization })
        beep(false)
      }
      setChosen(null)
      setQuery("")
      loadSummary()
    } catch (error) {
      setResult({ tone: "bad", title: error.message })
      beep(false)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }, [loadSummary, summary])

  const onCode = useCallback((code) => {
    const now = Date.now()
    if (code === lastCode.current.code && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) return
    lastCode.current = { code, at: now }
    submit({ code })
  }, [submit])

  // Camera loop: decode a frame roughly 8 times a second.
  useEffect(() => {
    if (!cameraOn) return undefined
    let stopped = false
    let timer = null
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const tick = () => {
          if (stopped) return
          const canvas = canvasRef.current
          if (video.readyState >= 2 && canvas) {
            const size = Math.min(video.videoWidth, video.videoHeight)
            const scale = Math.min(1, 640 / size)
            canvas.width = Math.round(size * scale)
            canvas.height = Math.round(size * scale)
            const ctx = canvas.getContext("2d", { willReadFrequently: true })
            ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, canvas.width, canvas.height)
            const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" })
            if (found?.data) onCode(found.data)
          }
          timer = setTimeout(tick, 120)
        }
        tick()
      } catch (error) {
        setCameraError(error?.name === "NotAllowedError"
          ? "Camera access was blocked. Allow the camera for this site in the browser settings, or use search below."
          : "The camera couldn't start. Use search below, or a handheld scanner.")
        setCameraOn(false)
      }
    }
    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [cameraOn, onCode])

  // Desk search, debounced.
  useEffect(() => {
    if (query.trim().length < 2) return undefined
    const timer = setTimeout(() => {
      api(`/api/scan/search?q=${encodeURIComponent(query.trim())}`).then((r) => setMatches(r.results)).catch(() => setMatches([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" }).catch(() => {})
    window.location.href = "/login"
  }

  const w = summary?.window
  const visibleMatches = query.trim().length >= 2 ? matches : []
  return (
    <main className="scanner stack">
      <div className="row spread">
        <div>
          <p className="brand" style={{ color: "var(--teal-700)" }}>{summary?.event?.shortName || summary?.event?.name || "Scanner"}</p>
          {w?.day && <p className="muted small">Day {w.day} · {formatDate(w.date)}</p>}
        </div>
        <div className="row">
          {summary && <span className="pill ok num" title="Checked in today">{summary.checkedInToday} / {summary.total}</span>}
          <button className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {!online && <p className="notice bad">No connection. Scans can&apos;t be saved right now. Write names on the paper list; an admin will add them later.</p>}
      {w && !w.ok && <p className="notice warn">{w.message}</p>}

      {result && (
        <div className={`result ${result.tone}`} role="status" aria-live="assertive">
          <p style={{ fontWeight: 700 }}>{result.title}</p>
          {result.who && <p className="who">{result.who}</p>}
          {result.org && <p className="muted">{result.org}</p>}
        </div>
      )}

      <div className="camera">
        <video ref={videoRef} playsInline muted hidden={!cameraOn} />
        {cameraOn && <div className="frame" />}
        {!cameraOn && (
          <div className="idle">
            <div className="stack" style={{ alignItems: "center" }}>
              <p>Point the camera at the QR code on the tag or the attendee&apos;s phone.</p>
              <button className="accent" onClick={() => { setCameraError(""); setCameraOn(true) }}>Start camera</button>
              {cameraError && <p className="small">{cameraError}</p>}
            </div>
          </div>
        )}
        <canvas ref={canvasRef} hidden />
      </div>
      {cameraOn && <button className="secondary" onClick={() => setCameraOn(false)}>Stop camera</button>}

      <form className="card stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); const v = wedgeRef.current.value; wedgeRef.current.value = ""; if (v.trim()) onCode(v.trim()) }}>
        <label htmlFor="wedge">Handheld scanner or pasted code
          <input id="wedge" ref={wedgeRef} autoComplete="off" placeholder="Click here, then scan" />
        </label>
      </form>

      <div className="card stack">
        <h2>Can&apos;t scan? Find the attendee</h2>
        <label htmlFor="search">Name, organisation, email or phone
          <input id="search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setChosen(null) }} autoComplete="off" />
        </label>
        {visibleMatches.length > 0 && !chosen && (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6 }}>
            {visibleMatches.map((m) => (
              <li key={m.id}>
                <button className="secondary" style={{ width: "100%", justifyContent: "space-between" }} onClick={() => setChosen(m)}>
                  <span style={{ textAlign: "left" }}>{m.fullName}<br /><span className="muted small">{m.organization} {m.email}</span></span>
                  <span>Select</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && !visibleMatches.length && <p className="muted small">No one found. Check the spelling, or send them to the admin desk.</p>}
        {chosen && (
          <form className="stack" onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            submit({ attendeeId: chosen.id, reason: f.get("reason"), note: f.get("note") })
          }}>
            <p><strong>{chosen.fullName}</strong> <span className="muted">{chosen.organization}</span></p>
            <label htmlFor="reason">Why isn&apos;t the tag being scanned?
              <select id="reason" name="reason" required defaultValue="">
                <option value="" disabled>Choose a reason</option>
                {(summary?.reasons || []).filter((r) => r.value !== "paper_list").map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label htmlFor="note">Note (required for &ldquo;Other&rdquo;)<input id="note" name="note" maxLength={200} /></label>
            <div className="row">
              <button type="submit" disabled={busy}>Check in {chosen.fullName.split(" ")[0]}</button>
              <button type="button" className="secondary" onClick={() => setChosen(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      <p className="muted small">Signed in as {summary?.operator?.name}. Hand checks are logged with your name.</p>
    </main>
  )
}
