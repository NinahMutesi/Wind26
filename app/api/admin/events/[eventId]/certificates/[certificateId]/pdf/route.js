export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route } from "@/lib/server/http.mjs"
import { adminContext, fileResponse } from "@/lib/server/context.mjs"
import { COLLECTIONS } from "@/lib/server/db/index.mjs"
import { notFound } from "@/lib/server/errors.mjs"
import { certificatePdf, fileSafe } from "@/lib/server/services/documents.mjs"

export const GET = route(async (_request, { eventId, certificateId }) => {
  const { db, event } = await adminContext(eventId)
  const certificate = await db.get(COLLECTIONS.certificates, certificateId)
  if (!certificate) throw notFound("Certificate not found.")
  return fileResponse(await certificatePdf(event, certificate), { type: "application/pdf", filename: `${fileSafe(certificate.nameOnCertificate)}-certificate.pdf` })
})
