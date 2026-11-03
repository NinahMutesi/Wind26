import "server-only"
import { documents } from "./appwrite.mjs"
import { createEventScope, createGlobalStore } from "./stores.mjs"

export { COLLECTIONS } from "./schema.mjs"
export { Query } from "./rest.mjs"

export function eventScope(eventId) {
  return createEventScope(documents(), eventId)
}

export function globalStore() {
  return createGlobalStore(documents())
}
