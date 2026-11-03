export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { verifySignInCode } from "@/lib/server/auth.mjs"

export const POST = route(async (request) => {
  const body = await readJson(request)
  const { role } = await verifySignInCode(body.email, body.code, request.headers.get("user-agent") || "")
  return json({ ok: true, redirectTo: role === "admin" ? "/admin" : "/scan" })
})
