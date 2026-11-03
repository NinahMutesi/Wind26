export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { adminCheckin, removeCheckin } from "@/lib/server/services/checkins.mjs"

export const POST = route(async (request, { eventId }) => {
  const { db, event, admin, audit } = await adminContext(eventId)
  return json(await adminCheckin(db, event, admin, await readJson(request), audit))
})

export const DELETE = route(async (request, { eventId }) => {
  const { db, audit } = await adminContext(eventId)
  const body = await readJson(request)
  await removeCheckin(db, body.attendeeId, body.day, body.reason, audit)
  return json({ ok: true })
})
