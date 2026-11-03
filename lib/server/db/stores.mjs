import { Query } from "./rest.mjs"
import { COLLECTIONS, EVENT_SCOPED, GLOBAL } from "./schema.mjs"

// Data access rules, written against a plain `store` (get/list/create/update/remove)
// so the tests can run them against an in-memory store.

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/
const PAGE = 100
const MAX_PAGES = 100 // 10,000 rows: far above any event this kit is meant for

export function assertId(value, label = "id") {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error(`Invalid ${label}.`)
  return value
}

async function listAllFrom(store, collectionId, queries) {
  const rows = []
  let cursor = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await store.list(collectionId, [...queries, Query.limit(PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])])
    const docs = result?.documents || []
    rows.push(...docs)
    if (docs.length < PAGE) return rows
    cursor = docs[docs.length - 1].$id
  }
  throw new Error(`Too many rows in ${collectionId}.`)
}

// The only way to reach event data. Every query is filtered by eventId, every
// write is stamped with it, and a document from another event looks missing.
export function createEventScope(store, eventId) {
  assertId(eventId, "eventId")

  const checkCollection = (collectionId) => {
    if (!EVENT_SCOPED.has(collectionId)) throw new Error(`${collectionId} is not an event collection.`)
  }
  const checkData = (data) => {
    if (data && "eventId" in data && data.eventId !== eventId) throw new Error("A write tried to change eventId.")
  }

  const scope = {
    eventId,
    async get(collectionId, id) {
      checkCollection(collectionId)
      if (!ID_PATTERN.test(String(id || ""))) return null
      const doc = await store.get(collectionId, id)
      return doc && doc.eventId === eventId ? doc : null
    },
    async list(collectionId, queries = []) {
      checkCollection(collectionId)
      return store.list(collectionId, [Query.equal("eventId", eventId), ...queries])
    },
    async listAll(collectionId, queries = []) {
      checkCollection(collectionId)
      return listAllFrom(store, collectionId, [Query.equal("eventId", eventId), ...queries])
    },
    async findOne(collectionId, queries = []) {
      const result = await scope.list(collectionId, [...queries, Query.limit(1)])
      return result?.documents?.[0] || null
    },
    async count(collectionId, queries = []) {
      const result = await scope.list(collectionId, [...queries, Query.limit(1)])
      return Number(result?.total || 0)
    },
    async create(collectionId, id, data) {
      checkCollection(collectionId)
      checkData(data)
      return store.create(collectionId, assertId(id), { ...data, eventId })
    },
    async update(collectionId, id, data) {
      checkData(data)
      const current = await scope.get(collectionId, id)
      if (!current) return null
      const { eventId: _ignored, ...rest } = data
      return store.update(collectionId, id, rest)
    },
    async remove(collectionId, id) {
      const current = await scope.get(collectionId, id)
      if (!current) return false
      await store.remove(collectionId, id)
      return true
    },
  }
  return Object.freeze(scope)
}

// Collections that are not tied to one event: events, staff, sign-in codes and sessions.
// The two public lookups are the only reads that cross events, and they are
// deliberately narrow: one unguessable UUID in, one document out.
export function createGlobalStore(store) {
  const checkCollection = (collectionId) => {
    if (!GLOBAL.has(collectionId)) throw new Error(`${collectionId} must be accessed through eventScope.`)
  }
  return Object.freeze({
    async get(collectionId, id) {
      checkCollection(collectionId)
      if (!ID_PATTERN.test(String(id || ""))) return null
      return store.get(collectionId, id)
    },
    async list(collectionId, queries = []) {
      checkCollection(collectionId)
      return store.list(collectionId, queries)
    },
    async listAll(collectionId, queries = []) {
      checkCollection(collectionId)
      return listAllFrom(store, collectionId, queries)
    },
    async findOne(collectionId, queries = []) {
      checkCollection(collectionId)
      const result = await store.list(collectionId, [...queries, Query.limit(1)])
      return result?.documents?.[0] || null
    },
    async create(collectionId, id, data) {
      checkCollection(collectionId)
      return store.create(collectionId, assertId(id), data)
    },
    async update(collectionId, id, data) {
      checkCollection(collectionId)
      return store.update(collectionId, assertId(id), data)
    },
    async remove(collectionId, id) {
      checkCollection(collectionId)
      return store.remove(collectionId, assertId(id))
    },
    async findAttendeeByTagIdAnyEvent(tagId) {
      const result = await store.list(COLLECTIONS.attendees, [Query.equal("tagId", tagId), Query.limit(1)])
      return result?.documents?.[0] || null
    },
    async getCertificateAnyEvent(certificateId) {
      if (!ID_PATTERN.test(String(certificateId || ""))) return null
      return store.get(COLLECTIONS.certificates, certificateId)
    },
  })
}
