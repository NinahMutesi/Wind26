export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { scannerContext } from "@/lib/server/context.mjs"
import { searchAttendees } from "@/lib/server/services/attendees.mjs"

export const GET = route(async (request) => {
  const { db } = await scannerContext()
  return json({ results: await searchAttendees(db, new URL(request.url).searchParams.get("q")) })
})
