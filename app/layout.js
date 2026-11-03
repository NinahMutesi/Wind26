import localFont from "next/font/local"
import "./globals.css"

const poppins = localFont({
  src: [
    { path: "../assets/fonts/Poppins-Regular.ttf", weight: "400" },
    { path: "../assets/fonts/Poppins-Medium.ttf", weight: "500" },
    { path: "../assets/fonts/Poppins-SemiBold.ttf", weight: "600" },
    { path: "../assets/fonts/Poppins-Bold.ttf", weight: "700" },
  ],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata = {
  title: "NREP Events",
  description: "Check-in, digital tags and certificates for NREP events.",
  robots: { index: false, follow: false },
}

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b4a4f" }

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  )
}
