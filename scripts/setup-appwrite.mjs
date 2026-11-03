// Creates the database, collections, attributes and indexes from lib/server/db/schema.mjs.
// Schema only: it never copies documents from anywhere.
//
//   npm run db:setup              # dry run: shows what would change
//   npm run db:setup -- --apply   # makes the changes
//
// Uses APPWRITE_SETUP_API_KEY (needs databases.* and collections.* scopes).
import { SCHEMA } from "../lib/server/db/schema.mjs"
import { banner, connect, fail, parseArgs } from "./lib/cli.mjs"

const args = parseArgs()
const apply = args.apply === true
const target = connect({ keyVar: "APPWRITE_SETUP_API_KEY" })
const { client, databaseId } = target
banner(target, apply)

const db = `/databases/${encodeURIComponent(databaseId)}`
const colPath = (id) => `${db}/collections/${encodeURIComponent(id)}`

async function getOrNull(path) {
  try {
    return await client.request(path)
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

async function waitFor(path, label) {
  for (let i = 0; i < 90; i += 1) {
    const item = await getOrNull(path)
    if (item?.status === "available") return
    if (item?.status === "failed") fail(`${label} failed to build: ${item.error || "unknown reason"}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  fail(`Timed out waiting for ${label}.`)
}

const database = await getOrNull(db)
if (!database) {
  console.log(`+ database ${databaseId}`)
  if (apply) await client.request("/databases", { method: "POST", body: { databaseId, name: "Events" } })
} else {
  // Guard against pointing this at the REC database by mistake.
  const existing = await client.request(`${db}/collections`, { queries: [JSON.stringify({ method: "limit", values: [100] })] })
  const foreign = (existing.collections || []).filter((c) => /^rec_/.test(c.$id) || ["scanner_allocations", "event_scans", "session_cross_flags"].includes(c.$id))
  if (foreign.length) {
    fail(`Database ${databaseId} contains REC collections (${foreign.map((c) => c.$id).join(", ")}). Use a new project and database for this system.`)
  }
}

for (const collection of SCHEMA) {
  const current = database ? await getOrNull(colPath(collection.id)) : null
  if (!current) {
    console.log(`+ collection ${collection.id}`)
    if (apply) {
      await client.request(`${db}/collections`, {
        method: "POST",
        body: { collectionId: collection.id, name: collection.name, permissions: [], documentSecurity: false, enabled: true },
      })
    }
  } else if ((current.$permissions || []).length || current.documentSecurity) {
    console.log(`~ collection ${collection.id}: removing client permissions ${JSON.stringify(current.$permissions)}`)
    if (apply) {
      await client.request(colPath(collection.id), {
        method: "PUT",
        body: { name: current.name, permissions: [], documentSecurity: false, enabled: true },
      })
    }
  }

  for (const attr of collection.attributes) {
    const exists = current ? await getOrNull(`${colPath(collection.id)}/attributes/${attr.key}`) : null
    if (exists) continue
    console.log(`  + attribute ${collection.id}.${attr.key} (${attr.type}${attr.required ? ", required" : ""})`)
    if (!apply) continue
    const body = { key: attr.key, required: attr.required }
    if (attr.type === "string") body.size = attr.size
    if (attr.type === "integer") Object.assign(body, { min: attr.min, max: attr.max })
    if (attr.type === "enum") body.elements = attr.elements
    await client.request(`${colPath(collection.id)}/attributes/${attr.type}`, { method: "POST", body })
  }
  if (apply) {
    for (const attr of collection.attributes) await waitFor(`${colPath(collection.id)}/attributes/${attr.key}`, `${collection.id}.${attr.key}`)
  }

  for (const index of collection.indexes) {
    const exists = current ? await getOrNull(`${colPath(collection.id)}/indexes/${index.key}`) : null
    if (exists) continue
    console.log(`  + index ${collection.id}.${index.key} (${index.type}: ${index.attributes.join(", ")})`)
    if (!apply) continue
    await client.request(`${colPath(collection.id)}/indexes`, {
      method: "POST",
      body: { key: index.key, type: index.type, attributes: index.attributes, orders: index.attributes.map(() => "ASC") },
    })
    await waitFor(`${colPath(collection.id)}/indexes/${index.key}`, `index ${collection.id}.${index.key}`)
  }
}

console.log(apply ? "\nDone. The schema is up to date." : "\nDry run complete. Run again with --apply to make these changes.")
