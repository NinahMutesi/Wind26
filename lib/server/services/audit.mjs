import "server-only"
import { COLLECTIONS } from "../db/index.mjs"
import { newDocId } from "./events.mjs"

// Returns an audit writer bound to one event and one actor. Audit rows are only
// ever created by the server; nothing updates or deletes them.
export function auditFor(db, actor) {
  return async ({ action, targetId = "", details = {} }) => {
    try {
      await db.create(COLLECTIONS.audit, newDocId(), {
        actorId: actor.id,
        action,
        targetId,
        details: JSON.stringify({ by: actor.email, ...details }).slice(0, 2000),
        at: new Date().toISOString(),
      })
    } catch (error) {
      // Never lose the main action because the audit write failed, but make it visible.
      console.error("Audit write failed", action, targetId, error)
    }
  }
}
