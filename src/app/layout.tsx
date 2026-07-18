import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CloudPhone Panel',
  description: 'Real-time Android cloud phone management panel'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
