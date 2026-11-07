import "server-only"
import { currentStaff, requireAdmin, requireScanner } from "./auth.mjs"
import { eventScope } from "./db/index.mjs"
import { env } from "./env.mjs"
import { getEvent, getLiveEvent } from "./services/events.mjs"
import { auditFor } from "./services/audit.mjs"

// Every route gets its event-scoped database handle from here. The event comes
// from the URL for admins and from the scanner's own account for scanners.

export async function adminContext(eventId) {
  const admin = await requireAdmin()
  const event = await getEvent(eventId)
  const db = eventScope(event.$id)
  return { admin, event, db, audit: auditFor(db, admin) }
}

export async function scannerContext() {
  // Scanner helpers scan for their own event. With open or password access the admin
  // can scan too, for the one live event.
  const staff = await currentStaff()
  const operator = staff?.role === "scanner" || env().adminAccess === "signin" ? await requireScanner() : await requireAdmin()
  const event = operator.eventId ? await getEvent(operator.eventId) : await getLiveEvent()
  const db = eventScope(event.$id)
  return { operator, event, db }
}

export function fileResponse(bytes, { type, filename, inline = false, cache = "no-store" }) {
  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
