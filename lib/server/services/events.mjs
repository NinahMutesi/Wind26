import "server-only"
import crypto from "node:crypto"
import { COLLECTIONS, Query, globalStore } from "../db/index.mjs"
import { badRequest, notFound } from "../errors.mjs"
import { eventDays } from "../../shared/event-days.mjs"

const STATUS_FLOW = { draft: ["live"], live: ["closed"], closed: ["live", "archived"], archived: [] }

export function publicEvent(e) {
  return {
    id: e.$id, code: e.code, name: e.name, shortName: e.shortName || "", venue: e.venue || "",
    startDate: e.startDate, endDate: e.endDate, timezone: e.timezone,
    checkinOpens: e.checkinOpens, checkinCloses: e.checkinCloses,
    certificateMinDays: e.certificateMinDays, status: e.status, days: eventDays(e),
  }
}

export async function getEvent(eventId) {
  const event = await globalStore().get(COLLECTIONS.events, eventId)
  if (!event) throw notFound("Event not found.")
  return event
}

export async function listEvents() {
  const rows = await globalStore().listAll(COLLECTIONS.events, [Query.orderDesc("startDate")])
  return rows.map(publicEvent)
}

export async function changeEventStatus(event, nextStatus, audit) {
  if (!(STATUS_FLOW[event.status] || []).includes(nextStatus)) {
    throw badRequest(`An event that is ${event.status} can't be moved to ${nextStatus}.`)
  }
  const updated = await globalStore().update(COLLECTIONS.events, event.$id, { status: nextStatus })
  await audit({ action: "event.status", targetId: event.$id, details: { from: event.status, to: nextStatus } })
  return updated
}

export const newDocId = () => crypto.randomUUID().replaceAll("-", "")
