export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { COLLECTIONS, Query } from "@/lib/server/db/index.mjs"

export const GET = route(async (_request, { eventId }) => {
  const { db } = await adminContext(eventId)
  const result = await db.list(COLLECTIONS.audit, [Query.orderDesc("at"), Query.limit(100)])
  return json({
    entries: (result?.documents || []).map((e) => ({ id: e.$id, action: e.action, targetId: e.targetId || "", at: e.at, details: safeParse(e.details) })),
  })
})

function safeParse(text) {
  try {
    return JSON.parse(text || "{}")
  } catch {
    return {}
  }
}
