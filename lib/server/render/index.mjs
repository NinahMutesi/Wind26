import { readFileSync } from "node:fs"
import path from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { FONTS, fontBytes, fontPath, measure } from "./fonts.mjs"
import { buildDrawList, validateLayout } from "./layout.mjs"

// Designs live in the repository under events/<designKey>/ so every change to a
// tag or certificate goes through review like code. See docs/designs.md.

export const DESIGN_KINDS = Object.freeze({ tag: "tag.layout.json", certificate: "certificate.layout.json" })
const MM_TO_PT = 72 / 25.4
const designs = new Map()

export function loadDesign(designKey, kind) {
  if (!/^[a-z0-9-]{1,64}$/.test(designKey || "")) throw new Error("Invalid design key.")
  if (!DESIGN_KINDS[kind]) throw new Error("Invalid design kind.")
  const cacheKey = `${designKey}:${kind}`
  if (!designs.has(cacheKey)) {
    const dir = path.join(process.cwd(), "events", designKey)
    const layout = JSON.parse(readFileSync(path.join(dir, DESIGN_KINDS[kind]), "utf8"))
    const errors = validateLayout(layout, FONTS)
    if (errors.length) throw new Error(`Design ${designKey}/${kind} is invalid: ${errors.join("; ")}`)
    // The background and any fixed pictures (a signature), keyed by their assets/ path.
    const images = new Map()
    for (const src of [layout.background, ...(layout.elements || []).filter((el) => el.type === "image").map((el) => el.src)]) {
      if (!images.has(src)) images.set(src, { bytes: readFileSync(path.join(dir, src)), mime: /\.png$/i.test(src) ? "image/png" : "image/jpeg" })
    }
    designs.set(cacheKey, { layout, images })
  }
  return designs.get(cacheKey)
}

const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c])
const fmt = (n) => Number(n.toFixed(3))

export function drawListToSvg(design, items) {
  const { widthMm: w, heightMm: h } = design.layout.page
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm">`]
  for (const item of items) {
    if (item.kind === "image") {
      const image = design.images.get(item.src)
      const fit = item.src === design.layout.background ? "none" : "xMidYMid meet"
      parts.push(`<image x="${fmt(item.x)}" y="${fmt(item.y)}" width="${fmt(item.w)}" height="${fmt(item.h)}" preserveAspectRatio="${fit}" xlink:href="data:${image.mime};base64,${image.bytes.toString("base64")}"/>`)
    } else if (item.kind === "rects") {
      parts.push(`<path fill="${escapeXml(item.color)}" shape-rendering="crispEdges" d="${item.rects.map(([x, y, rw, rh]) => `M${fmt(x)} ${fmt(y)}h${fmt(rw)}v${fmt(rh)}h${fmt(-rw)}z`).join("")}"/>`)
    } else if (item.kind === "text") {
      const font = FONTS[item.font]
      const squeeze = item.scaleX < 1 ? ` textLength="${fmt(item.width)}" lengthAdjust="spacingAndGlyphs"` : ""
      parts.push(`<text x="${fmt(item.x)}" y="${fmt(item.baseline)}" font-family="${escapeXml(font.family)}" font-weight="${font.weight}" font-size="${fmt(item.size)}" fill="${escapeXml(item.color)}" text-anchor="${item.anchor}"${squeeze}>${escapeXml(item.text)}</text>`)
    }
  }
  parts.push("</svg>")
  return parts.join("")
}

export function renderPng({ designKey, kind, data, widthPx = 1240 }) {
  const design = loadDesign(designKey, kind)
  const svg = drawListToSvg(design, buildDrawList(design.layout, data, measure))
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: widthPx },
    font: { loadSystemFonts: false, fontFiles: Object.keys(FONTS).map(fontPath), defaultFontFamily: "Poppins" },
  })
  return resvg.render().asPng()
}

