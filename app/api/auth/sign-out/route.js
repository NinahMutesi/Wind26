export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { route, json } from "@/lib/server/http.mjs"
import { signOut } from "@/lib/server/auth.mjs"

export const POST = route(async () => {
  await signOut()
  return json({ ok: true })
})
