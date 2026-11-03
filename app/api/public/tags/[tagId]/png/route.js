export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { fileResponse } from "@/lib/server/context.mjs"
import { errorResponse } from "@/lib/server/http.mjs"
import { notFound } from "@/lib/server/errors.mjs"
import { fileSafe, findPublicTag, tagPng } from "@/lib/server/services/documents.mjs"

export async function GET(request, context) {
  try {
    const { tagId } = await context.params
    const found = await findPublicTag(tagId)
    if (!found) throw notFound("Tag not found.")
    const download = new URL(request.url).searchParams.get("download") === "1"
    return fileResponse(tagPng(found.event, found.attendee), {
      type: "image/png",
      filename: `${fileSafe(found.attendee.fullName)}-tag.png`,
      inline: !download,
      cache: "private, max-age=300",
    })
  } catch (error) {
    return errorResponse(error)
  }
}
