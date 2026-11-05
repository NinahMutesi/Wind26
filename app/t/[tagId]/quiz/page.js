import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { findPublicTag } from "@/lib/server/services/documents.mjs"
import { openQuizzesForTag } from "@/lib/server/services/quizzes.mjs"
import { formatDate } from "@/lib/shared/format.mjs"
import { quizOpenFrom } from "@/lib/shared/quiz.mjs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Quiz", robots: { index: false, follow: false }, referrer: "no-referrer" }

// The quiz link in the badge email. It never changes: it says when the quiz opens,
// goes straight to the quiz when one is open, and lists them when there are several.
export default async function QuizEntryPage({ params }) {
  const { tagId } = await params
  const found = await findPublicTag(tagId)
  if (!found) notFound()
  const { event, attendee } = found
  const quizzes = await openQuizzesForTag(event, attendee)
  if (quizzes.length === 1) redirect(`/t/${attendee.tagId}/quiz/${quizzes[0].id}`)
  const opening = quizOpenFrom(event)

  return (
    <main className="public stack">
      <header className="stack" style={{ gap: 2 }}>
        <p className="eyebrow">{event.shortName || event.name}</p>
        <h1>Quiz</h1>
        <p className="muted small">{attendee.fullName}</p>
      </header>

      {quizzes.length === 0 && (
        <p className="notice info">
          {opening.allowed
            ? "There is no quiz open right now. Please come back to this link when the facilitator asks you to."
            : `The quiz opens at ${opening.time} on ${formatDate(opening.date)}. Please come back to this link then.`}
        </p>
      )}

      {quizzes.map((q) => (
        <Link key={q.id} className="quiz-link" href={`/t/${attendee.tagId}/quiz/${q.id}`}>
          <span>
            <strong>{q.title}</strong>
            <span className="muted small">{q.done ? `Submitted · ${q.percent}%` : `${q.questionCount} questions`}</span>
          </span>
          <span className="button">{q.done ? "View" : "Start"}</span>
        </Link>
      ))}

      <Link className="muted small" href={`/t/${attendee.tagId}`}>Go to my badge</Link>
    </main>
  )
}
