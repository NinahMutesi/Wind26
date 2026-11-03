import "server-only"
import { env } from "./env.mjs"

// One function for every email. Transports:
//   smtp    - any SMTP provider (supports attachments)
//   http    - POST { email, subject, text, html } to an existing email API, such as
//             the NREP portal endpoint REC uses. Attachments are not sent; links are.
//   console - local development only; prints the message instead of sending it.

let transporter = null

async function smtp() {
  if (!transporter) {
    const nodemailer = (await import("nodemailer")).default
    const { smtp } = env().email
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    })
  }
  return transporter
}

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const { email } = env()
  if (email.transport === "console") {
    console.info(`[email:console] to=${to} subject="${subject}"\n${text}`)
    return { ok: true }
  }
  if (email.transport === "smtp") {
    const t = await smtp()
    await t.sendMail({ from: email.from, to, subject, html, text, attachments })
    return { ok: true }
  }
  const response = await fetch(email.httpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(email.httpToken ? { Authorization: `Bearer ${email.httpToken}` } : {}),
    },
    body: JSON.stringify({ email: to, subject, text, html }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Email API returned ${response.status}`)
  return { ok: true }
}

export const emailSupportsAttachments = () => env().email.transport === "smtp"
