export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { emailTags } from "@/lib/server/services/documents.mjs"

// At most 10 per request; the admin page sends batches and shows progress.
export const POST = route(async (request, { eventId }) => {
  const { db, event, audit } = await adminContext(eventId)
  const body = await readJson(request)
  return json({ results: await emailTags(db, event, body.attendeeIds, { resend: body.resend === true }, audit) })
})
