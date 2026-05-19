import './globals.css'

export const metadata = {
  title: 'PixelSoft Invoice Portal',
  description: 'Manage invoices, track sent emails, and send automated follow-ups via Resend.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
