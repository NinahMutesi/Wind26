import { notFound } from "next/navigation"
import { findPublicTag } from "@/lib/server/services/documents.mjs"
import { formatDate } from "@/lib/shared/format.mjs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Your event tag", robots: { index: false, follow: false }, referrer: "no-referrer" }

// The attendee's digital tag. Shows only what is printed on the tag itself.
export default async function TagPage({ params }) {
  const { tagId } = await params
  const found = await findPublicTag(tagId)
  if (!found) notFound()
  const { event, attendee } = found
  return (
    <main className="public stack">
      <div className="stack" style={{ gap: 4 }}>
        <p className="brand" style={{ color: "var(--teal-700)" }}>{event.shortName || event.name}</p>
        <h1>{attendee.fullName}</h1>
        <p className="muted">{formatDate(event.startDate)} – {formatDate(event.endDate)}{event.venue ? ` · ${event.venue}` : ""}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tag-image" src={`/api/public/tags/${attendee.tagId}/png`} width={1240} height={1748} alt={`Event tag for ${attendee.fullName}`} />
      <p className="notice info">Show this QR code at the registration desk each morning. Turn your screen brightness up if it doesn&apos;t scan.</p>
      <div className="row">
        <a className="button" href={`/api/public/tags/${attendee.tagId}/png?download=1`}>Save tag image</a>
      </div>
      <p className="muted small">This link is personal. Please don&apos;t share it.</p>
    </main>
  )
}
