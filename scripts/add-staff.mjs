// Adds or updates a staff account. Admins can only be created here, not from the app.
//
//   npm run staff:add -- --email you@nrep.ug --name "Your Name" --role admin --apply
//   npm run staff:add -- --email usher@nrep.ug --name "Usher" --role scanner --event WIND26 --apply
//   npm run staff:add -- --email old@nrep.ug --disable --apply
import crypto from "node:crypto"
import { COLLECTIONS } from "../lib/server/db/schema.mjs"
import { Query } from "../lib/server/db/rest.mjs"
import { isEmail, normalizeEmail, cleanText } from "../lib/shared/validation.mjs"
import { banner, connect, fail, parseArgs } from "./lib/cli.mjs"

const args = parseArgs()
const email = normalizeEmail(args.email)
if (!isEmail(email)) fail("Pass --email with a valid address.")
const apply = args.apply === true
const target = connect()
banner(target, apply)

const existing = (await target.docs.list(COLLECTIONS.staff, [Query.equal("email", email), Query.limit(1)])).documents?.[0]

if (args.disable === true) {
  if (!existing) fail(`${email} has no account.`)
  console.log(`~ disable ${email}`)
  if (apply) {
    await target.docs.update(COLLECTIONS.staff, existing.$id, { status: "disabled" })
    // End any open sessions right away.
    const sessions = await target.docs.list(COLLECTIONS.sessions, [Query.equal("staffId", existing.$id), Query.limit(100)])
    for (const s of sessions.documents || []) await target.docs.remove(COLLECTIONS.sessions, s.$id)
  }
  process.exit(0)
}

const role = String(args.role || "")
if (!["admin", "scanner"].includes(role)) fail("Pass --role admin or --role scanner.")
const name = cleanText(args.name, 120)
if (name.length < 2) fail("Pass --name.")

let eventId = ""
if (role === "scanner") {
  if (!args.event) fail("Scanners need --event <EVENT CODE>.")
  const event = (await target.docs.list(COLLECTIONS.events, [Query.equal("code", String(args.event).toUpperCase()), Query.limit(1)])).documents?.[0]
  if (!event) fail(`No event with code ${args.event}. Run npm run event:seed first.`)
  eventId = event.$id
}

const data = { email, name, role, eventId, status: "active", createdBy: "script" }
if (existing) {
  console.log(`~ update ${email}: role=${role}${eventId ? ` event=${args.event}` : ""}`)
  if (apply) await target.docs.update(COLLECTIONS.staff, existing.$id, { name, role, eventId, status: "active" })
} else {
  console.log(`+ create ${role} ${email}${eventId ? ` for ${args.event}` : ""}`)
  if (apply) await target.docs.create(COLLECTIONS.staff, crypto.randomUUID().replaceAll("-", ""), data)
}
