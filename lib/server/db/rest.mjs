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

export function documentsApi(client, databaseId) {
  if (!databaseId) throw new Error("Appwrite database ID is required.")
  const col = (collectionId) => `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`
  return {
    async get(collectionId, id) {
      try {
        return await client.request(`${col(collectionId)}/${encodeURIComponent(id)}`)
      } catch (error) {
        if (error.status === 404) return null
        throw error
      }
    },
    list: (collectionId, queries = []) => client.request(col(collectionId), { queries }),
    create: (collectionId, id, data) =>
      client.request(col(collectionId), { method: "POST", body: { documentId: id, data, permissions: [] } }),
    update: (collectionId, id, data) =>
      client.request(`${col(collectionId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: { data } }),
    remove: (collectionId, id) =>
      client.request(`${col(collectionId)}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  }
}
