"use client"

// Small fetch wrapper for the browser. Errors carry the server's message,
// which is always written for the person using the app.
export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message)
    this.status = status
    this.code = code
    this.data = data
  }
}

export async function api(path, { method = "GET", body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    })
  } catch {
    throw new ApiError("No connection. Check the internet and try again.", 0, "offline")
  }
  if (response.status === 401 && typeof window !== "undefined") {
    // Full reload on purpose: it clears all in-memory data after sign-out or an expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login"
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(data?.error?.message || "Something went wrong. Try again.", response.status, data?.error?.code, data?.error)
  }
  return data
}

export { formatDate, formatTime } from "@/lib/shared/format.mjs"
