export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { addScanner, listScanners } from "@/lib/server/services/staff.mjs"

export const GET = route(async (_request, { eventId }) => {
  const { event } = await adminContext(eventId)
  return json({ scanners: await listScanners(event.$id) })
})

export const POST = route(async (request, { eventId }) => {
  const { event, admin, audit } = await adminContext(eventId)
  return json({ scanner: await addScanner(event.$id, await readJson(request), admin, audit) }, { status: 201 })
})
