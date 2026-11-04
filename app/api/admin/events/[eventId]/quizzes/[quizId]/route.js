export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { adminContext } from "@/lib/server/context.mjs"
import { deleteQuiz, quizResults, setQuizStatus, updateQuiz } from "@/lib/server/services/quizzes.mjs"

export const GET = route(async (_request, { eventId, quizId }) => {
  const { db } = await adminContext(eventId)
  return json(await quizResults(db, quizId))
})

// Body: { title, passMark, questions } to edit a draft.
export const PUT = route(async (request, { eventId, quizId }) => {
  const { db, audit } = await adminContext(eventId)
  return json({ quiz: await updateQuiz(db, quizId, await readJson(request), audit) })
})

// Body: { status: "open" | "closed" }.
export const PATCH = route(async (request, { eventId, quizId }) => {
  const { db, event, audit } = await adminContext(eventId)
  const body = await readJson(request)
  await setQuizStatus(db, event, quizId, String(body.status || ""), audit)
  return json({ ok: true })
})

export const DELETE = route(async (_request, { eventId, quizId }) => {
  const { db, audit } = await adminContext(eventId)
  await deleteQuiz(db, quizId, audit)
  return json({ ok: true })
})
