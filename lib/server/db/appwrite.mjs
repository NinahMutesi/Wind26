import "server-only"
import { createRestClient, documentsApi } from "./rest.mjs"
import { env } from "../env.mjs"

// The only place the app builds a database handle. scripts/check-architecture.mjs
// fails CI if any file outside lib/server/db imports this module, so all data
// access goes through event-scope.mjs (event data) or global.mjs (everything else).

let docs = null

export function documents() {
  if (!docs) {
    const { appwrite } = env()
    docs = documentsApi(createRestClient(appwrite), appwrite.databaseId)
  }
  return docs
}
