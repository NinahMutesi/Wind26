// Minimal Appwrite REST client. No SDK, so the response format is pinned and
// upgrades never change behaviour silently. Used by the app (through
// appwrite.mjs) and by the setup scripts.

const RESPONSE_FORMAT = "1.9.0"
const TIMEOUT_MS = 20_000
const ATTEMPTS = 3

export class AppwriteError extends Error {
  constructor(message, status, type) {
    super(message)
    this.name = "AppwriteError"
    this.status = status
    this.type = type
  }
}

// Appwrite JSON query syntax (Appwrite 1.5+).
const q = (method, attribute, values) =>
  JSON.stringify(attribute === undefined ? { method } : values === undefined ? { method, attribute } : { method, attribute, values })

export const Query = Object.freeze({
  equal: (attr, value) => q("equal", attr, Array.isArray(value) ? value : [value]),
  greaterThan: (attr, value) => q("greaterThan", attr, [value]),
  greaterThanEqual: (attr, value) => q("greaterThanEqual", attr, [value]),
  orderAsc: (attr) => q("orderAsc", attr),
  orderDesc: (attr) => q("orderDesc", attr),
  limit: (n) => JSON.stringify({ method: "limit", values: [n] }),
  cursorAfter: (id) => JSON.stringify({ method: "cursorAfter", values: [id] }),
})

function isTransient(error) {
  const code = error?.cause?.code || error?.code || ""
  return ["ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(code)
    || error?.name === "TimeoutError"
}

export function createRestClient({ endpoint, projectId, apiKey }) {
  if (!endpoint || !projectId || !apiKey) throw new Error("Appwrite endpoint, project ID and API key are required.")
  const base = endpoint.replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1"

  async function request(path, { method = "GET", body, queries = [] } = {}) {
    const url = new URL(base + path)
    for (const query of queries) url.searchParams.append("queries[]", query)
    let lastError
    // Only reads are retried automatically. Writes use explicit IDs, so a
    // retried create returns 409 instead of writing twice.
    const attempts = method === "GET" ? ATTEMPTS : 1
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "X-Appwrite-Project": projectId,
            "X-Appwrite-Key": apiKey,
            "X-Appwrite-Response-Format": RESPONSE_FORMAT,
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (response.status === 204) return null
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new AppwriteError(payload?.message || `Appwrite ${method} ${path} failed (${response.status})`, response.status, payload?.type)
        }
        return payload
      } catch (error) {
        lastError = error
        if (error instanceof AppwriteError || !isTransient(error) || attempt === attempts) break
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
      }
    }
    if (lastError instanceof AppwriteError) throw lastError
    throw new AppwriteError("The database could not be reached. Try again in a moment.", 503, "network")
  }

  return { request }
}

// Uses the TablesDB API (Appwrite 1.8+), whose rows.read and rows.write key scopes
// are the ones the Appwrite console offers. The rest of the app still calls the
// tables "collections" and the rows "documents"; list results are returned as
// { total, documents } so nothing above this file changes.
export function documentsApi(client, databaseId) {
  if (!databaseId) throw new Error("Appwrite database ID is required.")
  const rows = (tableId) => `/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(tableId)}/rows`
  return {
    async get(tableId, id) {
      try {
        return await client.request(`${rows(tableId)}/${encodeURIComponent(id)}`)
      } catch (error) {
        // Only a missing row means "not found". A missing table or database is a setup problem.
        if (error.status === 404 && /^(row|document)_not_found$/.test(error.type || "")) return null
        throw error
      }
    },
    async list(tableId, queries = []) {
      const result = await client.request(rows(tableId), { queries })
      return { total: result?.total ?? 0, documents: result?.rows || [] }
    },
    create: (tableId, id, data) =>
      client.request(rows(tableId), { method: "POST", body: { rowId: id, data, permissions: [] } }),
    update: (tableId, id, data) =>
      client.request(`${rows(tableId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: { data } }),
    remove: (tableId, id) =>
      client.request(`${rows(tableId)}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  }
}
