import Link from "next/link"

export default function Home() {
  return (
    <main className="wrap narrow stack" style={{ paddingTop: 64 }}>
      <p className="brand" style={{ color: "var(--teal-700)" }}>NREP <span>Events</span></p>
      <h1>Event check-in and certificates</h1>
      <p className="muted">
        Staff sign in with their email to manage attendees or scan tags. Attendees don&apos;t need an account:
        their tag and certificate links arrive by email.
      </p>
      <div className="row">
        <Link className="button" href="/login">Staff sign in</Link>
      </div>
    </main>
  )
}
