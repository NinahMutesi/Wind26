const production = process.env.NODE_ENV === "production"

// Next.js needs inline scripts for hydration; everything else is limited to this site.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js", "@pdf-lib/fontkit", "pdf-lib", "qrcode", "sharp", "nodemailer"],
  // Rendering reads fonts and event designs from disk at runtime.
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*", "./events/**/*"],
    "/t/**/*": ["./assets/fonts/**/*", "./events/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ]
  },
}

export default nextConfig
