// Creates or updates an event from events/<designKey>/event.json.
//
//   npm run event:seed -- --event wind26            # dry run
//   npm run event:seed -- --event wind26 --apply
//
// The event's status is never changed here; use the admin page (draft -> live -> closed).
import { readFileSync } from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { COLLECTIONS } from "../lib/server/db/schema.mjs"
import { Query } from "../lib/server/db/rest.mjs"
import { validateEventProfile } from "../lib/shared/event-days.mjs"
import { banner, connect, fail, parseArgs } from "./lib/cli.mjs"

const args = parseArgs()
const key = String(args.event || "")
if (!/^[a-z0-9-]{1,64}$/.test(key)) fail("Pass --event <folder name under events/>, for example --event wind26.")

let profile
try {
  profile = JSON.parse(readFileSync(path.join("events", key, "event.json"), "utf8"))
} catch (error) {
  fail(`Could not read events/${key}/event.json: ${error.message}`)
}
const errors = validateEventProfile({ ...profile, status: "draft" })
if (errors.length) fail(`events/${key}/event.json is invalid:\n  - ${errors.join("\n  - ")}`)

const apply = args.apply === true
const target = connect()
banner(target, apply)

const fields = {
  code: profile.code, name: profile.name, shortName: profile.shortName || "", venue: profile.venue || "",
  startDate: profile.startDate, endDate: profile.endDate, timezone: profile.timezone,
  checkinOpens: profile.checkinOpens, checkinCloses: profile.checkinCloses,
  certificateMinDays: profile.certificateMinDays, designKey: profile.designKey, contactEmail: profile.contactEmail || "",
  quizOpens: profile.quizOpens || "", organiser: profile.organiser || "",
}

const existing = (await target.docs.list(COLLECTIONS.events, [Query.equal("code", profile.code), Query.limit(1)])).documents?.[0]
if (existing) {
  const changed = Object.keys(fields).filter((k) => String(existing[k] ?? "") !== String(fields[k] ?? ""))
  console.log(changed.length ? `~ update ${profile.code}: ${changed.join(", ")}` : `= ${profile.code} is already up to date`)
  if (apply && changed.length) await target.docs.update(COLLECTIONS.events, existing.$id, fields)
  console.log(`Event ID: ${existing.$id} (status: ${existing.status})`)
} else {
  const id = crypto.randomUUID().replaceAll("-", "")
  console.log(`+ create ${profile.code} as draft`)
  if (apply) await target.docs.create(COLLECTIONS.events, id, { ...fields, status: "draft" })
  if (apply) console.log(`Event ID: ${id}`)
}
