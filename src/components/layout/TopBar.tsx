'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Briefing',
  '/queue': 'Content Queue',
  '/agents': 'Agents',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  return pageTitles[pathname] || 'Briefing'
}

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)
  const title = getPageTitle(pathname)

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/approvals?status=pending&count=true')
        if (res.ok) {
          const data = await res.json()
          setPendingCount(data.count ?? 0)
        }
      } catch {
        // non-critical
      }
    }
    fetchCount()
  }, [pathname])

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border px-6 flex items-center justify-between shrink-0">
      <h2 className="font-heading text-xl text-text-primary lg:ml-0 ml-12">{title}</h2>

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/queue')}
          className="relative p-2 rounded-button hover:bg-surface-bg transition-colors"
          aria-label="View pending items"
        >
          <Bell className="w-5 h-5 text-text-secondary" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
