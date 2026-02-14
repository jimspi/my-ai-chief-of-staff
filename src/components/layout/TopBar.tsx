'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Search, Bell, Plus } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/approvals': 'Approval Queue',
  '/agents': 'My Agents',
  '/activity': 'Activity Log',
  '/risk': 'Risk & Conflicts',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/agents/')) return 'Agent Details'
  return 'Dashboard'
}

export default function TopBar() {
  const pathname = usePathname()
  const [notificationCount, setNotificationCount] = useState(0)
  const title = getPageTitle(pathname)

  useEffect(() => {
    async function fetchPendingCount() {
      try {
        const res = await fetch('/api/approvals?status=pending&count=true')
        if (res.ok) {
          const data = await res.json()
          setNotificationCount(data.count ?? 0)
        }
      } catch {
        // silently fail - notification count is non-critical
      }
    }

    fetchPendingCount()
  }, [pathname])

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border px-6 flex items-center justify-between shrink-0">
      {/* Left: Page title */}
      <h2 className="font-heading text-xl text-text-primary lg:ml-0 ml-12">{title}</h2>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center bg-surface-bg rounded-input px-3 py-1.5">
          <Search className="w-4 h-4 text-text-secondary mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-secondary/50 w-48"
          />
        </div>

        {/* Notifications bell */}
        <button
          className="relative p-2 rounded-button hover:bg-surface-bg transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-text-secondary" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Quick Add */}
        <button className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Quick Add</span>
        </button>
      </div>
    </header>
  )
}
