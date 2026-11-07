import { findPublicCertificate } from "@/lib/server/services/documents.mjs"
import { formatDate } from "@/lib/shared/format.mjs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Certificate verification", robots: { index: false, follow: false } }

// Public verification page, reached from the link and ID printed on every certificate.
export default async function VerifyPage({ params }) {
  const { certificateId } = await params
  const found = await findPublicCertificate(certificateId)

  if (!found) {
    return (
      <main className="public stack">
        <div className="seal bad" aria-hidden="true">✕</div>
        <h1>Certificate not found</h1>
        <p className="muted">No certificate has this ID. Check that the whole link was copied, or contact the organisers.</p>
      </main>
    )
  }

  const { event, certificate } = found
  const valid = certificate.status === "issued"
  return (
    <main className="public stack">
      <div className={`seal ${valid ? "ok" : "bad"}`} aria-hidden="true">{valid ? "✓" : "✕"}</div>
      <h1>{valid ? "Valid certificate" : "This certificate has been revoked"}</h1>
      <div className="card stack" style={{ gap: 10 }}>
        <div><p className="muted small">Awarded to</p><p style={{ fontSize: "1.3rem", fontWeight: 600 }}>{certificate.nameOnCertificate}</p></div>
        <div><p className="muted small">Programme</p><p>{event.name}</p></div>
        <div><p className="muted small">Dates and venue</p><p>{formatDate(event.startDate)} – {formatDate(event.endDate)}{event.venue ? `, ${event.venue}` : ""}</p></div>
        <div><p className="muted small">Issued</p><p>{formatDate(certificate.issuedAt)}</p></div>
        <div><p className="muted small">Certificate ID</p><p className="num small" style={{ wordBreak: "break-all" }}>{certificate.$id}</p></div>
      </div>
      {valid && (
        <div className="row">
          <a className="button" href={`/api/public/certificates/${certificate.$id}/pdf`}>Download certificate (PDF)</a>
        </div>
      )}
      <p className="muted small">Issued by the National Renewable Energy Platform (NREP).</p>
    </main>
  )
}
