export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { emailCertificates } from "@/lib/server/services/documents.mjs"

export const POST = route(async (request, { eventId }) => {
  const { db, event, audit } = await adminContext(eventId)
  const body = await readJson(request)
  return json({ results: await emailCertificates(db, event, body.certificateIds, { resend: body.resend === true }, audit) })
})
