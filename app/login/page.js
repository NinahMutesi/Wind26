"use client"

import { useState } from "react"
import { api } from "@/components/api"

export default function LoginPage() {
  const [step, setStep] = useState("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function requestCode(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await api("/api/auth/request-code", { method: "POST", body: { email } })
      setMessage({ tone: "info", text: result.message })
      setStep("code")
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function verify(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await api("/api/auth/verify-code", { method: "POST", body: { email, code } })
      window.location.href = result.redirectTo
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
      setBusy(false)
    }
  }

  return (
    <main className="wrap narrow stack" style={{ paddingTop: 56 }}>
      <p className="brand" style={{ color: "var(--teal-700)" }}>NREP <span>Events</span></p>
      <h1>Staff sign in</h1>
      {message && <p className={`notice ${message.tone}`} role="status">{message.text}</p>}

      {step === "email" ? (
        <form className="card stack" onSubmit={requestCode}>
          <label htmlFor="email">
            Work email
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
        </form>
      ) : (
        <form className="card stack" onSubmit={verify}>
          <p className="muted small">We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.</p>
          <label htmlFor="code">
            Sign-in code
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ fontSize: "1.4rem", letterSpacing: "0.3em" }}
            />
          </label>
          <button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="link" onClick={() => { setStep("email"); setCode(""); setMessage(null) }}>
            Use a different email or request a new code
          </button>
        </form>
      )}
    </main>
  )
}
