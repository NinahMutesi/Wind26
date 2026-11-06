import QRCode from "qrcode"

// Turns a design layout (JSON, millimetres) plus one person's data into a
// neutral draw list. The PNG and PDF back ends both draw from this list, so a
// tag looks the same on a phone and on paper.

const PT_TO_MM = 25.4 / 72
const FIELD = /\{([a-zA-Z]+)\}/g
// Image files a design may use: a PNG or JPEG directly inside its assets/ folder.
export const IMAGE_FILE = /^assets\/[a-z0-9._-]+\.(png|jpe?g)$/i

export const LAYOUT_FIELDS = Object.freeze([
  "fullName", "organization", "eventName", "tagUrl", "tagCode", "verifyUrl", "verifyHost", "certificateId", "issuedDate", "daysAttended",
])

export function fillTemplate(template, data) {
  return String(template || "").replace(FIELD, (_, key) => (LAYOUT_FIELDS.includes(key) ? String(data?.[key] ?? "") : "")).trim()
}

export function validateLayout(layout, fonts) {
  const errors = []
  const { widthMm, heightMm } = layout?.page || {}
  if (!(widthMm > 0 && heightMm > 0)) errors.push("page.widthMm and page.heightMm are required")
  if (typeof layout?.background !== "string" || !IMAGE_FILE.test(layout.background)) {
    errors.push("background must be a PNG or JPEG file under assets/")
  }
  for (const [i, el] of (layout?.elements || []).entries()) {
    if (el.type === "text") {
      if (!fonts[el.font]) errors.push(`elements[${i}] uses unknown font ${el.font}`)
      if (!(el.sizePt > 0) || !(el.width > 0)) errors.push(`elements[${i}] needs sizePt and width`)
    } else if (el.type === "qr") {
      if (!(el.size > 0)) errors.push(`elements[${i}] needs size`)
    } else if (el.type === "image") {
      if (typeof el.src !== "string" || !IMAGE_FILE.test(el.src)) errors.push(`elements[${i}] src must be a PNG or JPEG file under assets/`)
      if (!(el.width > 0 && el.height > 0)) errors.push(`elements[${i}] needs width and height`)
    } else {
      errors.push(`elements[${i}] has unknown type ${el.type}`)
    }
  }
  return errors
}

function balancedSplit(words, measureLine) {
  let best = null
  for (let i = 1; i < words.length; i += 1) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")]
    const widest = Math.max(...lines.map(measureLine))
    if (!best || widest < best.widest) best = { lines, widest }
  }
  return best
}

// Largest size from sizePt down to minSizePt that fits; two balanced lines if
// allowed; as a last resort the minimum size squeezed horizontally. Names are
// never cut off.
export function fitText(el, text, measure) {
  const maxLines = Math.max(1, Math.min(2, el.maxLines || 1))
  const min = el.minSizePt || el.sizePt
  const words = text.split(" ")
  for (let pt = el.sizePt; pt >= min - 1e-9; pt -= 0.5) {
    const size = pt * PT_TO_MM
    if (measure(el.font, text, size) <= el.width) return { lines: [text], size, scaleX: 1 }
  }
  if (maxLines === 2 && words.length > 1) {
    for (let pt = el.sizePt; pt >= min - 1e-9; pt -= 0.5) {
      const size = pt * PT_TO_MM
      const split = balancedSplit(words, (line) => measure(el.font, line, size))
      if (split.widest <= el.width) return { lines: split.lines, size, scaleX: 1 }
    }
    const size = min * PT_TO_MM
    const split = balancedSplit(words, (line) => measure(el.font, line, size))
    return { lines: split.lines, size, scaleX: Math.min(1, el.width / split.widest) }
  }
  const size = min * PT_TO_MM
  return { lines: [text], size, scaleX: Math.min(1, el.width / measure(el.font, text, size)) }
}

export function qrRects(text, { x, y, size, errorCorrectionLevel = "M" }) {
  const qr = QRCode.create(text, { errorCorrectionLevel })
  const n = qr.modules.size
  const cell = size / n
  const rects = []
  for (let row = 0; row < n; row += 1) {
    let start = -1
    for (let col = 0; col <= n; col += 1) {
      const dark = col < n && qr.modules.get(row, col)
      if (dark && start < 0) start = col
      if (!dark && start >= 0) {
        rects.push([x + start * cell, y + row * cell, (col - start) * cell, cell])
        start = -1
      }
    }
  }
  return rects
}

export function buildDrawList(layout, data, measure) {
  const items = [{ kind: "image", src: layout.background, x: 0, y: 0, w: layout.page.widthMm, h: layout.page.heightMm }]
  for (const el of layout.elements || []) {
    // A fixed picture from the design, such as a signature. The same on every copy.
    if (el.type === "image") {
      items.push({ kind: "image", src: el.src, x: el.x, y: el.y, w: el.width, h: el.height })
      continue
    }
    let text = fillTemplate(el.value, data)
    if (!text) continue
    if (el.type === "qr") {
      items.push({ kind: "rects", color: el.color || "#000000", rects: qrRects(text, el) })
      continue
    }
    if (el.transform === "uppercase") text = text.toLocaleUpperCase("en")
    const fit = fitText(el, text, measure)
    const lineGap = fit.size * (el.lineHeight || 1.15)
    const anchor = el.align === "left" ? "start" : el.align === "right" ? "end" : "middle"
    const ax = anchor === "start" ? el.x : anchor === "end" ? el.x + el.width : el.x + el.width / 2
    fit.lines.forEach((line, i) => {
      const offset = el.grow === "up" ? (i - (fit.lines.length - 1)) * lineGap : i * lineGap
      items.push({
        kind: "text",
        text: line,
        font: el.font,
        size: fit.size,
        color: el.color || "#000000",
        x: ax,
        baseline: el.baseline + offset,
        anchor,
        scaleX: fit.scaleX,
        width: measure(el.font, line, fit.size) * fit.scaleX,
      })
    })
  }
  return items
}
