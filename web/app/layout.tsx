import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Floviate',
  description: 'Guided meditations for the feelings you want to bring into your day. Find your moment, make it yours, and begin.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
