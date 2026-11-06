import test from "node:test"
import assert from "node:assert/strict"
import { PDFDocument } from "pdf-lib"
import { buildDrawList, fillTemplate, fitText, validateLayout } from "../lib/server/render/layout.mjs"
import { loadDesign, renderPdf, renderPng } from "../lib/server/render/index.mjs"
import { FONTS, measure } from "../lib/server/render/fonts.mjs"

const fixedMeasure = (_font, text, size) => text.length * size * 0.6

test("templates fill only known fields", () => {
  assert.equal(fillTemplate("Hi {fullName} {secret}", { fullName: "Ann", secret: "x" }), "Hi Ann")
})

test("long names shrink, then wrap, but are never cut", () => {
  const el = { font: "Poppins-Bold", sizePt: 20, minSizePt: 10, width: 60, maxLines: 2 }
  const short = fitText(el, "Ann Okello", fixedMeasure)
  assert.equal(short.lines.length, 1)
  const long = fitText(el, "Christopher Mwesigwa-Ssekandi Byaruhanga Kato", fixedMeasure)
  assert.equal(long.lines.length, 2)
  assert.equal(long.lines.join(" "), "Christopher Mwesigwa-Ssekandi Byaruhanga Kato")
  const single = fitText({ ...el, maxLines: 1 }, "Christopher Mwesigwa-Ssekandi Byaruhanga Kato", fixedMeasure)
  assert.ok(single.scaleX < 1 && single.lines[0].length === 45, "squeezed, not truncated")
})

test("draw list skips empty fields and includes the QR code", () => {
  const layout = {
    page: { widthMm: 100, heightMm: 100 },
    elements: [
      { type: "text", value: "{organization}", font: "Poppins-Regular", sizePt: 10, width: 80, x: 10, baseline: 20 },
      { type: "qr", value: "{tagUrl}", x: 10, y: 50, size: 20 },
    ],
  }
  const items = buildDrawList(layout, { organization: "", tagUrl: "https://x.org/t/3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69" }, measure)
  assert.equal(items.filter((i) => i.kind === "text").length, 0)
  const qr = items.find((i) => i.kind === "rects")
  assert.ok(qr.rects.length > 50)
  assert.ok(qr.rects.every(([x, y, w, h]) => x >= 10 && y >= 50 && x + w <= 30.0001 && y + h <= 70.0001), "QR stays inside its box")
})

const data = {
  fullName: "Grace Achieng", organization: "Example Energy Ltd", eventName: "Test",
  tagUrl: "https://events.example.org/t/3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69",
  verifyUrl: "https://events.example.org/verify/3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69",
  verifyHost: "events.example.org/verify", certificateId: "3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69",
}

test("the wind26 design renders a tag PNG and a certificate PNG", () => {
  const tag = renderPng({ designKey: "wind26", kind: "tag", data, widthPx: 400 })
  assert.equal(tag.subarray(1, 4).toString(), "PNG")
  assert.equal(tag.readUInt32BE(16), 400)
  const cert = renderPng({ designKey: "wind26", kind: "certificate", data, widthPx: 600 })
  assert.equal(cert.readUInt32BE(16), 600)
})

test("print sheet puts four tags on each A4 page", async () => {
  const bytes = await renderPdf({ designKey: "wind26", kind: "tag", sheet: "a4-2x2", records: Array(5).fill(data) })
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 2)
  const { width, height } = pdf.getPage(0).getSize()
  assert.equal(Math.round(width), 595)
  assert.equal(Math.round(height), 842)
})

test("designs can place a fixed picture, such as a signature, from their assets folder", () => {
  const layout = { page: { widthMm: 100, heightMm: 100 }, background: "assets/bg.png", elements: [{ type: "image", src: "assets/signature.png", x: 10, y: 60, width: 40, height: 15 }] }
  assert.deepEqual(validateLayout(layout, FONTS), [])
  const items = buildDrawList(layout, {}, measure)
  assert.deepEqual(items.map((i) => i.src), ["assets/bg.png", "assets/signature.png"])
  assert.deepEqual(items[1], { kind: "image", src: "assets/signature.png", x: 10, y: 60, w: 40, h: 15 })
  for (const src of ["../secret.png", "assets/../x.png", "assets/sign.svg", "https://x.org/a.png"]) {
    assert.ok(validateLayout({ ...layout, elements: [{ ...layout.elements[0], src }] }, FONTS).length, `${src} rejected`)
  }
  assert.ok(validateLayout({ ...layout, elements: [{ ...layout.elements[0], height: 0 }] }, FONTS).length, "needs a size")
})

test("the wind26 certificate carries the signature in the PNG and the PDF", async () => {
  assert.ok(loadDesign("wind26", "certificate").images.has("assets/signature.png"))
  const pdf = await PDFDocument.load(await renderPdf({ designKey: "wind26", kind: "certificate", records: [data] }))
  assert.equal(pdf.getPageCount(), 1)
})

test("design keys can't escape the events folder", () => {
  assert.throws(() => renderPng({ designKey: "../lib", kind: "tag", data }), /Invalid design key/)
})
