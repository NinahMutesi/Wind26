import { readFileSync } from "node:fs"
import path from "node:path"
import fontkit from "@pdf-lib/fontkit"

// Fonts are bundled in assets/fonts (SIL Open Font License) so rendering never
// depends on what is installed on the server.
export const FONTS = Object.freeze({
  "Poppins-Regular": { file: "Poppins-Regular.ttf", family: "Poppins", weight: 400 },
  "Poppins-Medium": { file: "Poppins-Medium.ttf", family: "Poppins", weight: 500 },
  "Poppins-SemiBold": { file: "Poppins-SemiBold.ttf", family: "Poppins", weight: 600 },
  "Poppins-Bold": { file: "Poppins-Bold.ttf", family: "Poppins", weight: 700 },
  "Poppins-ExtraBold": { file: "Poppins-ExtraBold.ttf", family: "Poppins", weight: 800 },
  "GreatVibes-Regular": { file: "GreatVibes-Regular.ttf", family: "Great Vibes", weight: 400 },
})

const FONT_DIR = path.join(process.cwd(), "assets", "fonts")
const bytes = new Map()
const parsed = new Map()

export function fontPath(key) {
  return path.join(FONT_DIR, FONTS[key].file)
}

export function fontBytes(key) {
  if (!FONTS[key]) throw new Error(`Unknown font ${key}`)
  if (!bytes.has(key)) bytes.set(key, readFileSync(fontPath(key)))
  return bytes.get(key)
}

export function measure(key, text, sizeMm) {
  if (!parsed.has(key)) parsed.set(key, fontkit.create(fontBytes(key)))
  const font = parsed.get(key)
  return (font.layout(text).advanceWidth / font.unitsPerEm) * sizeMm
}
