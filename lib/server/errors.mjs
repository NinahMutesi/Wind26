// Errors that are safe to show to the person using the app.
// Anything else is logged and reported as a generic failure.
export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = "AppError"
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export const notFound = (message = "Not found.") => new AppError(404, "not_found", message)
export const badRequest = (message, code = "invalid_input", extra) => new AppError(400, code, message, extra)
export const forbidden = (message = "You don't have access to this.") => new AppError(403, "forbidden", message)
export const unauthorized = (message = "Sign in to continue.") => new AppError(401, "unauthorized", message)
export const conflict = (message, code = "conflict", extra) => new AppError(409, code, message, extra)
export const tooMany = (message = "Too many attempts. Wait a few minutes and try again.") => new AppError(429, "rate_limited", message)
