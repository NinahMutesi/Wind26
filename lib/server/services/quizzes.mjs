import "server-only"
import crypto from "node:crypto"
import { COLLECTIONS, Query, eventScope } from "../db/index.mjs"
import { badRequest, conflict, notFound } from "../errors.mjs"
import { newDocId } from "./events.mjs"
import { findPublicTag } from "./documents.mjs"
import { csvCell } from "../../shared/attendance.mjs"
import { percent, publicQuestions, scoreAnswers, validateQuizInput } from "../../shared/quiz.mjs"
import { cleanText } from "../../shared/validation.mjs"

const STATUS_FLOW = { draft: ["open"], open: ["closed"], closed: ["open"] }

// One response per attendee per quiz, enforced by the document ID.
export function responseDocId(eventId, quizId, attendeeId) {
  return crypto.createHash("sha256").update(`quiz:${eventId}:${quizId}:${attendeeId}`).digest("hex").slice(0, 32)
}

const readQuestions = (quiz) => JSON.parse(quiz.questions)

function summary(quiz, responses) {
  const scores = responses.map((r) => percent(r.score, r.total))
  return {
    id: quiz.$id, title: quiz.title, status: quiz.status, questionCount: quiz.questionCount, passMark: quiz.passMark,
    openedAt: quiz.openedAt || null, closedAt: quiz.closedAt || null,
    responses: responses.length,
    average: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null,
    passed: scores.filter((s) => s >= quiz.passMark).length,
  }
}

export async function listQuizzes(db) {
  const [quizzes, responses] = await Promise.all([db.listAll(COLLECTIONS.quizzes), db.listAll(COLLECTIONS.quizResponses)])
  return quizzes
    .sort((a, b) => String(a.$createdAt).localeCompare(String(b.$createdAt)))
    .map((q) => summary(q, responses.filter((r) => r.quizId === q.$id)))
}

async function loadQuiz(db, quizId) {
  const quiz = await db.get(COLLECTIONS.quizzes, cleanText(quizId, 36))
  if (!quiz) throw notFound("Quiz not found.")
  return quiz
}

function checked(input) {
  const result = validateQuizInput(input)
  if (!result.ok) throw badRequest(result.errors[0], "invalid_quiz", { problems: result.errors })
  return result.value
}

export async function createQuiz(db, input, audit) {
  const value = checked(input)
  const doc = await db.create(COLLECTIONS.quizzes, newDocId(), {
    title: value.title, status: "draft", passMark: value.passMark,
    questions: JSON.stringify(value.questions), questionCount: value.questions.length,
  })
  await audit({ action: "quiz.create", targetId: doc.$id, details: { title: value.title, questions: value.questions.length } })
  return summary(doc, [])
}

// Questions are fixed once anyone can answer, so every response is scored against the same quiz.
export async function updateQuiz(db, quizId, input, audit) {
  const quiz = await loadQuiz(db, quizId)
  if (quiz.status !== "draft") throw conflict("Questions can only be changed while the quiz is a draft.")
  if (await db.count(COLLECTIONS.quizResponses, [Query.equal("quizId", quiz.$id)])) throw conflict("This quiz already has responses.")
  const value = checked(input)
  const updated = await db.update(COLLECTIONS.quizzes, quiz.$id, {
    title: value.title, passMark: value.passMark, questions: JSON.stringify(value.questions), questionCount: value.questions.length,
  })
  await audit({ action: "quiz.update", targetId: quiz.$id, details: { title: value.title, questions: value.questions.length } })
  return summary(updated, [])
}

export async function setQuizStatus(db, quizId, status, audit) {
  const quiz = await loadQuiz(db, quizId)
  if (!(STATUS_FLOW[quiz.status] || []).includes(status)) throw badRequest(`A quiz that is ${quiz.status} can't be moved to ${status}.`)
  const now = new Date().toISOString()
  await db.update(COLLECTIONS.quizzes, quiz.$id, status === "open" ? { status, openedAt: now, closedAt: null } : { status, closedAt: now })
  await audit({ action: `quiz.${status === "open" ? "open" : "close"}`, targetId: quiz.$id, details: { title: quiz.title } })
}

export async function deleteQuiz(db, quizId, audit) {
  const quiz = await loadQuiz(db, quizId)
  if (await db.count(COLLECTIONS.quizResponses, [Query.equal("quizId", quiz.$id)])) {
    throw conflict("This quiz has responses, so it can't be deleted. Close it instead.")
  }
  await db.remove(COLLECTIONS.quizzes, quiz.$id)
  await audit({ action: "quiz.delete", targetId: quiz.$id, details: { title: quiz.title } })
}

