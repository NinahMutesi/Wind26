// Creates the database, tables, columns and indexes from lib/server/db/schema.mjs,
// through Appwrite's TablesDB API. Schema only: it never copies rows from anywhere.
//
//   npm run db:setup              # dry run: shows what would change
//   npm run db:setup -- --apply   # makes the changes
//
// Uses APPWRITE_SETUP_API_KEY. Scopes: databases, tables, columns and indexes (read and write).
import { SCHEMA } from "../lib/server/db/schema.mjs"
import { banner, connect, fail, parseArgs } from "./lib/cli.mjs"

const args = parseArgs()
const apply = args.apply === true
const target = connect({ keyVar: "APPWRITE_SETUP_API_KEY" })
const { client, databaseId } = target
banner(target, apply)

const db = `/tablesdb/${encodeURIComponent(databaseId)}`
const tablePath = (id) => `${db}/tables/${encodeURIComponent(id)}`
const VARCHAR_MAX = 4000 // longer strings become mediumtext, which is stored outside the row

// Maps the schema's column types onto TablesDB column endpoints and bodies.
function columnRequest(attr) {
  if (attr.type === "string") {
    return attr.size > VARCHAR_MAX
      ? ["mediumtext", { key: attr.key, required: attr.required }]
      : ["varchar", { key: attr.key, size: attr.size, required: attr.required }]
  }
  if (attr.type === "integer") return ["integer", { key: attr.key, required: attr.required, min: attr.min, max: attr.max }]
  if (attr.type === "enum") return ["enum", { key: attr.key, elements: attr.elements, required: attr.required }]
  if (attr.type === "datetime") return ["datetime", { key: attr.key, required: attr.required }]
  throw new Error(`Unknown column type ${attr.type}`)
}

async function getOrNull(path) {
  try {
    return await client.request(path)
  } catch (error) {
    if (error.status === 404) return null
    if (error.status === 401) fail(`The setup key is missing a permission: ${error.message.replace(/^\S+@\S+ /, "")}`)
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
  if (apply) await client.request("/tablesdb", { method: "POST", body: { databaseId, name: "Events" } })
} else {
  // Guard against pointing this at the REC database by mistake.
  const existing = await client.request(`${db}/tables`, { queries: [JSON.stringify({ method: "limit", values: [100] })] })
  const foreign = (existing.tables || []).filter((t) => /^rec_/.test(t.$id) || ["scanner_allocations", "event_scans", "session_cross_flags"].includes(t.$id))
  if (foreign.length) {
    fail(`Database ${databaseId} contains REC tables (${foreign.map((t) => t.$id).join(", ")}). Use a new project and database for this system.`)
  }
}

for (const table of SCHEMA) {
  const current = database ? await getOrNull(tablePath(table.id)) : null
  if (!current) {
    console.log(`+ table ${table.id}`)
    if (apply) {
      await client.request(`${db}/tables`, {
        method: "POST",
        body: { tableId: table.id, name: table.name, permissions: [], rowSecurity: false, enabled: true },
      })
    }
  } else if ((current.$permissions || []).length || current.rowSecurity) {
    console.log(`~ table ${table.id}: removing client permissions ${JSON.stringify(current.$permissions)}`)
    if (apply) {
      await client.request(tablePath(table.id), {
        method: "PUT",
        body: { name: current.name, permissions: [], rowSecurity: false, enabled: true },
      })
    }
  }

  for (const attr of table.attributes) {
    const exists = current ? await getOrNull(`${tablePath(table.id)}/columns/${attr.key}`) : null
    if (exists) continue
    const [type, body] = columnRequest(attr)
    console.log(`  + column ${table.id}.${attr.key} (${type}${attr.required ? ", required" : ""})`)
    if (apply) await client.request(`${tablePath(table.id)}/columns/${type}`, { method: "POST", body })
  }
  if (apply) {
    for (const attr of table.attributes) await waitFor(`${tablePath(table.id)}/columns/${attr.key}`, `${table.id}.${attr.key}`)
  }

  for (const index of table.indexes) {
    const exists = current ? await getOrNull(`${tablePath(table.id)}/indexes/${index.key}`) : null
    if (exists) continue
    console.log(`  + index ${table.id}.${index.key} (${index.type}: ${index.attributes.join(", ")})`)
    if (!apply) continue
    await client.request(`${tablePath(table.id)}/indexes`, {
      method: "POST",
      body: { key: index.key, type: index.type, columns: index.attributes, orders: index.attributes.map(() => "ASC") },
    })
    await waitFor(`${tablePath(table.id)}/indexes/${index.key}`, `index ${table.id}.${index.key}`)
  }
}

console.log(apply ? "\nDone. The schema is up to date." : "\nDry run complete. Run again with --apply to make these changes.")
