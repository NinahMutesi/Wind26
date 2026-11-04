import "server-only"
import { NextResponse } from "next/server"
import { AppError, badRequest, forbidden } from "./errors.mjs"
import { env } from "./env.mjs"

const MAX_JSON_BYTES = 1_500_000 // enough for a 1,000-row CSV import

export function json(data, init = {}) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers || {}) } })
}

export function errorResponse(error) {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.message, ...error.extra } }, { status: error.status })
  }
  if (error?.status === 409 && error?.name === "AppwriteError") {
    return json({ error: { code: "conflict", message: "This record changed while you were working. Refresh and try again." } }, { status: 409 })
  }
  // Setup problems get a message that says what to fix. They never include the key itself.
  if (error?.name === "AppwriteError" && [401, 403].includes(error.status)) {
    console.error(error.message)
    return json({ error: { code: "database_access", message: "The server's database key is missing permissions. Give APPWRITE_API_KEY the rows.read and rows.write scopes." } }, { status: 503 })
  }
  if (error?.name === "AppwriteError" && /^(database|collection|table|attribute|column)_not_found$/.test(error.type || "")) {
    console.error(error.message)
    return json({ error: { code: "database_setup", message: "The database isn't set up yet. Run: npm run db:setup -- --apply" } }, { status: 503 })
  }
  console.error(error)
  return json({ error: { code: "server_error", message: "Something went wrong on our side. Try again, and tell the event admin if it keeps happening." } }, { status: 500 })
}

// Blocks cross-site form posts and scripted requests from other origins.
// Session cookies are also SameSite=Strict; this is a second, independent check.
export function assertSameOrigin(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return
  const origin = request.headers.get("origin")
  if (!origin || !allowedOrigins().has(origin)) throw forbidden("This request came from an unexpected site.")
}

// In development, localhost and 127.0.0.1 are the same computer: `next dev -H 127.0.0.1`
// prints the 127.0.0.1 address, while APP_URL usually says localhost.
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"]
function allowedOrigins() {
  const { appUrl, production } = env()
  const url = new URL(appUrl)
  if (production || !LOOPBACK.includes(url.hostname)) return new Set([appUrl])
  return new Set(LOOPBACK.map((host) => `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`))
}

export async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0)
  if (length > MAX_JSON_BYTES) throw badRequest("The request is too large.")
  const text = await request.text()
  if (text.length > MAX_JSON_BYTES) throw badRequest("The request is too large.")
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw badRequest("The request body isn't valid JSON.")
  }
}

export function route(handler) {
  return async (request, context) => {
    try {
      assertSameOrigin(request)
      const params = context?.params ? await context.params : {}
      return await handler(request, params)
    } catch (error) {
      return errorResponse(error)
    }
  }
}

// Vercel sets x-real-ip itself, so a visitor can't choose it.
export function clientIp(request) {
  return request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
}
