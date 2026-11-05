import Link from "next/link"
import { notFound } from "next/navigation"
import { findPublicTag } from "@/lib/server/services/documents.mjs"
import { openQuizzesForTag } from "@/lib/server/services/quizzes.mjs"
import { formatDate } from "@/lib/shared/format.mjs"

export const dynamic = "force-dynamic"
const WHEN = { pre: "Before the training · ", post: "After the training · ", other: "" }
export const metadata = { title: "Your event badge", robots: { index: false, follow: false }, referrer: "no-referrer" }

// The attendee's digital badge. Shows only what is printed on the badge, plus any open quiz.
export default async function TagPage({ params }) {
  const { tagId } = await params
  const found = await findPublicTag(tagId)
  if (!found) notFound()
  const { event, attendee } = found
  const quizzes = await openQuizzesForTag(event, attendee)
  return (
    <main className="public stack">
      <header className="stack" style={{ gap: 2 }}>
        <p className="eyebrow">{event.shortName || event.name}</p>
        <h1>{attendee.fullName}</h1>
        <p className="muted small">{formatDate(event.startDate)} – {formatDate(event.endDate)}{event.venue ? ` · ${event.venue}` : ""}</p>
      </header>

      {quizzes.map((q) => (
        <Link key={q.id} className="quiz-link" href={`/t/${attendee.tagId}/quiz/${q.id}`}>
          <span>
            <strong>{q.title}</strong>
            <span className="muted small">{WHEN[q.kind]}{q.done ? `Submitted · ${q.percent}%` : `${q.questionCount} questions`}</span>
          </span>
          <span className="button">{q.done ? "View" : "Start"}</span>
        </Link>
      ))}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tag-image" src={`/api/public/tags/${attendee.tagId}/png`} width={1240} height={1748} alt={`Badge for ${attendee.fullName}`} />
      <p className="muted small">Show the QR code at the registration desk each morning.</p>
      <a className="button secondary" href={`/api/public/tags/${attendee.tagId}/png?download=1`}>Save badge</a>
    </main>
  )
}
