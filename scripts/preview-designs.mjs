// Renders sample tags and certificates with made-up names so designers can
// check positions without a database. Usage:
//   npm run design:preview -- --design wind26 [--out previews]
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { renderPdf, renderPng } from "../lib/server/render/index.mjs"

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const designKey = option("design", "wind26")
const out = path.resolve(option("out", "previews"))
mkdirSync(out, { recursive: true })

const appUrl = "https://events.example.org"
const samples = [
  { fullName: "Sample Attendee", organization: "Example Energy Ltd" },
  { fullName: "Christopher Mwesigwa-Ssekandi Byaruhanga", organization: "Ministry of Energy and Mineral Development, Renewable Energy Department" },
  { fullName: "Ann Okello", organization: "" },
  { fullName: "Grace Achieng Namubiru", organization: "Example Wind Developers" },
].map((s, i) => {
  const id = `00000000-0000-4000-8000-00000000000${i}`
  return {
    ...s,
    eventName: "Wind Energy Power Plants Training",
    tagUrl: `${appUrl}/t/${id}`,
    tagCode: `PREVIEW:${id}`,
    verifyUrl: `${appUrl}/verify/${id}`,
    verifyHost: `${new URL(appUrl).host}/verify`,
    certificateId: id,
  }
})

samples.forEach((data, i) => {
  writeFileSync(path.join(out, `tag-${i + 1}.png`), renderPng({ designKey, kind: "tag", data, widthPx: 1240 }))
  writeFileSync(path.join(out, `certificate-${i + 1}.png`), renderPng({ designKey, kind: "certificate", data, widthPx: 1754 }))
})
writeFileSync(path.join(out, "tags-a4.pdf"), await renderPdf({ designKey, kind: "tag", records: samples, sheet: "a4-2x2" }))
writeFileSync(path.join(out, "certificates.pdf"), await renderPdf({ designKey, kind: "certificate", records: samples }))
console.log(`Previews written to ${out}`)