// Admin view: the full quiz with answers, each response, and how many got each question right.
export async function quizResults(db, quizId) {
  const quiz = await loadQuiz(db, quizId)
  const [responses, attendees] = await Promise.all([
    db.listAll(COLLECTIONS.quizResponses, [Query.equal("quizId", quiz.$id)]),
    db.listAll(COLLECTIONS.attendees),
  ])
  const questions = readQuestions(quiz)
  const byId = new Map(attendees.map((a) => [a.$id, a]))
  const answers = responses.map((r) => JSON.parse(r.answers))
  return {
    quiz: { ...summary(quiz, responses), questions },
    responses: responses
      .map((r) => {
        const a = byId.get(r.attendeeId)
        return {
          attendeeId: r.attendeeId, fullName: a?.fullName || "Removed attendee", organization: a?.organization || "",
          score: r.score, total: r.total, percent: percent(r.score, r.total), passed: percent(r.score, r.total) >= quiz.passMark,
          submittedAt: r.submittedAt,
        }
      })
      .sort((x, y) => y.percent - x.percent || x.fullName.localeCompare(y.fullName)),
    perQuestion: questions.map((q, i) => ({
      correct: answers.filter((a) => a[i] === q.answer).length,
      answered: answers.length,
    })),
  }
}

export async function quizResultsCsv(db, quizId) {
  const { quiz, responses } = await quizResults(db, quizId)
  const lines = [["Name", "Organisation", "Score", "Out of", "Percent", "Passed", "Submitted"].map(csvCell).join(",")]
  for (const r of responses) {
    lines.push([r.fullName, r.organization, r.score, r.total, r.percent, r.passed ? "Yes" : "No", r.submittedAt].map(csvCell).join(","))
  }
  return { title: quiz.title, csv: lines.join("\r\n") + "\r\n" }
}

// Attendees reach quizzes through their own tag link, so the tag UUID identifies them.
export async function openQuizzesForTag(event, attendee) {
  const db = eventScope(event.$id)
  const quizzes = await db.listAll(COLLECTIONS.quizzes, [Query.equal("status", "open")])
  const result = []
  for (const q of quizzes) {
    const response = await db.get(COLLECTIONS.quizResponses, responseDocId(event.$id, q.$id, attendee.$id))
    result.push({ id: q.$id, title: q.title, questionCount: q.questionCount, done: Boolean(response), percent: response ? percent(response.score, response.total) : null })
  }
  return result
}

export async function findPublicQuiz(tagId, quizId) {
  const found = await findPublicTag(tagId)
  if (!found) return null
  const { event, attendee } = found
  const db = eventScope(event.$id)
  const quiz = await db.get(COLLECTIONS.quizzes, cleanText(quizId, 36))
  if (!quiz || quiz.status === "draft") return null
  const response = await db.get(COLLECTIONS.quizResponses, responseDocId(event.$id, quiz.$id, attendee.$id))
  return {
    event, attendee,
    quiz: { id: quiz.$id, title: quiz.title, status: quiz.status, passMark: quiz.passMark, questions: publicQuestions(readQuestions(quiz)) },
    result: response ? { score: response.score, total: response.total, percent: percent(response.score, response.total) } : null,
  }
}

export async function submitQuiz(tagId, quizId, answersInput) {
  const found = await findPublicTag(tagId)
  if (!found) throw notFound("This link isn't valid.")
  return recordResponse(eventScope(found.event.$id), found.attendee, quizId, answersInput)
}

export async function recordResponse(db, attendee, quizId, answersInput) {
  const quiz = await db.get(COLLECTIONS.quizzes, cleanText(quizId, 36))
  if (!quiz || quiz.status === "draft") throw notFound("Quiz not found.")
  if (quiz.status !== "open") throw conflict("This quiz is closed.", "quiz_closed")
  const scored = scoreAnswers(readQuestions(quiz), answersInput)
  if (!scored.ok) throw badRequest(scored.message)
  const result = { score: scored.score, total: scored.total, percent: percent(scored.score, scored.total) }
  try {
    await db.create(COLLECTIONS.quizResponses, responseDocId(db.eventId, quiz.$id, attendee.$id), {
      quizId: quiz.$id, attendeeId: attendee.$id, answers: JSON.stringify(scored.answers),
      score: scored.score, total: scored.total, submittedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error?.status !== 409) throw error
    throw conflict("You have already submitted this quiz.", "already_submitted")
  }
  return { ...result, passed: result.percent >= quiz.passMark }
}
