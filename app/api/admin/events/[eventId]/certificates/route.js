export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { issueCertificates } from "@/lib/server/services/certificates.mjs"

export const POST = route(async (request, { eventId }) => {
  const { db, event, admin, audit } = await adminContext(eventId)
  const body = await readJson(request)
  return json({ results: await issueCertificates(db, event, admin, body.attendeeIds, audit) })
})
