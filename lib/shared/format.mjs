// Display helpers safe to use on the server and in the browser.

export function formatTime(iso, timeZone = "Africa/Kampala") {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })
}

export function formatDate(date) {
  if (!date) return ""
  return new Date(`${String(date).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  })
}
