import "server-only"
import crypto from "node:crypto"
import { cookies } from "next/headers"
import { COLLECTIONS, Query, globalStore } from "./db/index.mjs"
import { env } from "./env.mjs"
import { badRequest, forbidden, tooMany, unauthorized } from "./errors.mjs"
import { sendEmail } from "./email.mjs"
import { signInCodeEmail } from "./emails/templates.mjs"
import { isEmail, normalizeEmail } from "../shared/validation.mjs"

// Email one-time codes for staff (admins and scanners). Attendees never sign in.
const CODE_TTL_MS = 10 * 60 * 1000
const CODES_PER_WINDOW = 3
const CODE_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const SESSION_TTL_MS = { admin: 12 * 3600 * 1000, scanner: 14 * 3600 * 1000 }

export const cookieName = () => (env().production ? "__Host-event_session" : "event_session")

const hmac = (value) => crypto.createHmac("sha256", env().sessionSecret).update(value).digest("hex")
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex")
const sessionDocId = (token) => sha256(token).slice(0, 32)

function sameHex(a, b) {
  const left = Buffer.from(String(a), "hex")
  const right = Buffer.from(String(b), "hex")
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right)
}

// Always answers the same way so the form can't be used to discover staff emails.
export async function requestSignInCode(emailInput) {
  const email = normalizeEmail(emailInput)
  if (!isEmail(email)) throw badRequest("Enter a valid email address.")
  const db = globalStore()
  const staff = await db.findOne(COLLECTIONS.staff, [Query.equal("email", email)])
  if (!staff || staff.status !== "active") return

  const since = new Date(Date.now() - CODE_WINDOW_MS).toISOString()
  const recent = await db.list(COLLECTIONS.otps, [Query.equal("email", email), Query.greaterThan("$createdAt", since), Query.limit(1)])
  if (Number(recent?.total || 0) >= CODES_PER_WINDOW) throw tooMany("Too many codes requested. Wait 15 minutes and try again.")

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
  await db.create(COLLECTIONS.otps, crypto.randomUUID().replaceAll("-", ""), {
    email,
    codeHash: hmac(`${email}:${code}`),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
  })
  await sendEmail({ to: email, ...signInCodeEmail({ name: staff.name, code }) })
}

export async function verifySignInCode(emailInput, codeInput, userAgent = "") {
  const email = normalizeEmail(emailInput)
  const code = String(codeInput || "").replace(/\D/g, "")
  const invalid = () => badRequest("That code is wrong or has expired. Request a new one.", "invalid_code")
  if (!isEmail(email) || code.length !== 6) throw invalid()

  const db = globalStore()
  const otp = await db.findOne(COLLECTIONS.otps, [Query.equal("email", email), Query.orderDesc("$createdAt")])
  if (!otp || otp.consumedAt || Date.parse(otp.expiresAt) < Date.now()) throw invalid()
  if (otp.attempts >= MAX_ATTEMPTS) throw tooMany("Too many wrong codes. Request a new code.")
  // Count the attempt before comparing, so parallel guesses can't skip the limit.
  await db.update(COLLECTIONS.otps, otp.$id, { attempts: otp.attempts + 1 })
  if (!sameHex(otp.codeHash, hmac(`${email}:${code}`))) throw invalid()
  await db.update(COLLECTIONS.otps, otp.$id, { consumedAt: new Date().toISOString() })

  const staff = await db.findOne(COLLECTIONS.staff, [Query.equal("email", email)])
  if (!staff || staff.status !== "active") throw invalid()

  const token = crypto.randomBytes(32).toString("base64url")
  const ttl = SESSION_TTL_MS[staff.role] || SESSION_TTL_MS.admin
  const expiresAt = new Date(Date.now() + ttl)
  await db.create(COLLECTIONS.sessions, sessionDocId(token), {
    staffId: staff.$id,
    expiresAt: expiresAt.toISOString(),
    userAgent: String(userAgent).slice(0, 200),
  })
  const jar = await cookies()
  jar.set(cookieName(), token, {
    httpOnly: true,
    secure: env().production,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  })
  return { role: staff.role }
}

export async function signOut() {
  const jar = await cookies()
  const token = jar.get(cookieName())?.value
  if (token) await globalStore().remove(COLLECTIONS.sessions, sessionDocId(token)).catch(() => {})
  jar.delete(cookieName())
}

// Loads the session and the staff record on every request, so disabling a
// staff member or moving a scanner to another event takes effect immediately.
export async function currentStaff() {
  const jar = await cookies()
  const token = jar.get(cookieName())?.value
  if (!token || token.length > 100) return null
  const db = globalStore()
  const session = await db.get(COLLECTIONS.sessions, sessionDocId(token))
  if (!session || Date.parse(session.expiresAt) < Date.now()) return null
  const staff = await db.get(COLLECTIONS.staff, session.staffId)
  if (!staff || staff.status !== "active") return null
  return { id: staff.$id, email: staff.email, name: staff.name, role: staff.role, eventId: staff.eventId || "" }
}

export async function requireAdmin() {
  const staff = await currentStaff()
  if (!staff) throw unauthorized()
  if (staff.role !== "admin") throw forbidden("Only event admins can do this.")
  return staff
}

export async function requireScanner() {
  const staff = await currentStaff()
  if (!staff) throw unauthorized()
  if (staff.role !== "scanner" || !staff.eventId) throw forbidden("This account isn't set up as a scanner for an event.")
  return staff
}
