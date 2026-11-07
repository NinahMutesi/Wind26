// Tag and certificate identifiers are random UUID v4 values (122 random bits).
// v1 and v7 UUIDs contain timestamps and are partly predictable, so only v4 is accepted.

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isUuidV4(value) {
  return UUID_V4.test(String(value || "").toLowerCase())
}

export function newUuid() {
  return globalThis.crypto.randomUUID()
}

// Accepts what a camera or a keyboard-style scanner reads from a tag: the attendance code
// (EVENTCODE:<uuid>), the bare UUID, or the link that older badges carried (https://host/t/<uuid>).
export function extractTagId(input) {
  const text = String(input || "").trim()
  if (!text || text.length > 300) return null
  const match = text.toLowerCase().match(/(?:^|\/t\/|^[a-z0-9]{2,20}:)([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[/?#]|$)/)
  return match ? match[1] : null
}

// What the badge's QR code holds. It is text, not a link, so scanning it with a phone
// camera opens nothing: only the desk scanner reads it and records attendance.
export const attendanceCode = (eventCode, tagId) => `${String(eventCode || "").toUpperCase()}:${tagId}`
export const tagUrl = (appUrl, tagId) => `${appUrl}/t/${tagId}`
// Fixed per attendee, so it can go in the badge email before any quiz is open.
export const quizUrl = (appUrl, tagId) => `${tagUrl(appUrl, tagId)}/quiz`
export const verifyUrl = (appUrl, certificateId) => `${appUrl}/verify/${certificateId}`

// Scanner codes: 12 characters in groups of four, e.g. K7QM-4RXP-2WTN (60 bits).
// No 0/O or 1/I, so they can be read out over the phone without mistakes.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
export const SCANNER_CODE_LENGTH = 12

export function formatScannerCode(bytes) {
  let chars = ""
  for (let i = 0; i < SCANNER_CODE_LENGTH; i += 1) chars += CODE_ALPHABET[bytes[i] % 32]
  return chars.match(/.{4}/g).join("-")
}

// What a person typed, reduced to the 12 code characters; anything else gives "".
export function normalizeScannerCode(input) {
  const chars = String(input || "").toUpperCase().replace(/[\s-]/g, "")
  return chars.length === SCANNER_CODE_LENGTH && [...chars].every((c) => CODE_ALPHABET.includes(c)) ? chars : ""
}
