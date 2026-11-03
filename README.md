# NREP Event Lite

Check-in, digital tags and certificates for small NREP events (up to a few hundred people, 1–2 scanners).
The first event is **WIND26**: the three-day capacity building programme on Wind Energy Power Plants,
10–12 November 2026, Silver Springs Hotel, Bugolobi.

It is built from the parts of the REC system this kind of event needs, with the REC problems fixed.
One codebase serves many events: each event is a profile and a design folder, not code.

## What it does

| For | What they get |
|---|---|
| Admins | Add or import attendees, print tags (four A6 per A4 sheet), email tags, see attendance per day, record or remove attendance with a reason, issue and email certificates, revoke them, manage scanners, open or close the event, read the activity log |
| Scanner (one phone) | Camera QR scanning, a box for handheld or Bluetooth scanners that type the code, name search with a required reason when a tag can't be scanned, today's count |
| Attendees | A tag link (`/t/<uuid>`) to show on their phone or save, and a certificate link (`/verify/<uuid>`) that anyone can use to confirm it's genuine |

Attendance is one check-in per person per day. Certificates go to attendees who meet the event's
`certificateMinDays` rule (WIND26 is set to all 3 days; change it in `events/wind26/event.json`).

## How data stays separate between events

- **The scanner's account decides the event, never the tag.** A tag from another event is simply "not registered for this event".
- **All event data goes through `eventScope(eventId)`** (`lib/server/db/stores.mjs`). Every query is filtered by `eventId`, every write is stamped with it, and another event's record looks missing. `npm run check:architecture` fails CI if code reaches the database any other way.
- **No client permissions on any collection.** Browsers never talk to Appwrite; only the server's API key does. There are no `NEXT_PUBLIC_` variables.
- **QR codes hold a random UUID v4** in a link (`https://<site>/t/<uuid>`). Reissuing a tag gives a new UUID and the old QR stops working everywhere. Certificates have their own, separate UUID.
- **One check-in per person per day is enforced by the database**: the record's ID is derived from event + attendee + date, so two scanners racing produce one record.
- **Manual check-ins need a reason**, are rate-limited per scanner, and admin corrections go to the audit log.
- **Staff sign in with an emailed 6-digit code.** Codes are hashed, expire in 10 minutes, allow 5 attempts, and are limited to 3 per 15 minutes. Sessions are random tokens stored only as hashes, in `HttpOnly`, `SameSite=Strict` cookies. Disabling a staff member signs them out immediately.
- **Every state-changing request must come from this site** (Origin check), plus strict security headers (CSP, no framing, camera allowed only for this site).
- **Configuration fails loudly.** No secret falls back to another (REC's token secret could fall back to the Appwrite API key).

## First-time setup

1. **Create a new Appwrite project.** Never reuse REC's project, database or keys.
2. Create two API keys in that project:
   - *Setup key*: `databases.read/write`, `collections.read/write`, `attributes.read/write`, `indexes.read/write`, `documents.read/write`. Keep it on your machine only.
   - *Runtime key*: `documents.read` and `documents.write` only. This is the one the server uses.
3. `cp .env.example .env.local` and fill it in. Generate `SESSION_SECRET` with the command in the file.
4. Install and set up the database. Every script is a dry run until you add `--apply`.
   ```bash
   npm ci
   npm run db:setup
   npm run db:setup -- --apply
   ```
   The setup script refuses to run against a database that contains REC collections.
5. Create the event and your admin account:
   ```bash
   npm run event:seed -- --event wind26 --apply
   npm run staff:add -- --email you@nrep.ug --name "Your Name" --role admin --apply
   ```
6. `npm run dev`, open http://localhost:3000/login and sign in. With `EMAIL_TRANSPORT=console` the code is printed in the terminal.
7. In the admin page: import attendees, add the scanner on **Scanners and event status**, then **Open check-in (go live)** before day 1.

## Tag and certificate designs

Designs live in `events/<designKey>/`:

```
events/wind26/
  event.json                 event profile (dates, venue, timezone, check-in hours, certificate rule)
  tag.layout.json            where the name, organisation and QR go on the tag (millimetres)
  certificate.layout.json    where the name, QR and certificate ID go on the certificate
  assets/tag-background.png          the tag artwork without name or QR
  assets/certificate-background.png  the certificate artwork without a name
```

**Important:** the two background images included now were rebuilt from screenshots and are low resolution.
They are fine for testing and phone tags, but **not for printing**. Before printing, ask the designer for:

- the tag artwork at **A6 (105 × 148 mm), 300 dpi (1240 × 1748 px)**, with the name, organisation and QR areas empty;
- the certificate artwork at **A4 landscape, 300 dpi (3508 × 2480 px)**, with the name line empty.

Replace the two PNGs with the same file names, then check the positions:

```bash
npm run design:preview -- --design wind26
```

This writes sample tags, certificates and the A4 print sheet to `previews/` (long names included) without
needing a database. Adjust `x`, `baseline`, `width` and `sizePt` in the layout files until they line up.
Long names shrink, then wrap to two lines, and are never cut off.

**A new event** is a new folder (copy `events/wind26`), a new `event.json`, and `npm run event:seed -- --event <folder> --apply`. No code changes.

## Email

Set `EMAIL_TRANSPORT`:

- `smtp`: any SMTP provider. Tags (PNG) and certificates (PDF) are attached as well as linked.
- `http`: posts `{ email, subject, text, html }` to `EMAIL_HTTP_URL` (for example the NREP portal email API that REC uses), with `Authorization: Bearer EMAIL_HTTP_TOKEN` if set. Links only, no attachments.
  REC calls that endpoint with no authentication; make sure it requires a token before relying on it.
- `console`: development only. Refused in production.

## Event-day checklist

- [ ] The day before: event is **live**, the scanner has signed in on the phone that will be used, and camera permission is allowed.
- [ ] Print the attendee list (Export attendance) as a paper backup each morning.
- [ ] If the internet drops: write names on paper. Afterwards, an admin records them with the reason "Recorded on the paper list".
- [ ] After day 3: check the Certificates tab, issue to everyone eligible, then email them.
- [ ] After the event: **Close the event**, export attendance, and archive it when certificates are done (archiving stops tag links; certificate links keep working).
- [ ] No production deploys from the day before the event until it ends, unless two people agree it's an urgent fix.

## Development

```bash
npm run check            # lint + architecture rules + tests
npm run build
npm run design:preview -- --design wind26
```

Tests use an in-memory database, so they need no Appwrite. CI (`.github/workflows/ci.yml`) runs lint,
the architecture rules, tests, the build, a dependency audit, a secret scan and CodeQL on every pull request.
Third-party actions are pinned to commit SHAs and Dependabot keeps them and npm packages up to date.

After creating the GitHub repository, turn on branch protection for `main`: require the CI checks and one
review, block force pushes, and fill in `.github/CODEOWNERS`.

See [docs/architecture.md](docs/architecture.md) for the code layout and the reasons behind it.
