import "server-only"
import { COLLECTIONS, Query, globalStore } from "../db/index.mjs"
import { badRequest, conflict, forbidden, notFound } from "../errors.mjs"
import { newDocId } from "./events.mjs"
import { cleanText, isEmail, normalizeEmail } from "../../shared/validation.mjs"
import { env } from "../env.mjs"
import { scannerCode } from "../scanner-codes.mjs"

// Admins manage the scanner accounts for one event from the admin page.
// Admin accounts are created only with scripts/add-staff.mjs.

// Helpers added without an email get a placeholder address, because each account needs one.
const NO_EMAIL = "@no-email.invalid"
const usesCodes = () => env().adminAccess === "password"

const publicStaff = (s) => ({
  id: s.$id, email: s.email.endsWith(NO_EMAIL) ? "" : s.email, name: s.name, status: s.status,
  // With the shared admin password, helpers sign in with this code. Only admins see it.
  ...(usesCodes() ? { code: scannerCode(s.$id) } : {}),
})

export async function listScanners(eventId) {
  const rows = await globalStore().listAll(COLLECTIONS.staff, [Query.equal("eventId", eventId), Query.equal("role", "scanner")])
  return rows.map(publicStaff)
}

export async function addScanner(eventId, input, admin, audit) {
  const given = normalizeEmail(input?.email)
  const name = cleanText(input?.name, 120)
  // Sign-in codes are emailed, so that setup needs a real address. Scanner codes don't.
  const email = !given && usesCodes() ? `scanner-${newDocId().slice(0, 12)}${NO_EMAIL}` : given
  if (!isEmail(email)) throw badRequest("Enter a valid email address.")
  if (name.length < 2) throw badRequest("Enter the scanner's name.")
  const store = globalStore()
  const existing = await store.findOne(COLLECTIONS.staff, [Query.equal("email", email)])
  if (existing?.role === "admin") throw conflict("This email belongs to an admin. Use a different email for scanning.")
  if (existing) {
    // One account per email in the Lite kit: moving a scanner to this event ends
    // their access to the previous one immediately.
    const updated = await store.update(COLLECTIONS.staff, existing.$id, { name, eventId, status: "active" })
    await audit({ action: "scanner.assign", targetId: existing.$id, details: { email, previousEventId: existing.eventId } })
    return publicStaff(updated)
  }
  const doc = await store.create(COLLECTIONS.staff, newDocId(), { email, name, role: "scanner", eventId, status: "active", createdBy: admin.email })
  await audit({ action: "scanner.add", targetId: doc.$id, details: { email } })
  return publicStaff(doc)
}

export async function setScannerStatus(eventId, staffId, status, audit) {
  if (!["active", "disabled"].includes(status)) throw badRequest("Choose active or disabled.")
  const store = globalStore()
  const staff = await store.get(COLLECTIONS.staff, staffId)
  if (!staff) throw notFound("Scanner not found.")
  if (staff.role !== "scanner" || staff.eventId !== eventId) throw forbidden("This scanner isn't assigned to this event.")
  const updated = await store.update(COLLECTIONS.staff, staffId, { status })
  await audit({ action: `scanner.${status === "active" ? "enable" : "disable"}`, targetId: staffId, details: { email: staff.email } })
  return publicStaff(updated)
}
