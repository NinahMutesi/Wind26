"use client"

import { formatDate } from "@/components/api"
import { localParts } from "@/lib/shared/event-days.mjs"
import Icon from "./Icon"
import { plural } from "./Dialog"

export default function OverviewPanel({ event, attendees, quizzes, go }) {
  const today = localParts(event.timezone).date
  const todayDay = event.days.find((d) => d.date === today)
  const lastDay = event.days[event.days.length - 1]
  const withEmail = attendees.filter((a) => a.email)
  const badgesSent = withEmail.filter((a) => a.tagEmailedAt).length
  const checkedToday = todayDay ? attendees.filter((a) => a.days.includes(todayDay.day)).length : 0
  const responses = quizzes.reduce((s, q) => s + q.responses, 0)
  const eligible = attendees.filter((a) => a.eligibility.eligible)
  const certsSent = attendees.filter((a) => a.certificate?.status === "issued" && a.certificate.emailedAt).length

  const steps = [
    {
      title: "Register attendees",
      detail: attendees.length ? `${plural(attendees.length, "attendee")} registered` : "Add people one by one or import a spreadsheet.",
      done: attendees.length > 0, page: "attendees", action: attendees.length ? "Manage" : "Add attendees",
    },
    {
      title: "Send badges",
      detail: withEmail.length ? `${badgesSent} of ${withEmail.length} emailed · print any time` : "Email digital badges or print them.",
      done: withEmail.length > 0 && badgesSent === withEmail.length, page: "badges", action: "Open badges",
    },
    {
      title: "Check people in",
      detail: event.status === "draft" ? "Open check-in before day 1."
        : todayDay ? `Day ${todayDay.day}: ${checkedToday} of ${attendees.length} checked in` : `Check-in is ${event.status}.`,
      done: event.status === "closed" || event.status === "archived", page: "checkin", action: event.status === "draft" ? "Open check-in" : "Check-in",
    },
    {
      title: "Run the quiz",
      detail: quizzes.length ? `${plural(responses, "response")} across ${plural(quizzes.length, "quiz", "quizzes")}` : "Optional. Attendees answer on their phone from their badge.",
      done: quizzes.some((q) => q.status === "closed"), page: "quiz", action: quizzes.length ? "Open quiz" : "Create quiz",
    },
    {
      title: "Send certificates",
      detail: certsSent ? `${certsSent} sent · ${eligible.length} eligible`
        : `On ${formatDate(lastDay.date)}, after the last check-in. ${event.certificateMinDays} of ${event.days.length} days needed.`,
      done: eligible.length > 0 && certsSent >= eligible.length, page: "certificates", action: "Certificates",
    },
  ]
  const current = steps.findIndex((s) => !s.done)

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{event.code}</p>
          <h1>{event.shortName || event.name}</h1>
          <p>{formatDate(event.startDate)} – {formatDate(event.endDate)}{event.venue ? ` · ${event.venue}` : ""}</p>
        </div>
        <a className="button secondary" href="/scan"><Icon name="scan" />Open scanner</a>
      </div>

      <div className="stats">
        <Stat value={attendees.length} label="Registered" />
        <Stat value={badgesSent} label="Badges emailed" of={withEmail.length} />
        <Stat value={todayDay ? checkedToday : "—"} label={todayDay ? `Checked in · Day ${todayDay.day}` : "Checked in today"} of={todayDay ? attendees.length : 0} />
        <Stat value={responses} label="Quiz responses" />
        <Stat value={certsSent} label="Certificates sent" of={eligible.length} />
      </div>

      <section className="card stack">
        <div className="card-head"><h2>Event flow</h2></div>
        <ol className="flow" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {steps.map((s, i) => (
            <li key={s.title} className={`step ${s.done ? "done" : i === current ? "now" : ""}`}>
              <span className="step-mark">{s.done ? <Icon name="check" size={16} /> : i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.detail}</p>
              </div>
              <button className={i === current ? "" : "secondary"} onClick={() => go(s.page)}>{s.action}</button>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

function Stat({ value, label, of = 0 }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
      {of > 0 && <div className="meter"><i style={{ width: `${Math.min(100, Math.round((Number(value) / of) * 100))}%` }} /></div>}
    </div>
  )
}
