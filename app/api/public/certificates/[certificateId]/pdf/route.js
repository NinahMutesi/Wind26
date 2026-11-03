export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { fileResponse } from "@/lib/server/context.mjs"
import { errorResponse } from "@/lib/server/http.mjs"
import { notFound } from "@/lib/server/errors.mjs"
import { certificatePdf, fileSafe, findPublicCertificate } from "@/lib/server/services/documents.mjs"

export async function GET(_request, context) {
  try {
    const { certificateId } = await context.params
    const found = await findPublicCertificate(certificateId)
    if (!found || found.certificate.status !== "issued") throw notFound("Certificate not found.")
    return fileResponse(await certificatePdf(found.event, found.certificate), {
      type: "application/pdf",
      filename: `${fileSafe(found.certificate.nameOnCertificate)}-certificate.pdf`,
      cache: "private, max-age=300",
    })
  } catch (error) {
    return errorResponse(error)
  }
}
