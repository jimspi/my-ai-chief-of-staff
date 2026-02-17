'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Bot,
  FileText,
  Activity,
  Sparkles,
  RefreshCw,
  Check,
  X,
  ChevronRight,
  Newspaper,
  Mail,
  Search,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn, formatRelativeTime, getUrgencyBadgeVariant, getTypeBadgeVariant, getStatusDotColor } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Badge from '@/components/ui/Badge'
import { StatSkeleton, CardSkeleton } from '@/components/ui/SkeletonLoader'
import type { BriefingData, ContentItem, ActivityLogEntry, Agent } from '@/types'

const ICON_MAP: Record<string, LucideIcon> = { Newspaper, Mail, Search }
function getAgentIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Bot
}

export default function BriefingPage() {
  const { data: session } = useSession()
  const { addToast } = useToast()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [scanningId, setScanningId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-sync all connected agents on page load, then refresh data
  useEffect(() => {
    let cancelled = false
    async function syncAndLoad() {
      await fetchData()
      try {
        const res = await fetch('/api/agents/sync', { method: 'POST' })
        if (res.ok && !cancelled) {
          const result = await res.json()
          if (result.totalCreated > 0) {
            fetchData()
            addToast(`${result.totalCreated} new item${result.totalCreated === 1 ? '' : 's'} from your agents`, 'success')
          }
        }
      } catch { /* sync failed silently */ }
    }
    syncAndLoad()
    return () => { cancelled = true }
  }, [fetchData, addToast])

  async function handleAction(id: string, action: 'approve' | 'deny') {
    setProcessingIds(prev => new Set(prev).add(id))
    try {
      const item = data?.content.find(c => c.id === id)
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        if (action === 'approve' && item) {
          await navigator.clipboard.writeText(item.detail)
          addToast('Approved and copied to clipboard', 'success')
        } else {
          addToast('Dismissed', 'info')
        }
        fetchData()
      }
    } catch {
      addToast('Action failed', 'error')
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleScan(agentId: string) {
    setScanningId(agentId)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, { method: 'POST' })
      if (res.ok) {
        const result = await res.json()
        addToast(`Scan complete — ${result.postsCreated} new item${result.postsCreated === 1 ? '' : 's'}`, 'success')
        fetchData()
      }
    } catch {
      addToast('Scan failed', 'error')
    } finally {
      setScanningId(null)
    }
  }

  async function generateBriefing() {
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: session?.user?.name }),
      })
      if (res.ok) {
        const result = await res.json()
        setBriefing(result.briefing)
      } else {
        const err = await res.json()
        addToast(err.error || 'Failed to generate briefing', 'error')
      }
    } catch {
      addToast('Failed to generate briefing', 'error')
    } finally {
      setBriefingLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatSkeleton /><StatSkeleton /><StatSkeleton />
        </div>
        <CardSkeleton /><CardSkeleton />
      </div>
    )
  }

  if (!data) return <div className="p-6 text-text-secondary">Failed to load data.</div>

  const connectedAgents = data.agents.filter((a: Agent) => a.externalUrl)

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active Agents', value: data.stats.activeAgents, icon: Bot, color: 'text-accent-teal' },
          { label: 'Content Ready', value: data.stats.contentReady, icon: FileText, color: data.stats.contentReady > 0 ? 'text-status-warning' : 'text-accent-teal' },
          { label: 'Activity Today', value: data.stats.activityToday, icon: Activity, color: 'text-accent-teal' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card p-4 flex items-center gap-4">
              <div className={cn('p-2.5 rounded-lg bg-surface-bg', stat.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-heading text-text-primary">{stat.value}</p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Briefing */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-teal" />
            <h3 className="font-heading text-lg text-text-primary">AI Briefing</h3>
          </div>
          <button
            onClick={generateBriefing}
            disabled={briefingLoading}
            className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
          >
            {briefingLoading ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Generate Briefing</>
            )}
          </button>
        </div>
        {briefing ? (
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">{briefing}</p>
        ) : (
          <p className="text-sm text-text-secondary">Click &ldquo;Generate Briefing&rdquo; for an AI-powered summary of your agents&apos; activity and items needing attention.</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content ready + Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Ready */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-text-primary">Content Ready for Review</h3>
              {data.content.length > 0 && (
                <Link href="/queue" className="text-sm text-accent-teal hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            {data.content.length === 0 ? (
              <p className="text-sm text-text-secondary py-4 text-center">All clear — no content awaiting review.</p>
            ) : (
              <div className="space-y-3">
                {data.content.slice(0, 4).map((item: ContentItem) => {
                  const Icon = getAgentIcon(item.agent?.icon || '')
                  const processing = processingIds.has(item.id)
                  return (
                    <div key={item.id} className={cn(
                      'p-3 rounded-lg border transition-colors',
                      item.urgency === 'high' ? 'border-l-4 border-l-status-danger border-surface-border' : 'border-surface-border'
                    )}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-bg flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-accent-teal" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-text-secondary">{item.agent?.name}</span>
                            <Badge variant={getUrgencyBadgeVariant(item.urgency)} size="sm">{item.urgency}</Badge>
                            <span className="text-xs text-text-secondary ml-auto">{formatRelativeTime(item.createdAt)}</span>
                          </div>
                          <p className="text-sm font-medium text-text-primary">{item.action}</p>
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.detail}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAction(item.id, 'approve')}
                            disabled={processing}
                            className="p-1.5 rounded-button bg-status-success/10 text-status-success hover:bg-status-success/20 transition-colors"
                            title="Approve & Copy"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAction(item.id, 'deny')}
                            disabled={processing}
                            className="p-1.5 rounded-button bg-status-danger/10 text-status-danger hover:bg-status-danger/20 transition-colors"
                            title="Dismiss"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card p-5">
            <h3 className="font-heading text-lg text-text-primary mb-4">Recent Activity</h3>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-text-secondary py-4 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((entry: ActivityLogEntry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', getStatusDotColor(
                      entry.type === 'alert' ? 'error' : entry.type === 'approved' ? 'active' : 'paused'
                    ))} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{entry.agent?.name}</span>
                        <Badge variant={getTypeBadgeVariant(entry.type)} size="sm">{entry.type}</Badge>
                      </div>
                      <p className="text-sm text-text-secondary">{entry.action}</p>
                    </div>
                    <span className="text-xs text-text-secondary whitespace-nowrap">{formatRelativeTime(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: News Agent / Agent list */}
        <div className="space-y-6">
          {connectedAgents.map((agent: Agent) => {
            const Icon = getAgentIcon(agent.icon)
            const isScanning = scanningId === agent.id
            return (
              <div key={agent.id} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-teal-light flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent-teal" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base text-text-primary">{agent.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('status-dot', getStatusDotColor(agent.status))} />
                      <span className="text-xs text-text-secondary capitalize">{agent.status}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-text-secondary mb-3">{agent.description}</p>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate">{agent.externalUrl}</span>
                </div>
                {agent.lastScannedAt && (
                  <p className="text-xs text-text-secondary mb-4">Last scanned {formatRelativeTime(agent.lastScannedAt)}</p>
                )}
                <button
                  onClick={() => handleScan(agent.id)}
                  disabled={scanningId !== null}
                  className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className={cn('w-4 h-4', isScanning && 'animate-spin')} />
                  {isScanning ? 'Scanning...' : `Scan ${agent.name}`}
                </button>
              </div>
            )
          })}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-base text-text-primary">Your Agents</h3>
              <Link href="/agents" className="text-sm text-accent-teal hover:underline">Manage</Link>
            </div>
            <div className="space-y-3">
              {data.agents.map((agent: Agent) => {
                const Icon = getAgentIcon(agent.icon)
                return (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-bg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-accent-teal" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                      <p className="text-xs text-text-secondary">{agent.category}</p>
                    </div>
                    <span className={cn('status-dot', getStatusDotColor(agent.status))} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
