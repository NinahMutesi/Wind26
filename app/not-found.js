import Link from "next/link"

export default function NotFound() {
  return (
    <main className="public stack" style={{ paddingTop: 64 }}>
      <h1>Page not found</h1>
      <p className="muted">This link isn&apos;t valid. If it came from a tag email, the tag may have been replaced. Ask the event organisers for a new one.</p>
      <Link href="/">Go to the home page</Link>
    </main>
  )
}
