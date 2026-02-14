'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  Mail,
  Calendar,
  Shield,
  ShoppingCart,
  Heart,
  Scale,
  Share2,
  Search,
  Newspaper,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityLogEntry, Agent } from '@/types'
import {
  cn,
  formatDate,
  formatTime,
  getTypeBadgeVariant,
} from '@/lib/utils'
import { ACTIVITY_TYPES } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/SkeletonLoader'

const ICON_MAP: Record<string, LucideIcon> = {
  Mail,
  Calendar,
  Shield,
  ShoppingCart,
  Heart,
  Scale,
  Share2,
  Search,
  Newspaper,
}

function getAgentIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Bot
}

const PAGE_SIZE = 15

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)

  // Filters
  const [agentFilter, setAgentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.ok) {
        const json = await res.json()
        setAgents(Array.isArray(json) ? json : json.agents ?? [])
      }
    } catch {
      // silently fail for agent list
    }
  }, [])

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      if (agentFilter !== 'all') params.set('agentId', agentFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)

      const res = await fetch(`/api/activity?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load activity')
      const json = await res.json()
      setEntries(json.entries ?? json.data ?? [])
      setTotalCount(json.total ?? json.count ?? 0)
    } catch {
      setEntries([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, agentFilter, typeFilter, searchQuery, dateFrom, dateTo])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [agentFilter, typeFilter, searchQuery, dateFrom, dateTo])

  const handleExportCSV = () => {
    if (entries.length === 0) return

    const headers = ['Timestamp', 'Agent', 'Action', 'Type', 'Category', 'Detail']
    const rows = entries.map((entry) => [
      new Date(entry.createdAt).toISOString(),
      entry.agent?.name ?? 'Unknown',
      entry.action,
      entry.type,
      entry.category,
      entry.detail.replace(/"/g, '""'),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl text-text-primary">Activity Log</h1>
        <p className="text-sm text-text-secondary mt-1">
          Chronological record of all agent actions and events
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Agent Filter */}
          <div className="flex flex-col gap-1">
            <label className="label text-xs">Agent</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="input text-sm py-1.5 min-w-[160px]"
            >
              <option value="all">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="label text-xs">Type</label>
            <div className="flex items-center gap-1">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter(t.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    typeFilter === t.value
                      ? 'bg-accent-teal text-white'
                      : 'bg-surface-bg text-text-secondary hover:bg-surface-border'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="label text-xs">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input text-sm py-1.5 pl-9 w-full"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-1">
            <label className="label text-xs">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="label text-xs">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>

          {/* Export CSV */}
          <div className="flex flex-col gap-1">
            <label className="label text-xs invisible">Export</label>
            <button
              onClick={handleExportCSV}
              disabled={entries.length === 0}
              className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="space-y-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity found"
          description="There are no activity entries matching your filters. Try adjusting your search criteria."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const AgentIcon = entry.agent ? getAgentIcon(entry.agent.icon) : Bot
            const isExpanded = expandedId === entry.id
            let metadata: Record<string, unknown> = {}
            try {
              metadata = JSON.parse(entry.metadata || '{}')
            } catch {
              // ignore
            }
            const hasMetadata = Object.keys(metadata).length > 0

            return (
              <div key={entry.id}>
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="card p-4 flex items-center gap-4 w-full text-left hover:shadow-card-hover transition-shadow"
                >
                  {/* Timestamp */}
                  <div className="w-32 shrink-0">
                    <p className="text-xs text-text-secondary font-mono">
                      {formatDate(entry.createdAt)}
                    </p>
                    <p className="text-xs text-text-secondary font-mono">
                      {formatTime(entry.createdAt)}
                    </p>
                  </div>

                  {/* Agent */}
                  <div className="flex items-center gap-2 shrink-0 w-32">
                    <div className="w-7 h-7 rounded-full bg-accent-teal-light flex items-center justify-center shrink-0">
                      <AgentIcon className="w-3.5 h-3.5 text-accent-teal" />
                    </div>
                    <span className="text-sm font-medium text-text-primary truncate">
                      {entry.agent?.name ?? 'Unknown'}
                    </span>
                  </div>

                  {/* Action */}
                  <p className="flex-1 text-sm text-text-primary truncate">
                    {entry.action}
                  </p>

                  {/* Type Badge */}
                  <Badge variant={getTypeBadgeVariant(entry.type)} size="sm">
                    {entry.type}
                  </Badge>

                  {/* Category Badge */}
                  <Badge variant="default" size="sm">
                    {entry.category}
                  </Badge>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-text-secondary shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="card mt-1 p-4 ml-36 animate-fade-in border-l-4 border-l-accent-teal">
                    <p className="text-sm text-text-secondary mb-2">{entry.detail}</p>
                    {hasMetadata && (
                      <div className="mt-2 pt-2 border-t border-surface-border">
                        <p className="text-xs text-text-secondary font-medium mb-1">
                          Metadata
                        </p>
                        <pre className="text-xs font-mono text-text-secondary bg-surface-bg rounded p-2 overflow-x-auto">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-text-secondary">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1 disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
