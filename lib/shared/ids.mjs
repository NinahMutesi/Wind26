// Tag and certificate identifiers are random UUID v4 values (122 random bits).
// v1 and v7 UUIDs contain timestamps and are partly predictable, so only v4 is accepted.

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isUuidV4(value) {
  return UUID_V4.test(String(value || "").toLowerCase())
}

export function newUuid() {
  return globalThis.crypto.randomUUID()
}

// Accepts what a camera or a keyboard-style scanner reads from a tag:
// the full link (https://host/t/<uuid>) or the bare UUID.
export function extractTagId(input) {
  const text = String(input || "").trim()
  if (!text || text.length > 300) return null
  const match = text.toLowerCase().match(/(?:^|\/t\/)([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[/?#]|$)/)
  return match ? match[1] : null
}

export const tagUrl = (appUrl, tagId) => `${appUrl}/t/${tagId}`
export const verifyUrl = (appUrl, certificateId) => `${appUrl}/verify/${certificateId}`
