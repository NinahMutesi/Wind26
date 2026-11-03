"use client"

import { useEffect, useRef } from "react"

export default function Dialog({ open, title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}>
      {open && (
        <div className="card stack">
          <div className="row spread">
            <h2>{title}</h2>
            <button type="button" className="link" onClick={onClose}>Close</button>
          </div>
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

// Runs an action over items in batches and reports progress, so long jobs
// (emailing 60 tags) stay within request limits and show what's happening.
export async function inBatches(items, size, run, onProgress) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    results.push(...(await run(batch)))
    onProgress?.(Math.min(items.length, i + size), items.length)
  }
  return results
}