const hexColor = (hex) => {
  const v = String(hex).replace("#", "")
  const n = Number.parseInt(v.length === 3 ? v.split("").map((c) => c + c).join("") : v, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function drawItems(page, items, { originX, originY, layout, embeddedFonts, embeddedImages }) {
  const pageTop = originY + layout.page.heightMm * MM_TO_PT // pdf-lib's y axis points up
  for (const item of items) {
    if (item.kind === "image") {
      const image = embeddedImages.get(item.src)
      let { x, y, w, h } = item
      // Fixed pictures keep their proportions inside their box, centred, like the PNG.
      if (item.src !== layout.background) {
        const scale = Math.min(w / image.width, h / image.height)
        x += (w - image.width * scale) / 2
        y += (h - image.height * scale) / 2
        w = image.width * scale
        h = image.height * scale
      }
      page.drawImage(image, { x: originX + x * MM_TO_PT, y: pageTop - (y + h) * MM_TO_PT, width: w * MM_TO_PT, height: h * MM_TO_PT })
    } else if (item.kind === "rects") {
      const color = hexColor(item.color)
      for (const [x, y, w, h] of item.rects) {
        // A hair of overlap avoids visible seams between modules in some viewers.
        page.drawRectangle({ x: originX + x * MM_TO_PT, y: pageTop - (y + h) * MM_TO_PT - 0.01, width: w * MM_TO_PT + 0.01, height: h * MM_TO_PT + 0.02, color })
      }
    } else if (item.kind === "text") {
      const font = embeddedFonts.get(item.font)
      const size = item.size * MM_TO_PT
      const width = item.width * MM_TO_PT
      const left = item.anchor === "start" ? item.x * MM_TO_PT : item.anchor === "end" ? item.x * MM_TO_PT - width : item.x * MM_TO_PT - width / 2
      const x = originX + left
      const y = pageTop - item.baseline * MM_TO_PT
      if (item.scaleX < 1) {
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(item.scaleX, 0, 0, 1, x, y))
        page.drawText(item.text, { x: 0, y: 0, size, font, color: hexColor(item.color) })
        page.pushOperators(popGraphicsState())
      } else {
        page.drawText(item.text, { x, y, size, font, color: hexColor(item.color) })
      }
    }
  }
}

// sheet "single": one design per page. sheet "a4-2x2": four A6 tags per A4 page, with cut lines.
export async function renderPdf({ designKey, kind, records, sheet = "single", title = "" }) {
  const design = loadDesign(designKey, kind)
  const { layout } = design
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  if (title) pdf.setTitle(title)
  pdf.setCreator("NREP Event Lite")
  const embeddedImages = new Map()
  for (const [src, image] of design.images) {
    embeddedImages.set(src, /png/.test(image.mime) ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes))
  }
  const embeddedFonts = new Map()
  const usedFonts = new Set((layout.elements || []).filter((el) => el.type === "text").map((el) => el.font))
  for (const key of usedFonts) embeddedFonts.set(key, await pdf.embedFont(fontBytes(key), { subset: true }))

  const w = layout.page.widthMm * MM_TO_PT
  const h = layout.page.heightMm * MM_TO_PT
  if (sheet === "a4-2x2") {
    const A4 = [210 * MM_TO_PT, 297 * MM_TO_PT]
    if (w * 2 > A4[0] + 0.5 || h * 2 > A4[1] + 0.5) throw new Error("This design is too large for four per A4 page.")
    const gapX = (A4[0] - 2 * w) / 2
    const gapY = (A4[1] - 2 * h) / 2
    for (let i = 0; i < records.length; i += 4) {
      const page = pdf.addPage(A4)
      records.slice(i, i + 4).forEach((data, j) => {
        const originX = gapX + (j % 2) * w
        const originY = A4[1] - gapY - (Math.floor(j / 2) + 1) * h
        drawItems(page, buildDrawList(layout, data, measure), { originX, originY, layout, embeddedFonts, embeddedImages })
      })
      const cut = { thickness: 0.3, color: rgb(0.75, 0.75, 0.75) }
      page.drawLine({ start: { x: gapX + w, y: 0 }, end: { x: gapX + w, y: A4[1] }, ...cut })
      page.drawLine({ start: { x: 0, y: A4[1] / 2 }, end: { x: A4[0], y: A4[1] / 2 }, ...cut })
    }
  } else {
    for (const data of records) {
      const page = pdf.addPage([w, h])
      drawItems(page, buildDrawList(layout, data, measure), { originX: 0, originY: 0, layout, embeddedFonts, embeddedImages })
    }
  }
  return pdf.save()
}
