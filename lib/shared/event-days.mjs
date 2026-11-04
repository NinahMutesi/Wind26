// Event days and check-in hours, always in the event's own timezone.

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function localParts(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value])
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function eventDays(event) {
  if (!DATE.test(event?.startDate || "") || !DATE.test(event?.endDate || "")) return []
  const days = []
  for (let date = event.startDate, day = 1; date <= event.endDate && day <= 60; date = addDays(date, 1), day += 1) {
    days.push({ day, date })
  }
  return days
}

export function dayForDate(event, date) {
  return eventDays(event).find((d) => d.date === date) || null
}

export function validateEventProfile(event) {
  const errors = []
  if (!/^[A-Z0-9-]{2,32}$/.test(event?.code || "")) errors.push("code must be 2-32 capital letters, digits or hyphens")
  if (!String(event?.name || "").trim()) errors.push("name is required")
  if (!DATE.test(event?.startDate || "")) errors.push("startDate must be YYYY-MM-DD")
  if (!DATE.test(event?.endDate || "")) errors.push("endDate must be YYYY-MM-DD")
  if (event?.startDate && event?.endDate && event.endDate < event.startDate) errors.push("endDate is before startDate")
  if (!TIME.test(event?.checkinOpens || "")) errors.push("checkinOpens must be HH:MM")
  if (!TIME.test(event?.checkinCloses || "")) errors.push("checkinCloses must be HH:MM")
  if (event?.quizOpens && !TIME.test(event.quizOpens)) errors.push("quizOpens must be HH:MM")
  if (TIME.test(event?.checkinOpens || "") && TIME.test(event?.checkinCloses || "") && toMinutes(event.checkinCloses) <= toMinutes(event.checkinOpens)) {
    errors.push("checkinCloses must be after checkinOpens")
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: event?.timezone })
  } catch {
    errors.push("timezone is not a valid IANA timezone")
  }
  if (!/^[a-z0-9-]{1,64}$/.test(event?.designKey || "")) errors.push("designKey must be lower-case letters, digits or hyphens")
  const min = Number(event?.certificateMinDays)
  if (!Number.isInteger(min) || min < 0 || min > eventDays(event).length) errors.push("certificateMinDays must be between 0 and the number of event days")
  return errors
}

// Decides whether a scan can be recorded now, and for which day.
export function checkinWindow(event, now = new Date()) {
  if (event?.status !== "live") {
    return { ok: false, code: "event_not_live", message: "Check-in is closed for this event." }
  }
  const { date, minutes } = localParts(event.timezone, now)
  const current = dayForDate(event, date)
  if (!current) {
    return { ok: false, code: "not_event_day", message: `Today (${date}) is not an event day.`, date }
  }
  if (minutes < toMinutes(event.checkinOpens) || minutes > toMinutes(event.checkinCloses)) {
    return {
      ok: false,
      code: "outside_hours",
      message: `Check-in is open ${event.checkinOpens}–${event.checkinCloses}.`,
      date,
      day: current.day,
    }
  }
  return { ok: true, date, day: current.day }
}

// Admins can record attendance for today or an earlier event day, never a future one.
export function backfillDay(event, day, now = new Date()) {
  const target = eventDays(event).find((d) => d.day === Number(day))
  if (!target) return { ok: false, message: "Choose a valid event day." }
  const { date } = localParts(event.timezone, now)
  if (target.date > date) return { ok: false, message: "You can't record attendance for a day that hasn't happened yet." }
  return { ok: true, ...target }
}
