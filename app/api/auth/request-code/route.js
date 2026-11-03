export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json, readJson } from "@/lib/server/http.mjs"
import { requestSignInCode } from "@/lib/server/auth.mjs"

export const POST = route(async (request) => {
  const body = await readJson(request)
  await requestSignInCode(body.email)
  return json({ ok: true, message: "If this email has access, a sign-in code is on its way." })
})
