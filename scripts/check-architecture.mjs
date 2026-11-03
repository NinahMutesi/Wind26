// Project rules that a linter can't express. Runs in CI on every pull request.
// Each rule exists because of a problem found in the REC codebase.
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SCHEMA } from "../lib/server/db/schema.mjs"

const SOURCE_DIRS = ["app", "components", "lib", "scripts"]
const EXT = /\.(m?js|jsx)$/

function walk(dir, out = []) {
  let entries = []
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXT.test(name)) out.push(full)
  }
  return out
}

export function runChecks(root) {
  const errors = []
  const files = SOURCE_DIRS.flatMap((d) => walk(path.join(root, d)))
  const rel = (f) => path.relative(root, f).split(path.sep).join("/")

  for (const file of files) {
    const name = rel(file)
    const text = readFileSync(file, "utf8")
    const imports = [...text.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)].map((m) => m[1])
    const isClient = /^\s*["']use client["']/.test(text)
    const inDb = name.startsWith("lib/server/db/")
    const isRule = name === "scripts/check-architecture.mjs"

    // 1. Database access goes through eventScope/globalStore, never the raw client.
    if (!inDb && imports.some((i) => /db\/appwrite\.mjs$|db\/stores\.mjs$/.test(i))) {
      errors.push(`${name}: import data access from lib/server/db/index.mjs, not the raw client or stores.`)
    }
    if (!inDb && !name.startsWith("scripts/") && imports.some((i) => /db\/rest\.mjs$/.test(i))) {
      errors.push(`${name}: only lib/server/db and admin scripts may use the REST client.`)
    }
    // 2. Browser code never touches server modules or secrets.
    if (isClient && imports.some((i) => i.includes("lib/server"))) {
      errors.push(`${name}: client components must not import lib/server.`)
    }
    if (/NEXT_PUBLIC_/.test(text) && !isRule) {
      errors.push(`${name}: NEXT_PUBLIC_ variables are not used in this project; configuration stays on the server.`)
    }
    // 3. No client permissions, ever (REC created collections writable by "any").
    if (/(read|create|update|delete|write)\(\\?["'](any|users|guests)/.test(text) && !isRule) {
      errors.push(`${name}: grants client permissions. Only the server's API key may access data.`)
    }
    // 4. Event details belong in events/<key>/, not in code (REC hardcoded halls, serials and URLs).
    if (!name.startsWith("scripts/") && /WIND26|REC2\d|rec\.nrep\.ug|Silver Springs|Bugolobi/i.test(text)) {
      errors.push(`${name}: contains event-specific text. Put it in events/<key>/event.json or a layout file.`)
    }
    // 5. No secret fallbacks (REC fell back from its token secret to the Appwrite API key).
    if (/SESSION_SECRET\s*\|\||\|\|\s*process\.env\.APPWRITE_API_KEY/.test(text)) {
      errors.push(`${name}: secrets must not fall back to other values.`)
    }
  }

  // 6. Every event collection carries eventId and is indexed on it.
  for (const c of SCHEMA.filter((s) => s.eventScoped)) {
    const attr = c.attributes.find((a) => a.key === "eventId")
    if (!attr?.required) errors.push(`schema ${c.id}: event collections need a required eventId attribute.`)
    if (!c.indexes.some((i) => i.attributes[0] === "eventId")) errors.push(`schema ${c.id}: add an index that starts with eventId.`)
  }
  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = runChecks(process.cwd())
  if (errors.length) {
    console.error(`Architecture check failed:\n  - ${errors.join("\n  - ")}`)
    process.exit(1)
  }
  console.log("Architecture check passed.")
}
