"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Icon from "./Icon"

// A modal dialog covers the page's toast, so pass the page's `message` to show errors inside it.
export default function Dialog({ open, title, onClose, children, wide = false, message = null }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title} className={wide ? "wide" : ""}>
      {open && (
        <div className="dialog-body">
          <div className="dialog-head">
            <h2>{title}</h2>
            <button type="button" className="ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
          {message && message.tone !== "ok" && <Notice message={message} />}
          {children}
        </div>
      )}
    </dialog>
  )
}

export function Notice({ message }) {
  if (!message) return null
  return <p className={`notice ${message.tone}`} role="status">{message.text}</p>
}

// Floating message for the result of an action. Errors stay until dismissed.
export function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message || message.tone === "bad" || message.tone === "info") return undefined
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [message, onClose])
  if (!message) return null
  return (
    <div className={`notice toast ${message.tone}`} role="status" aria-live="polite">
      <span>{message.text}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss"><Icon name="x" size={16} /></button>
    </div>
  )
}

// One busy flag and one message per page. run() shows progress, the result or the error.
export function useAction(reload) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const clear = useCallback(() => setMessage(null), [])
  const run = useCallback(async (action, success) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action((text) => setMessage({ tone: "info", text }))
      const text = typeof success === "function" ? success(result) : success
      if (text) setMessage(typeof text === "string" ? { tone: "ok", text } : text)
      if (reload) await reload()
      return result ?? true
    } catch (error) {
      setMessage({ tone: "bad", text: error.message })
      return null
    } finally {
      setBusy(false)
    }
  }, [reload])
  return { busy, message, setMessage, clear, run }
}

// Runs an action over items in batches and reports progress, so long jobs
// (emailing 70 badges) stay within request limits and show what's happening.
export async function inBatches(items, size, run, onProgress) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    results.push(...(await run(batch)))
    onProgress?.(Math.min(items.length, i + size), items.length)
  }
  return results
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
