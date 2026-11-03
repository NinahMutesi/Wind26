// Email bodies. Every value is escaped; nothing from attendees reaches HTML raw.

export const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;")

function frame(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f2f6f6;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#0f5e63;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">${escapeHtml(title)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`
}

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#f0941c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;display:inline-block">${escapeHtml(label)}</a></p>`

const when = (event) => `${event.startDate} to ${event.endDate}${event.venue ? ` at ${event.venue}` : ""}`

export function signInCodeEmail({ name, code }) {
  const text = `Hello ${name},\n\nYour sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't ask for this code, you can ignore this email.`
  const html = frame("Your sign-in code", `<p>Hello ${escapeHtml(name)},</p>
<p>Your sign-in code is:</p><p style="font-size:30px;letter-spacing:6px;font-weight:bold;margin:8px 0 16px">${escapeHtml(code)}</p>
<p>It expires in 10 minutes. If you didn't ask for this code, you can ignore this email.</p>`)
  return { subject: `Sign-in code: ${code}`, text, html }
}

export function tagEmail({ event, attendee, link, attached }) {
  const text = `Dear ${attendee.fullName},\n\nYour digital tag for ${event.name} (${when(event)}) is ready:\n${link}\n\nShow the QR code on your tag at the registration desk each morning.${attached ? " The tag is also attached to this email." : ""}\n\nPlease don't share this link. It identifies you at check-in.`
  const html = frame(event.shortName || event.name, `<p>Dear ${escapeHtml(attendee.fullName)},</p>
<p>Your digital tag for <strong>${escapeHtml(event.name)}</strong> (${escapeHtml(when(event))}) is ready.</p>
${button(link, "Open my tag")}
<p>Show the QR code on your tag at the registration desk each morning.${attached ? " The tag is also attached to this email." : ""}</p>
<p style="color:#5b6770;font-size:13px">Please don't share this link. It identifies you at check-in.</p>`)
  return { subject: `Your tag for ${event.shortName || event.name}`, text, html }
}

export function certificateEmail({ event, certificate, link, attached }) {
  const text = `Dear ${certificate.nameOnCertificate},\n\nCongratulations on completing ${event.name}. Your certificate is available here:\n${link}${attached ? "\n\nThe certificate is also attached as a PDF." : ""}\n\nAnyone you share the link with can confirm the certificate is genuine.`
  const html = frame("Certificate of completion", `<p>Dear ${escapeHtml(certificate.nameOnCertificate)},</p>
<p>Congratulations on completing <strong>${escapeHtml(event.name)}</strong>.</p>
${button(link, "View and download certificate")}
${attached ? "<p>The certificate is also attached as a PDF.</p>" : ""}
<p style="color:#5b6770;font-size:13px">Anyone you share the link with can confirm the certificate is genuine.</p>`)
  return { subject: `Your certificate: ${event.shortName || event.name}`, text, html }
}
