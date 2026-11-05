export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { scannerContext } from "@/lib/server/context.mjs"
import { scannerSummary } from "@/lib/server/services/checkins.mjs"
import { publicEvent } from "@/lib/server/services/events.mjs"
import { MANUAL_REASONS } from "@/lib/shared/validation.mjs"

export const GET = route(async () => {
  const { operator, event, db } = await scannerContext()
  const summary = await scannerSummary(db, event, operator)
  return json({ operator: { name: operator.name }, event: publicEvent(event), reasons: MANUAL_REASONS, ...summary })
})
