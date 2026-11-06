import test from "node:test"
import assert from "node:assert/strict"
import { createEventScope } from "../lib/server/db/stores.mjs"
import { COLLECTIONS } from "../lib/server/db/schema.mjs"
import { scannerCheckin, adminCheckin, scannerSummary } from "../lib/server/services/checkins.mjs"
import { issueCertificates } from "../lib/server/services/certificates.mjs"
import { memoryStore } from "./memory-store.mjs"

// Services run with `--conditions=react-server` (see package.json) so their
// "server-only" import resolves the way it does inside Next.js.

const base = {
  code: "TEST26", name: "Test Workshop", startDate: "2026-11-10", endDate: "2026-11-12", timezone: "Africa/Kampala",
  checkinOpens: "00:00", checkinCloses: "23:59", certificateMinDays: 2, designKey: "wind26", status: "live",
}
const TAG_A = "3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69"
const TAG_B = "7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d"
const operator = { id: "op1", email: "usher@example.org" }
const noAudit = async () => {}

async function setup(t) {
  // Freeze "today" to day 2 of the event.
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-11T07:00:00Z") })
  const store = memoryStore()
  const a = createEventScope(store, "eventA")
  const b = createEventScope(store, "eventB")
  await a.create(COLLECTIONS.attendees, "grace", { fullName: "Grace Achieng", tagId: TAG_A, role: "participant" })
  await b.create(COLLECTIONS.attendees, "peter", { fullName: "Peter Okello", tagId: TAG_B, role: "participant" })
  return { store, a, b, eventA: { ...base, $id: "eventA" } }
}

test("a QR scan checks the attendee in once per day", async (t) => {
  const { a, eventA } = await setup(t)
  const first = await scannerCheckin(a, eventA, operator, { code: `https://events.example.org/t/${TAG_A}` })
  assert.equal(first.status, "accepted")
  assert.equal(first.day, 2)
  const again = await scannerCheckin(a, eventA, operator, { code: TAG_A })
  assert.equal(again.status, "duplicate")
  assert.equal((await a.listAll(COLLECTIONS.checkins)).length, 1)
})

test("a tag from another event is rejected and nothing is written to either event", async (t) => {
  const { a, b, eventA } = await setup(t)
  await assert.rejects(() => scannerCheckin(a, eventA, operator, { code: TAG_B }), /isn't registered for/)
  assert.equal((await a.listAll(COLLECTIONS.checkins)).length, 0)
  assert.equal((await b.listAll(COLLECTIONS.checkins)).length, 0)
})

test("manual check-in needs a reason and can't reach another event's attendee", async (t) => {
  const { a, eventA } = await setup(t)
  await assert.rejects(() => scannerCheckin(a, eventA, operator, { attendeeId: "grace" }), /Choose why/)
  await assert.rejects(() => scannerCheckin(a, eventA, operator, { attendeeId: "peter", reason: "forgot_tag" }), /not found/)
  const ok = await scannerCheckin(a, eventA, operator, { attendeeId: "grace", reason: "forgot_tag" })
  assert.equal(ok.status, "accepted")
  const [row] = await a.listAll(COLLECTIONS.checkins)
  assert.equal(row.source, "manual")
  assert.equal(row.reason, "forgot_tag")
})

test("outside check-in a QR scan is only a test: it names the person and records nothing", async (t) => {
  const { a, eventA } = await setup(t)
  for (const event of [{ ...eventA, status: "closed" }, { ...eventA, startDate: "2026-11-20", endDate: "2026-11-22" }, { ...eventA, checkinOpens: "12:00" }]) {
    const r = await scannerCheckin(a, event, operator, { code: TAG_A })
    assert.equal(r.status, "test")
    assert.equal(r.attendee.fullName, "Grace Achieng")
    assert.ok(r.message)
  }
  assert.equal((await a.listAll(COLLECTIONS.checkins)).length, 0, "nothing recorded")
  await assert.rejects(() => scannerCheckin(a, { ...eventA, status: "closed" }, operator, { code: TAG_B }), /isn't registered for/, "unknown badges still fail")
  await assert.rejects(() => scannerCheckin(a, { ...eventA, status: "closed" }, operator, { attendeeId: "grace", reason: "forgot_tag" }), /closed/, "manual check-in still refused")
})

test("certificates go only to attendees who meet the rule, once", async (t) => {
  const { a, eventA } = await setup(t)
  const admin = { id: "admin1", email: "admin@example.org" }
  await scannerCheckin(a, eventA, operator, { code: TAG_A })
  let [result] = await issueCertificates(a, eventA, admin, ["grace"], noAudit)
  assert.equal(result.status, "not_eligible")
  await adminCheckin(a, eventA, admin, { attendeeId: "grace", day: 1, reason: "paper_list" }, noAudit)
  ;[result] = await issueCertificates(a, eventA, admin, ["grace"], noAudit)
  assert.equal(result.status, "issued")
  assert.match(result.certificateId, /^[0-9a-f-]{36}$/)
  ;[result] = await issueCertificates(a, eventA, admin, ["grace"], noAudit)
  assert.equal(result.status, "already_issued")
  ;[result] = await issueCertificates(a, eventA, admin, ["peter"], noAudit)
  assert.equal(result.status, "not_found", "another event's attendee is invisible")
})

test("the scanner summary counts today's check-ins by method, half hour, operator and day", async (t) => {
  const { a, eventA } = await setup(t)
  await a.create(COLLECTIONS.attendees, "amos", { fullName: "Amos Mugisha", tagId: "9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", role: "participant" })
  await scannerCheckin(a, eventA, operator, { code: TAG_A })
  await scannerCheckin(a, eventA, { id: "op2", email: "desk@example.org" }, { attendeeId: "amos", reason: "forgot_tag" })
  const s = await scannerSummary(a, eventA, operator)
  assert.equal(s.total, 2)
  assert.equal(s.checkedInToday, 2)
  assert.deepEqual([s.today.qr, s.today.manual, s.today.mine], [1, 1, 1])
  assert.deepEqual(s.today.slots, [{ m: 600, count: 2 }]) // 07:00 UTC is 10:00 in Kampala
  assert.deepEqual(s.today.recent.map((r) => r.name).sort(), ["Amos Mugisha", "Grace Achieng"])
  assert.deepEqual(s.days.map((d) => d.count), [0, 2, 0])
})
