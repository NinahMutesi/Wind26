export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { createQuiz, listQuizzes } from "@/lib/server/services/quizzes.mjs"

export const GET = route(async (_request, { eventId }) => {
  const { db } = await adminContext(eventId)
  return json({ quizzes: await listQuizzes(db) })
})

export const POST = route(async (request, { eventId }) => {
  const { db, audit } = await adminContext(eventId)
  return json({ quiz: await createQuiz(db, await readJson(request), audit) })
})
