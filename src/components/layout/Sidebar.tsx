'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CheckCircle,
  Bot,
  ScrollText,
  ShieldAlert,
  Settings,
  Menu,
  X,
  Zap,
  LogOut,
} from 'lucide-react'

const navItems = [
  { label: 'Command Center', href: '/', icon: LayoutDashboard },
  { label: 'Approvals', href: '/approvals', icon: CheckCircle },
  { label: 'My Agents', href: '/agents', icon: Bot },
  { label: 'Activity Log', href: '/activity', icon: ScrollText },
  { label: 'Risk & Conflicts', href: '/risk', icon: ShieldAlert },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const userName = session?.user?.name || 'User'
  const userEmail = session?.user?.email || ''
  const initials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const handleLinkClick = () => {
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-button bg-surface-card shadow-card border border-surface-border lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5 text-text-primary" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface-card border-r border-surface-border flex flex-col transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 rounded-button text-text-secondary hover:text-text-primary lg:hidden"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-teal rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-lg text-text-primary leading-tight">Chief of Staff</h1>
              <span className="text-xs text-text-secondary">AI Governance</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-accent-teal-light text-accent-teal'
                    : 'text-text-secondary hover:bg-surface-bg hover:text-text-primary'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-teal-light flex items-center justify-center">
              <span className="text-xs font-semibold text-accent-teal">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
              <p className="text-xs text-text-secondary truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded text-text-secondary hover:text-status-danger hover:bg-status-danger-light transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
