"use client"

import { useState } from "react"
import { api } from "@/components/api"

const LETTERS = "ABCDEF"

export default function QuizForm({ tagId, quiz, initialResult }) {
  const [answers, setAnswers] = useState(() => quiz.questions.map(() => -1))
  const [result, setResult] = useState(initialResult)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const answered = answers.filter((a) => a >= 0).length

  if (result) {
    const passed = result.percent >= quiz.passMark
    return (
      <div className={`score-card ${passed ? "ok" : "warn"}`} role="status">
        <span className="score">{result.percent}%</span>
        <span>{result.score} of {result.total} correct</span>
        <span className="muted small">Your answers have been recorded. Thank you.</span>
      </div>
    )
  }
  if (quiz.status !== "open") return <p className="notice warn">This quiz is closed.</p>

  async function submit(e) {
    e.preventDefault()
    const missing = answers.findIndex((a) => a < 0)
    if (missing >= 0) {
      setError(`Answer question ${missing + 1} before submitting.`)
      document.getElementById(`q-${missing}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setBusy(true)
    setError("")
    try {
      setResult(await api(`/api/public/quizzes/${tagId}/${quiz.id}`, { method: "POST", body: { answers } }))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {quiz.questions.map((q, i) => (
        <fieldset key={i} id={`q-${i}`} className="question">
          <legend><span className="qnum">{i + 1}</span>{q.text}</legend>
          {q.options.map((option, j) => (
            <label key={j} className={`option ${answers[i] === j ? "chosen" : ""}`}>
              <input type="radio" name={`q${i}`} checked={answers[i] === j}
                onChange={() => setAnswers((prev) => prev.map((a, k) => (k === i ? j : a)))} />
              <span className="letter">{LETTERS[j]}</span>
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="submit-bar">
        <span className="muted small">{answered} of {quiz.questions.length} answered</span>
        <button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit answers"}</button>
      </div>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <p className="muted small">You can submit once.</p>
    </form>
  )
}
