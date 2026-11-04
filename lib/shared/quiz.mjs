import { cleanText } from "./validation.mjs"

export const QUIZ_LIMITS = Object.freeze({ questions: 100, minOptions: 2, maxOptions: 6, text: 500, option: 200, title: 120 })
const LETTERS = "ABCDEF"

// Reads multiple-choice questions pasted as plain text, e.g. from a Word document:
//
//   1. What converts rotation into electricity?
//   A. Rotor blade
//   B. Generator *          a trailing (or leading) * marks the correct option
//   Answer: B               or an answer line after the options
//
// An answer key at the end also works: a line "Answers" or "Answer key",
// followed by pairs such as "1 B", "2. C" or one value per line.
export function parseQuestions(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/ /g, " ").trim()).filter(Boolean)
  const questions = []
  const keyTokens = []
  let current = null
  let inKey = false

  for (const line of lines) {
    if (/^(answers?|answer key|key)\s*:?$/i.test(line)) { inKey = true; continue }
    if (inKey) { keyTokens.push(...(line.match(/\d+|\b[A-F]\b/gi) || [])); continue }

    let m = line.match(/^(?:answer|correct(?: answer)?)\s*[:\-]\s*([A-F])\b/i)
    if (m) { if (current) current.answer = LETTERS.indexOf(m[1].toUpperCase()); continue }

    m = line.match(/^(?:Q\s*)?(\d{1,3})\s*[.)]\s+(.+)$/i)
    if (m) { current = { number: Number(m[1]), text: m[2], options: [], answer: -1 }; questions.push(current); continue }

    m = line.match(/^(\*?)\s*([A-F])\s*[.)]\s+(.+?)\s*(\*?)$/i)
    if (m && current) {
      if (m[1] || m[4]) current.answer = current.options.length
      current.options.push(m[3])
      continue
    }
    // Text before the first option continues the question; anything else (module headings) is ignored.
    if (current && !current.options.length) current.text += ` ${line}`
  }

  for (let i = 0; i + 1 < keyTokens.length; i += 1) {
    if (!/^\d+$/.test(keyTokens[i]) || !/^[A-F]$/i.test(keyTokens[i + 1])) continue
    const q = questions.find((x) => x.number === Number(keyTokens[i]))
    if (q && q.answer < 0) q.answer = LETTERS.indexOf(keyTokens[i + 1].toUpperCase())
    i += 1
  }
  return questions.map(({ text: t, options, answer }) => ({ text: t, options, answer }))
}

// Returns cleaned questions and a list of problems, one line per question.
export function validateQuestions(input) {
  const errors = []
  const list = Array.isArray(input) ? input : []
  if (!list.length) errors.push("Add at least one question.")
  if (list.length > QUIZ_LIMITS.questions) errors.push(`A quiz can have at most ${QUIZ_LIMITS.questions} questions.`)
  const questions = list.slice(0, QUIZ_LIMITS.questions).map((q, i) => {
    const text = cleanText(q?.text, QUIZ_LIMITS.text)
    const options = (Array.isArray(q?.options) ? q.options : []).map((o) => cleanText(o, QUIZ_LIMITS.option)).filter(Boolean)
    const answer = Number(q?.answer)
    const n = i + 1
    if (!text) errors.push(`Question ${n} has no text.`)
    if (options.length < QUIZ_LIMITS.minOptions || options.length > QUIZ_LIMITS.maxOptions) {
      errors.push(`Question ${n} needs ${QUIZ_LIMITS.minOptions} to ${QUIZ_LIMITS.maxOptions} options.`)
    }
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) errors.push(`Question ${n} has no correct answer marked.`)
    return { text, options, answer }
  })
  return { ok: errors.length === 0, questions, errors }
}

export function validateQuizInput(input) {
  const title = cleanText(input?.title, QUIZ_LIMITS.title)
  const passMark = Number(input?.passMark ?? 50)
  const result = validateQuestions(input?.questions)
  const errors = [...result.errors]
  if (title.length < 2) errors.unshift("Give the quiz a title.")
  if (!Number.isInteger(passMark) || passMark < 0 || passMark > 100) errors.push("The pass mark must be a whole number from 0 to 100.")
  return { ok: errors.length === 0, value: { title, passMark, questions: result.questions }, errors }
}

// What an attendee sees: the questions without the answers.
export function publicQuestions(questions) {
  return questions.map((q) => ({ text: q.text, options: q.options }))
}

// Every question must be answered with the index of one of its options.
export function scoreAnswers(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) return { ok: false, message: "Answer every question before submitting." }
  let score = 0
  for (let i = 0; i < questions.length; i += 1) {
    const a = answers[i]
    if (!Number.isInteger(a) || a < 0 || a >= questions[i].options.length) return { ok: false, message: `Choose an answer for question ${i + 1}.` }
    if (a === questions[i].answer) score += 1
  }
  return { ok: true, score, total: questions.length, answers }
}

// The inverse of parseQuestions, for editing a saved quiz as text.
export function questionsToText(questions) {
  return questions.map((q, i) => [
    `${i + 1}. ${q.text}`,
    ...q.options.map((o, j) => `${LETTERS[j]}. ${o}`),
    `Answer: ${LETTERS[q.answer] || ""}`,
  ].join("\n")).join("\n\n")
}

export const percent = (score, total) => (total ? Math.round((score / total) * 100) : 0)
export const optionLetter = (i) => LETTERS[i] || "?"
