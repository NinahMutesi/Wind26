# Architecture

## Layout

```
app/                      Next.js pages and API routes (thin: auth, parse input, call a service)
  api/admin/events/[eventId]/...   admin endpoints, event taken from the URL and checked
  api/scan/...                     scanner endpoints, event taken from the scanner's account
  api/public/...                   tag image and certificate PDF, looked up by UUID
  t/[tagId]  verify/[certificateId]  public pages behind the QR codes
components/               browser UI (never imports lib/server)
lib/shared/               pure rules, used by server, browser and tests
  ids, event-days, attendance, csv, validation, format
lib/server/
  env.mjs                 validated configuration, no fallbacks
  auth.mjs                email codes, sessions, role checks
  http.mjs                route wrapper, same-origin check, safe errors
  context.mjs             adminContext / scannerContext -> { event, db, audit }
  db/schema.mjs           single source of truth for collections and indexes
  db/rest.mjs             minimal Appwrite REST client (pinned response format)
  db/stores.mjs           eventScope + globalStore: the isolation rules
  db/index.mjs            the only entry point the app uses
  services/               attendees, check-ins, certificates, documents, staff, audit
  render/                 layout engine -> PNG (resvg) and PDF (pdf-lib), bundled fonts
events/<key>/             event profile and designs (data, reviewed like code)
scripts/                  setup, seeding, staff, design previews, architecture rules
tests/                    node:test, in-memory database
```

## Decisions

**Shared collections with `eventId`, not a database per event.** One set of indexes serves many small
events. Isolation is enforced in one place (`eventScope`) and checked in CI. A client that needs its data
fully separate can get its own database later without changing services, because they only see `eventScope`.

**UUID v4 in the QR, looked up on the server.** For events of this size a random 122-bit ID is as safe as a
signed token and simpler. The QR holds a link so a phone camera opens the attendee's tag page, and the
scanner reads the UUID out of the same link. Keyboard-style handheld scanners work through the same input.

**Check-in dedupe by document ID.** `sha256(eventId:attendeeId:date)` is the check-in's ID, so the database
rejects a second check-in for the same day even when two devices scan at once. No locks needed.

**Designs as data.** A layout file places text and QR codes in millimetres over a background image.
The same draw list feeds the PNG (phones, email) and the PDF (printing), so they match. Fonts are bundled.

**No Appwrite SDK.** A 100-line REST client with a pinned response format avoids surprise changes on upgrade
and keeps the database surface small enough to test with an in-memory store.

## What was deliberately left out (for now)

Organisations and multi-tenant admins, event templates, quotas, Tera device leases, offline scan queues
and per-session attendance. The event profile, tag format, `eventId` on every row, server-only access and
the audit log are already in the shape the larger platform needs, so these can be added without rewrites.

## Problems in REC this design avoids

| REC | Here |
|---|---|
| `scanner_allocations`, `event_scans`, `session_cross_flags` writable by `any` | No client permissions anywhere; CI rejects them |
| One token secret for all events, falling back to the Appwrite API key | Dedicated `SESSION_SECRET`, validated, no fallbacks |
| Legacy scan rows without a conference ID | `eventId` required and indexed on every event collection |
| Eligibility by `conferenceYears` (two events in one year would mix) | Attendees belong to exactly one event |
| Scripts pick "the active conference or the first one" | Scripts take `--event`, print their target, and dry-run by default |
| Hall names, serials, lunch times and domains in code | Event profile and design folder; CI rejects event names in code |
| `clone_rec_to_test_database.mjs` copies personal data and permissions | Schema-only setup that refuses to run on a REC database |
