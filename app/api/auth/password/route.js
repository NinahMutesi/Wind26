export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson, clientIp } from "@/lib/server/http.mjs"
import { signInWithPassword } from "@/lib/server/auth.mjs"

export const POST = route(async (request) => {
  const body = await readJson(request)
  await signInWithPassword(body.password, clientIp(request), request.headers.get("user-agent") || "")
  return json({ ok: true, redirectTo: "/admin" })
})
