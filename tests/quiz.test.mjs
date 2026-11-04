import test from "node:test"
import assert from "node:assert/strict"
import { createEventScope } from "../lib/server/db/stores.mjs"
import { COLLECTIONS } from "../lib/server/db/schema.mjs"
import { createQuiz, quizResults, recordResponse, setQuizStatus, updateQuiz } from "../lib/server/services/quizzes.mjs"
import { parseQuestions, publicQuestions, questionsToText, scoreAnswers, validateQuizInput } from "../lib/shared/quiz.mjs"
import { memoryStore } from "./memory-store.mjs"

const noAudit = async () => {}
const QUESTIONS = [
  { text: "Which part makes electricity?", options: ["Blade", "Generator", "Tower"], answer: 1 },
  { text: "What drives a wind turbine?", options: ["Moving air", "Sunlight"], answer: 0 },
]

test("questions are read from pasted text with answer lines, stars or an answer key", () => {
  const withLines = parseQuestions("Module 1\n1. Which part makes electricity?\nA. Blade\nB. Generator\nC. Tower\nAnswer: B\n\n2. What drives a wind turbine?\nA) Moving air\nB) Sunlight\nAnswer: A")
  assert.deepEqual(withLines, QUESTIONS)
  const withStars = parseQuestions("1. Which part makes electricity?\nA. Blade\nB. Generator *\nC. Tower\n2. What drives a wind turbine?\n*A. Moving air\nB. Sunlight")
  assert.deepEqual(withStars, QUESTIONS)
  // The Word document's answer table pastes as one value per line.
  const withKey = parseQuestions("1. Which part makes electricity?\nA. Blade\nB. Generator\nC. Tower\n2. What drives a wind turbine?\nA. Moving air\nB. Sunlight\nAnswer key\n1\nB\n2\nA")
  assert.deepEqual(withKey, QUESTIONS)
  assert.deepEqual(parseQuestions(questionsToText(QUESTIONS)), QUESTIONS)
})

test("a quiz needs a title, options and a marked answer for every question", () => {
  assert.equal(validateQuizInput({ title: "Post-test", passMark: 50, questions: QUESTIONS }).ok, true)
  const missing = validateQuizInput({ title: "Post-test", passMark: 50, questions: [{ text: "Q", options: ["A", "B"], answer: -1 }] })
  assert.match(missing.errors.join(" "), /no correct answer/)
  assert.match(validateQuizInput({ title: "", passMark: 50, questions: QUESTIONS }).errors.join(" "), /title/)
  assert.match(validateQuizInput({ title: "T", passMark: 50, questions: [{ text: "Q", options: ["only one"], answer: 0 }] }).errors.join(" "), /2 to 6 options/)
})

test("scoring needs every question answered with a real option", () => {
  assert.deepEqual(scoreAnswers(QUESTIONS, [1, 0]), { ok: true, score: 2, total: 2, answers: [1, 0] })
  assert.equal(scoreAnswers(QUESTIONS, [1, 1]).score, 1)
  assert.equal(scoreAnswers(QUESTIONS, [1]).ok, false)
  assert.equal(scoreAnswers(QUESTIONS, [1, 5]).ok, false)
  assert.equal(scoreAnswers(QUESTIONS, ["1", 0]).ok, false)
})

const STARTED = { startDate: "2020-01-01", timezone: "Africa/Kampala" }

async function setup() {
  const store = memoryStore()
  const a = createEventScope(store, "eventA")
  const b = createEventScope(store, "eventB")
  const grace = await a.create(COLLECTIONS.attendees, "grace", { fullName: "Grace Achieng", tagId: "t1", role: "participant" })
  const quiz = await createQuiz(a, { title: "Post-test", passMark: 50, questions: QUESTIONS }, noAudit)
  return { store, a, b, grace, quiz }
}

test("attendees answer an open quiz once, scored on the server", async () => {
  const { a, grace, quiz } = await setup()
  await assert.rejects(recordResponse(a, grace, quiz.id, [1, 0]), /Quiz not found/, "a draft quiz can't be answered")
  await setQuizStatus(a, STARTED, quiz.id, "open", noAudit)
  const { review, ...score } = await recordResponse(a, grace, quiz.id, [1, 1])
  assert.deepEqual(score, { score: 1, total: 2, percent: 50, passed: true })
  assert.deepEqual(review.map((q) => [q.chosen, q.answer]), [[1, 1], [1, 0]], "after submitting, they see their answer and the right one")
  await assert.rejects(recordResponse(a, grace, quiz.id, [1, 0]), /already submitted/)
  const results = await quizResults(a, quiz.id)
  assert.equal(results.responses.length, 1)
  assert.deepEqual(results.perQuestion, [{ correct: 1, answered: 1 }, { correct: 0, answered: 1 }])
  await setQuizStatus(a, STARTED, quiz.id, "closed", noAudit)
  const peter = await a.create(COLLECTIONS.attendees, "peter", { fullName: "Peter Okello", tagId: "t2", role: "participant" })
  await assert.rejects(recordResponse(a, peter, quiz.id, [1, 0]), /closed/)
})

test("questions are locked once a quiz has been opened", async () => {
  const { a, quiz } = await setup()
  await updateQuiz(a, quiz.id, { title: "Pre-test", passMark: 60, questions: QUESTIONS }, noAudit)
  await setQuizStatus(a, STARTED, quiz.id, "open", noAudit)
  await assert.rejects(updateQuiz(a, quiz.id, { title: "Changed", passMark: 60, questions: QUESTIONS }, noAudit), /draft/)
  await assert.rejects(setQuizStatus(a, STARTED, quiz.id, "draft", noAudit), /can't be moved/)
})

test("another event's quiz can't be seen or answered", async () => {
  const { b, grace, quiz, store } = await setup()
  await setQuizStatus(createEventScope(store, "eventA"), STARTED, quiz.id, "open", noAudit)
  await assert.rejects(recordResponse(b, grace, quiz.id, [1, 0]), /Quiz not found/)
  await assert.rejects(quizResults(b, quiz.id), /Quiz not found/)
  assert.equal([...store.data.get(COLLECTIONS.quizResponses)?.values() || []].length, 0)
})

test("a quiz can't be opened before the first day of the event", async () => {
  const { a, quiz } = await setup()
  const event = { startDate: "2026-11-10", timezone: "Africa/Kampala" }
  // 23:30 in Kampala on 9 Nov is 20:30 UTC.
  await assert.rejects(setQuizStatus(a, event, quiz.id, "open", noAudit, new Date("2026-11-09T20:30:00Z")), /opened from/)
  assert.equal((await a.get(COLLECTIONS.quizzes, quiz.id)).status, "draft")
  await setQuizStatus(a, event, quiz.id, "open", noAudit, new Date("2026-11-09T21:05:00Z"))
  assert.equal((await a.get(COLLECTIONS.quizzes, quiz.id)).status, "open")
})

test("the public quiz never carries the answers", () => {
  const shown = publicQuestions(QUESTIONS)
  assert.ok(shown.every((q) => !("answer" in q)))
})
