import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FORM — Sports Biomechanics',
  description: 'AI-powered pose estimation and movement analysis for athletes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#050505] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
