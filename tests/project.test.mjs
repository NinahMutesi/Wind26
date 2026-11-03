import test from "node:test"
import assert from "node:assert/strict"
import { runChecks } from "../scripts/check-architecture.mjs"
import { SCHEMA } from "../lib/server/db/schema.mjs"
import { readEnv } from "../lib/server/env.mjs"

test("architecture rules pass", () => {
  assert.deepEqual(runChecks(process.cwd()), [])
})

test("every event collection has a required, indexed eventId", () => {
  for (const c of SCHEMA.filter((s) => s.eventScoped)) {
    assert.ok(c.attributes.find((a) => a.key === "eventId")?.required, c.id)
    assert.ok(c.indexes.some((i) => i.attributes[0] === "eventId"), c.id)
  }
})

const goodEnv = {
  APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1", APPWRITE_PROJECT_ID: "p", APPWRITE_DATABASE_ID: "events",
  APPWRITE_API_KEY: "key", APP_URL: "https://events.example.org", SESSION_SECRET: "x".repeat(40),
  EMAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.example.org", EMAIL_FROM: "a@b.co", NODE_ENV: "production",
}

test("configuration has no fallbacks and refuses unsafe values", () => {
  assert.equal(readEnv(goodEnv).appUrl, "https://events.example.org")
  assert.throws(() => readEnv({ ...goodEnv, SESSION_SECRET: "" }), /SESSION_SECRET/)
  assert.throws(() => readEnv({ ...goodEnv, SESSION_SECRET: "short" }), /32 characters/)
  assert.throws(() => readEnv({ ...goodEnv, SESSION_SECRET: "k".repeat(40), APPWRITE_API_KEY: "k".repeat(40) }), /must not be the Appwrite API key/)
  assert.throws(() => readEnv({ ...goodEnv, APP_URL: "http://events.example.org" }), /https/)
  assert.throws(() => readEnv({ ...goodEnv, EMAIL_TRANSPORT: "console" }), /local development/)
})
