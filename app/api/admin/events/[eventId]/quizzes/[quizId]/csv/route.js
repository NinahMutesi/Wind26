export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route } from "@/lib/server/http.mjs"
import { adminContext, fileResponse } from "@/lib/server/context.mjs"
import { fileSafe } from "@/lib/server/services/documents.mjs"
import { quizResultsCsv } from "@/lib/server/services/quizzes.mjs"

export const GET = route(async (_request, { eventId, quizId }) => {
  const { db, event } = await adminContext(eventId)
  const { title, csv } = await quizResultsCsv(db, quizId)
  return fileResponse("﻿" + csv, { type: "text/csv; charset=utf-8", filename: `${event.code}-${fileSafe(title)}-results.csv` })
})
