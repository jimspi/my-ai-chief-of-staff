import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { ToastProvider } from '@/contexts/ToastContext'
import SessionProvider from '@/components/providers/SessionProvider'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'My AI Chief of Staff',
    template: '%s | AI Chief of Staff',
  },
  description:
    'Personal AI governance dashboard — monitor, control, and manage all your AI agents from one place.',
  keywords: ['AI agents', 'governance', 'dashboard', 'approval workflow', 'risk management'],
  authors: [{ name: 'AI Chief of Staff' }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSerifDisplay.variable} ${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased bg-surface-bg`}
      >
        <SessionProvider>
          <ToastProvider>
            <div className="flex h-screen">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-y-auto bg-surface-bg">
                  <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                  </div>
                </main>
              </div>
            </div>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
