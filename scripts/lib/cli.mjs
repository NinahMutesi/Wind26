import dotenv from "dotenv"
import { createRestClient, documentsApi } from "../../lib/server/db/rest.mjs"

// Shared by the admin scripts. Every script is a dry run unless --apply is given,
// and every script prints exactly which project and database it will touch.

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith("--")) { args._.push(a); continue }
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) args[key] = true
    else { args[key] = next; i += 1 }
  }
  return args
}

export function connect({ keyVar = "APPWRITE_API_KEY" } = {}) {
  const endpoint = process.env.APPWRITE_ENDPOINT
  const projectId = process.env.APPWRITE_PROJECT_ID
  const databaseId = process.env.APPWRITE_DATABASE_ID
  const apiKey = process.env[keyVar]
  const missing = [["APPWRITE_ENDPOINT", endpoint], ["APPWRITE_PROJECT_ID", projectId], ["APPWRITE_DATABASE_ID", databaseId], [keyVar, apiKey]]
    .filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) fail(`Set ${missing.join(", ")} in .env.local first.`)
  const client = createRestClient({ endpoint, projectId, apiKey })
  return { client, docs: documentsApi(client, databaseId), endpoint, projectId, databaseId }
}

export function banner(target, apply) {
  console.log(`\nTarget: ${target.endpoint}  project=${target.projectId}  database=${target.databaseId}`)
  console.log(apply ? "Mode:   APPLY (changes will be written)\n" : "Mode:   dry run (nothing is written; add --apply to make changes)\n")
}

export function fail(message) {
  console.error(`\nError: ${message}\n`)
  process.exit(1)
}
