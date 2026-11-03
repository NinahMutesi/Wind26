export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { setCertificateStatus } from "@/lib/server/services/certificates.mjs"

// { action: "revoke" | "restore" | "refresh_name", reason }
export const POST = route(async (request, { eventId, certificateId }) => {
  const { db, audit } = await adminContext(eventId)
  const body = await readJson(request)
  await setCertificateStatus(db, certificateId, String(body.action || ""), body.reason, audit)
  return json({ ok: true })
})
