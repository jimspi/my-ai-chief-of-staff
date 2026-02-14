'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bot,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Mail,
  Calendar,
  Shield,
  ShoppingCart,
  Heart,
  Scale,
  Share2,
  Search,
  Newspaper,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardData, ApprovalItem, Agent, ActivityLogEntry } from '@/types'
import {
  cn,
  formatRelativeTime,
  formatCurrency,
  getUrgencyBorderClass,
  getUrgencyBadgeVariant,
  getStatusDotColor,
  getTypeBadgeVariant,
  truncate,
} from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { StatSkeleton, CardSkeleton } from '@/components/ui/SkeletonLoader'
import WelcomeModal from '@/components/ui/WelcomeModal'
import { useToast } from '@/contexts/ToastContext'

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

export default function CommandCenter() {
  const router = useRouter()
  const { addToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [scanning, setScanning] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const autoScanTriggered = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json: DashboardData = await res.json()
      setData(json)
      return json
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData().then((dashData) => {
      if (!dashData || autoScanTriggered.current) return

      // Check if onboarding is needed
      if (dashData.agents?.length === 0) {
        setShowWelcome(true)
      }

      // Auto-scan: check if any agent with externalUrl needs scanning
      const agent = dashData.agents?.find((a: Agent) => a.externalUrl && a.status === 'active')
      if (agent && agent.lastScannedAt) {
        const lastScan = new Date(agent.lastScannedAt).getTime()
        const intervalMs = (agent.scanInterval || 30) * 60 * 1000
        if (Date.now() - lastScan > intervalMs) {
          autoScanTriggered.current = true
          triggerScan(agent.id, true)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerScan = async (agentId: string, background = false) => {
    setScanning(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, { method: 'POST' })
      if (!res.ok) throw new Error('Scan failed')
      const result = await res.json()
      if (result.success) {
        addToast(
          `Scan complete! ${result.postsCreated} post${result.postsCreated === 1 ? '' : 's'} generated.`,
          'success'
        )
      } else if (!background) {
        addToast(result.message || 'Scan completed with no results', 'info')
      }
      await fetchData()
    } catch {
      if (!background) addToast('Failed to trigger scan', 'error')
    } finally {
      setScanning(false)
    }
  }

  const handleApprovalAction = async (id: string, action: 'approve' | 'deny') => {
    setProcessingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed to process approval')

      // Copy to clipboard on approve
      if (action === 'approve') {
        const approval = data?.approvals?.find((a) => a.id === id)
        if (approval?.detail) {
          try {
            await navigator.clipboard.writeText(approval.detail)
          } catch {
            // clipboard may not be available
          }
        }
      }

      addToast(
        action === 'approve' ? 'Post approved & copied to clipboard!' : 'Approval denied',
        action === 'approve' ? 'success' : 'info'
      )
      await fetchData()
    } catch {
      addToast('Failed to process approval', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  // Find the news agent (first agent with externalUrl)
  const newsAgent = data?.agents?.find((a: Agent) => a.externalUrl)

  if (error) {
    return (
      <div className="animate-fade-in">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-status-danger mx-auto mb-3" />
          <h2 className="font-heading text-xl mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <button onClick={fetchData} className="btn-primary text-sm">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl text-text-primary">Command Center</h1>
        <p className="text-sm text-text-secondary mt-1">
          Overview of your AI agents and pending actions
        </p>
      </div>

      {/* A) Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
                  <Bot className="w-5 h-5 text-accent-teal" />
                </div>
              </div>
              <p className="text-sm text-text-secondary">Active Agents</p>
              <p className="text-2xl font-heading text-text-primary">{data?.stats.activeAgents ?? 0}</p>
              <p className="text-xs text-text-secondary mt-1">agents running</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    (data?.stats.pendingApprovals ?? 0) > 5
                      ? 'bg-status-danger-light'
                      : 'bg-status-warning-light'
                  )}
                >
                  <Clock
                    className={cn(
                      'w-5 h-5',
                      (data?.stats.pendingApprovals ?? 0) > 5
                        ? 'text-status-danger'
                        : 'text-status-warning'
                    )}
                  />
                </div>
              </div>
              <p className="text-sm text-text-secondary">Pending Approvals</p>
              <p className="text-2xl font-heading text-text-primary">{data?.stats.pendingApprovals ?? 0}</p>
              <p className="text-xs text-text-secondary mt-1">awaiting review</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
                  <Activity className="w-5 h-5 text-accent-teal" />
                </div>
              </div>
              <p className="text-sm text-text-secondary">Actions Today</p>
              <p className="text-2xl font-heading text-text-primary">{data?.stats.actionsToday ?? 0}</p>
              <p className="text-xs text-text-secondary mt-1">completed today</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    (data?.stats.riskAlerts ?? 0) > 0
                      ? 'bg-status-danger-light'
                      : 'bg-surface-bg'
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      'w-5 h-5',
                      (data?.stats.riskAlerts ?? 0) > 0
                        ? 'text-status-danger'
                        : 'text-text-secondary'
                    )}
                  />
                </div>
              </div>
              <p className="text-sm text-text-secondary">Risk Alerts</p>
              <p className="text-2xl font-heading text-text-primary">{data?.stats.riskAlerts ?? 0}</p>
              <p className="text-xs text-text-secondary mt-1">active alerts</p>
            </div>
          </>
        )}
      </div>

      {/* B) Conflict / Risk Banner */}
      {!loading && data?.conflicts && data.conflicts.length > 0 && (
        <div className="card border-l-4 border-l-status-warning bg-status-warning-light/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-heading text-base text-text-primary mb-1">
                Active Conflicts Detected
              </h3>
              <ul className="space-y-1 mb-2">
                {data.conflicts.map((conflict) => (
                  <li key={conflict.id} className="text-sm text-text-secondary">
                    {conflict.description}
                  </li>
                ))}
              </ul>
              <Link
                href="/risk"
                className="text-sm font-medium text-accent-teal hover:text-accent-teal-hover inline-flex items-center gap-1"
              >
                View Risk Dashboard <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* C) Two-column layout */}
      {loading ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div>
            <CardSkeleton />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Approval Queue Preview */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-lg text-text-primary">Pending Approvals</h2>
                  {(data?.stats.pendingApprovals ?? 0) > 0 && (
                    <Badge variant="warning" size="sm">
                      {data?.stats.pendingApprovals}
                    </Badge>
                  )}
                </div>
                <Link
                  href="/approvals"
                  className="text-sm text-accent-teal hover:text-accent-teal-hover font-medium inline-flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {data?.approvals && data.approvals.length > 0 ? (
                <div className="space-y-3">
                  {data.approvals.map((approval: ApprovalItem) => {
                    const AgentIcon = approval.agent
                      ? getAgentIcon(approval.agent.icon)
                      : Bot
                    return (
                      <div
                        key={approval.id}
                        className={cn('card-hover p-4', getUrgencyBorderClass(approval.urgency))}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-accent-teal-light flex items-center justify-center shrink-0">
                              <AgentIcon className="w-4 h-4 text-accent-teal" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-text-secondary">
                                  {approval.agent?.name ?? 'Unknown Agent'}
                                </span>
                                <Badge variant={getUrgencyBadgeVariant(approval.urgency)} size="sm">
                                  {approval.urgency}
                                </Badge>
                              </div>
                              <p className="font-medium text-text-primary mt-0.5">
                                {approval.action}
                              </p>
                              <p className="text-sm text-text-secondary mt-0.5 truncate">
                                {truncate(approval.detail, 80)}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5">
                                {approval.amount != null && (
                                  <span className="font-mono text-accent-teal text-sm">
                                    {formatCurrency(approval.amount)}
                                  </span>
                                )}
                                <span className="text-xs text-text-secondary">
                                  {formatRelativeTime(approval.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleApprovalAction(approval.id, 'approve')}
                              disabled={processingIds.has(approval.id)}
                              className="btn-primary text-xs py-1 px-2.5"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprovalAction(approval.id, 'deny')}
                              disabled={processingIds.has(approval.id)}
                              className="btn-secondary text-xs py-1 px-2.5"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="All clear!"
                  description="No pending approvals at the moment. Your agents are running smoothly."
                />
              )}
            </section>

            {/* Recent Activity */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg text-text-primary">Recent Activity</h2>
                <Link
                  href="/activity"
                  className="text-sm text-accent-teal hover:text-accent-teal-hover font-medium inline-flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="card p-4">
                {data?.recentActivity && data.recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {data.recentActivity.map((entry: ActivityLogEntry) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1.5">
                          <div
                            className={cn(
                              'status-dot shrink-0',
                              entry.type === 'auto'
                                ? 'bg-accent-teal'
                                : entry.type === 'approved'
                                ? 'bg-status-success'
                                : entry.type === 'denied'
                                ? 'bg-status-danger'
                                : 'bg-status-warning'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-text-primary">
                              {entry.agent?.name ?? 'Unknown'}
                            </span>
                            <Badge variant={getTypeBadgeVariant(entry.type)} size="sm">
                              {entry.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-text-secondary mt-0.5 truncate">
                            {entry.action}
                          </p>
                        </div>
                        <span className="text-xs text-text-secondary shrink-0 pt-1">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary text-center py-6">
                    No recent activity
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Right Column — News Agent Hero Card */}
          <div className="lg:col-span-1">
            {newsAgent ? (
              <section className="card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent-teal-light flex items-center justify-center">
                    <Newspaper className="w-6 h-6 text-accent-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-heading text-lg text-text-primary">{newsAgent.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('status-dot', getStatusDotColor(newsAgent.status))} />
                      <span className="text-xs text-text-secondary capitalize">{newsAgent.status}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-text-secondary">
                  {newsAgent.description}
                </p>

                {/* External URL */}
                {newsAgent.externalUrl && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface-bg rounded-lg p-2.5">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{newsAgent.externalUrl}</span>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-bg rounded-lg p-3 text-center">
                    <p className="text-xl font-heading text-text-primary">
                      {newsAgent._count?.approvals ?? 0}
                    </p>
                    <p className="text-xs text-text-secondary">Pending</p>
                  </div>
                  <div className="bg-surface-bg rounded-lg p-3 text-center">
                    <p className="text-xl font-heading text-text-primary">
                      {newsAgent._count?.activities ?? 0}
                    </p>
                    <p className="text-xs text-text-secondary">Total Actions</p>
                  </div>
                </div>

                {/* Last Scanned */}
                {newsAgent.lastScannedAt && (
                  <p className="text-xs text-text-secondary">
                    Last scanned: {formatRelativeTime(newsAgent.lastScannedAt)}
                  </p>
                )}

                {/* Scan Button */}
                <button
                  onClick={() => triggerScan(newsAgent.id)}
                  disabled={scanning}
                  className="btn-primary w-full text-sm py-2.5 inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className={cn('w-4 h-4', scanning && 'animate-spin')} />
                  {scanning ? 'Scanning News...' : 'Scan News'}
                </button>

                {/* Configure Link */}
                <Link
                  href={`/agents/${newsAgent.id}`}
                  className="text-sm font-medium text-accent-teal hover:text-accent-teal-hover inline-flex items-center gap-1"
                >
                  Configure Agent <ChevronRight className="w-4 h-4" />
                </Link>
              </section>
            ) : (
              <section>
                <h2 className="font-heading text-lg text-text-primary mb-4">Agent Status</h2>
                <div className="space-y-2">
                  {data?.agents?.map((agent: Agent) => {
                    const AgentIcon = getAgentIcon(agent.icon)
                    return (
                      <button
                        key={agent.id}
                        onClick={() => router.push(`/agents/${agent.id}`)}
                        className="card-hover p-3 flex items-center gap-3 w-full text-left"
                      >
                        <div className={cn('status-dot shrink-0', getStatusDotColor(agent.status))} />
                        <div className="w-7 h-7 rounded-full bg-accent-teal-light flex items-center justify-center shrink-0">
                          <AgentIcon className="w-3.5 h-3.5 text-accent-teal" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {agent.name}
                          </p>
                          <Badge variant="default" size="sm">
                            {agent.category}
                          </Badge>
                        </div>
                        {(agent._count?.approvals ?? 0) > 0 && (
                          <Badge variant="warning" size="sm">
                            {agent._count?.approvals}
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-text-secondary shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      <WelcomeModal
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
        onCreateAgent={() => router.push('/agents')}
      />
    </div>
  )
}
