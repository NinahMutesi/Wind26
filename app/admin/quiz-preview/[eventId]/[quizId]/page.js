import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { currentStaff } from "@/lib/server/auth.mjs"
import { eventScope } from "@/lib/server/db/index.mjs"
import { getEvent } from "@/lib/server/services/events.mjs"
import { previewQuiz } from "@/lib/server/services/quizzes.mjs"
import QuizForm from "@/components/quiz/QuizForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Quiz preview", robots: { index: false, follow: false } }

export default async function QuizPreviewPage({ params }) {
  const staff = await currentStaff()
  if (!staff) redirect("/login")
  if (staff.role !== "admin") redirect("/scan")
  const { eventId, quizId } = await params
  let event, quiz
  try {
    event = await getEvent(eventId)
    quiz = await previewQuiz(eventScope(event.$id), quizId)
  } catch (error) {
    if (error?.status === 404) notFound()
    throw error
  }
  return (
    <main className="public stack">
      <p className="notice warn">Preview. This is what attendees see. Your answers are not saved.</p>
      <header className="stack" style={{ gap: 2 }}>
        <p className="eyebrow">{event.shortName || event.name}</p>
        <h1>{quiz.title}</h1>
        <p className="muted small">Attendee name</p>
      </header>
      <QuizForm quiz={quiz} preview />
      <Link className="muted small" href="/admin#quiz">Back to the dashboard</Link>
    </main>
  )
}
