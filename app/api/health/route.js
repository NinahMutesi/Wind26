export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { json } from "@/lib/server/http.mjs"
import { listEvents } from "@/lib/server/services/events.mjs"

// Used by the post-deploy smoke test. Says only whether the app can reach its
// database with valid configuration, never why not.
export async function GET() {
  try {
    await listEvents()
    return json({ ok: true })
  } catch (error) {
    console.error("Health check failed", error)
    return json({ ok: false }, { status: 503 })
  }
}
