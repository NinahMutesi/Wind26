// Reads and validates configuration once. There are no fallbacks between
// secrets: a missing or weak value stops the request with a clear message
// instead of quietly using another key (a problem in the REC codebase).

let cached = null

const REQUIRED = [
  "APPWRITE_ENDPOINT",
  "APPWRITE_PROJECT_ID",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
  "APP_URL",
  "SESSION_SECRET",
  "EMAIL_TRANSPORT",
  "EMAIL_FROM",
]

export function readEnv(input = process.env) {
  // On Vercel, APP_URL may be left empty: the project's production address is used.
  // It never changes for a project, so QR codes made from it keep working.
  const source = !String(input.APP_URL || "").trim() && input.VERCEL_PROJECT_PRODUCTION_URL
    ? { ...input, APP_URL: `https://${input.VERCEL_PROJECT_PRODUCTION_URL}` }
    : input
  const missing = REQUIRED.filter((key) => !String(source[key] || "").trim())
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`)

  const production = source.NODE_ENV === "production"
  const appUrl = new URL(source.APP_URL)
  if (production && appUrl.protocol !== "https:") throw new Error("APP_URL must use https in production.")

  const sessionSecret = String(source.SESSION_SECRET)
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.")
  if (sessionSecret === source.APPWRITE_API_KEY) throw new Error("SESSION_SECRET must not be the Appwrite API key.")

  const transport = String(source.EMAIL_TRANSPORT).toLowerCase()
  if (!["smtp", "http", "console", "none"].includes(transport)) throw new Error("EMAIL_TRANSPORT must be smtp, http, console or none.")
  if (transport === "console" && production) throw new Error("EMAIL_TRANSPORT=console is only for local development.")
  if (transport === "smtp" && !source.SMTP_HOST) throw new Error("SMTP_HOST is required when EMAIL_TRANSPORT=smtp.")
  if (transport === "http" && !source.EMAIL_HTTP_URL) throw new Error("EMAIL_HTTP_URL is required when EMAIL_TRANSPORT=http.")

  // signin: staff get an emailed code. password: one shared admin password, no email needed to sign in.
  // open: no sign-in, for one person running the event from their own computer. It is refused
  // anywhere the site could be reached by someone else.
  const adminAccess = String(source.ADMIN_ACCESS || "signin").toLowerCase()
  if (!["signin", "password", "open"].includes(adminAccess)) throw new Error("ADMIN_ACCESS must be signin, password or open.")
  if (adminAccess === "open" && production) throw new Error("ADMIN_ACCESS=open is for local use only. Use password or signin in production.")
  if (adminAccess === "open" && !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname)) {
    throw new Error("ADMIN_ACCESS=open needs APP_URL on localhost.")
  }
  const adminPassword = String(source.ADMIN_PASSWORD || "")
  if (adminAccess === "password") {
    if (adminPassword.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters when ADMIN_ACCESS=password.")
    if ([sessionSecret, source.APPWRITE_API_KEY].includes(adminPassword)) throw new Error("ADMIN_PASSWORD must not reuse another secret.")
  }

  return Object.freeze({
    production,
    adminAccess,
    adminOpen: adminAccess === "open",
    adminPassword,
    appUrl: appUrl.origin,
    appwrite: Object.freeze({
      endpoint: source.APPWRITE_ENDPOINT,
      projectId: source.APPWRITE_PROJECT_ID,
      databaseId: source.APPWRITE_DATABASE_ID,
      apiKey: source.APPWRITE_API_KEY,
    }),
    sessionSecret,
    email: Object.freeze({
      transport,
      from: source.EMAIL_FROM,
      smtp: Object.freeze({
        host: source.SMTP_HOST,
        port: Number(source.SMTP_PORT || 587),
        secure: String(source.SMTP_SECURE || "false") === "true",
        user: source.SMTP_USER,
        pass: source.SMTP_PASS,
      }),
      httpUrl: source.EMAIL_HTTP_URL,
      httpToken: source.EMAIL_HTTP_TOKEN || "",
    }),
  })
}

export function env() {
  if (!cached) cached = readEnv()
  return cached
}
