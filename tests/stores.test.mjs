import test from "node:test"
import assert from "node:assert/strict"
import { createEventScope, createGlobalStore } from "../lib/server/db/stores.mjs"
import { COLLECTIONS } from "../lib/server/db/schema.mjs"
import { Query } from "../lib/server/db/rest.mjs"
import { memoryStore } from "./memory-store.mjs"

async function twoEvents() {
  const store = memoryStore()
  const a = createEventScope(store, "eventA")
  const b = createEventScope(store, "eventB")
  await a.create(COLLECTIONS.attendees, "att1", { fullName: "Grace", tagId: "t1" })
  await b.create(COLLECTIONS.attendees, "att2", { fullName: "Peter", tagId: "t2" })
  return { store, a, b }
}

test("reads only see the scope's own event", async () => {
  const { a, b } = await twoEvents()
  assert.deepEqual((await a.listAll(COLLECTIONS.attendees)).map((d) => d.$id), ["att1"])
  assert.deepEqual((await b.listAll(COLLECTIONS.attendees)).map((d) => d.$id), ["att2"])
  assert.equal(await a.findOne(COLLECTIONS.attendees, [Query.equal("tagId", "t2")]), null, "another event's tag is not found")
})

test("a document from another event looks missing", async () => {
  const { a } = await twoEvents()
  assert.equal(await a.get(COLLECTIONS.attendees, "att2"), null)
  assert.equal(await a.update(COLLECTIONS.attendees, "att2", { fullName: "Hacked" }), null)
  assert.equal(await a.remove(COLLECTIONS.attendees, "att2"), false)
})

test("writes are stamped with the event and can't move a document", async () => {
  const { store, a } = await twoEvents()
  const doc = await a.create(COLLECTIONS.checkins, "c1", { attendeeId: "att1" })
  assert.equal(doc.eventId, "eventA")
  await assert.rejects(() => a.create(COLLECTIONS.checkins, "c2", { eventId: "eventB" }), /eventId/)
  await assert.rejects(() => a.update(COLLECTIONS.attendees, "att1", { eventId: "eventB" }), /eventId/)
  assert.equal((await store.get(COLLECTIONS.attendees, "att1")).eventId, "eventA")
})

test("event scope refuses global collections and global store refuses event ones", async () => {
  const store = memoryStore()
  const scope = createEventScope(store, "eventA")
  await assert.rejects(() => scope.list(COLLECTIONS.staff), /not an event collection/)
  const global = createGlobalStore(store)
  await assert.rejects(() => global.list(COLLECTIONS.attendees), /eventScope/)
})

test("invalid ids are rejected before reaching the database", async () => {
  const store = memoryStore()
  assert.throws(() => createEventScope(store, "../etc"), /Invalid eventId/)
  const scope = createEventScope(store, "eventA")
  assert.equal(await scope.get(COLLECTIONS.attendees, "bad id with spaces"), null)
})

test("listAll pages through more than one page", async () => {
  const store = memoryStore()
  const scope = createEventScope(store, "eventA")
  for (let i = 0; i < 230; i += 1) await scope.create(COLLECTIONS.attendees, `a${String(i).padStart(3, "0")}`, { fullName: `P${i}` })
  assert.equal((await scope.listAll(COLLECTIONS.attendees)).length, 230)
})
