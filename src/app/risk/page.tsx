'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
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
  ShieldAlert,
  DollarSign,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RiskData, Conflict, ActivityLogEntry } from '@/types'
import {
  cn,
  formatCurrency,
  formatDate,
  formatTime,
  getTypeBadgeVariant,
} from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { CardSkeleton } from '@/components/ui/SkeletonLoader'
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

function getRiskColor(score: number): string {
  if (score <= 30) return 'text-status-success'
  if (score <= 60) return 'text-status-warning'
  return 'text-status-danger'
}

function getRiskLabel(score: number): string {
  if (score <= 30) return 'Low Risk'
  if (score <= 60) return 'Moderate Risk'
  return 'High Risk'
}

function getRiskBarColor(score: number): string {
  if (score <= 30) return 'bg-status-success'
  if (score <= 60) return 'bg-status-warning'
  return 'bg-status-danger'
}

export default function RiskPage() {
  const { addToast } = useToast()
  const [riskData, setRiskData] = useState<RiskData | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)

  // Resolution modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolving, setResolving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [riskRes, conflictsRes] = await Promise.all([
        fetch('/api/risk'),
        fetch('/api/conflicts'),
      ])

      if (riskRes.ok) {
        const riskJson = await riskRes.json()
        setRiskData(riskJson)
      }

      if (conflictsRes.ok) {
        const conflictsJson = await conflictsRes.json()
        setConflicts(Array.isArray(conflictsJson) ? conflictsJson : conflictsJson.conflicts ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleResolve = async () => {
    if (!activeConflictId || !resolution.trim()) return
    setResolving(true)
    try {
      const res = await fetch('/api/conflicts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeConflictId, resolution: resolution.trim() }),
      })
      if (!res.ok) throw new Error('Failed to resolve conflict')
      addToast('Conflict resolved successfully', 'success')
      setResolveModalOpen(false)
      setResolution('')
      setActiveConflictId(null)
      await fetchData()
    } catch {
      addToast('Failed to resolve conflict', 'error')
    } finally {
      setResolving(false)
    }
  }

  const openResolveModal = (conflictId: string) => {
    setActiveConflictId(conflictId)
    setResolution('')
    setResolveModalOpen(true)
  }

  const categories = riskData?.categories
    ? [
        { name: 'Financial', score: riskData.categories.financial },
        { name: 'Communication', score: riskData.categories.communication },
        { name: 'Legal', score: riskData.categories.legal },
        { name: 'Content', score: riskData.categories.content },
      ]
    : []

  const dailySpending = riskData?.dailySpending ?? []
  const maxDailyAmount = dailySpending.length > 0
    ? Math.max(...dailySpending.map((d) => d.amount))
    : 1

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl text-text-primary">Risk &amp; Conflicts</h1>
          <p className="text-sm text-text-secondary mt-1">
            Monitor risk exposure, agent conflicts, and spending patterns
          </p>
        </div>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl text-text-primary">Risk &amp; Conflicts</h1>
        <p className="text-sm text-text-secondary mt-1">
          Monitor risk exposure, agent conflicts, and spending patterns
        </p>
      </div>

      {/* A) Risk Score Overview */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-surface-bg flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-text-secondary" />
          </div>
          <div>
            <h2 className="font-heading text-lg text-text-primary">Risk Score Overview</h2>
            <p className="text-xs text-text-secondary">Aggregate risk across all agents</p>
          </div>
        </div>

        <div className="flex items-baseline gap-3 mb-4">
          <span className={cn('text-5xl font-heading', getRiskColor(riskData?.overallScore ?? 0))}>
            {riskData?.overallScore ?? 0}
          </span>
          <span className={cn('text-lg font-medium', getRiskColor(riskData?.overallScore ?? 0))}>
            {getRiskLabel(riskData?.overallScore ?? 0)}
          </span>
        </div>

        {/* Visual gauge */}
        <div className="h-3 rounded-full bg-surface-border mb-6">
          <div
            className={cn('h-3 rounded-full transition-all duration-500', getRiskBarColor(riskData?.overallScore ?? 0))}
            style={{ width: `${riskData?.overallScore ?? 0}%` }}
          />
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.name} className="bg-surface-bg rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">{cat.name}</p>
              <p className={cn('text-xl font-heading mb-2', getRiskColor(cat.score))}>
                {cat.score}
              </p>
              <div className="h-1.5 rounded-full bg-surface-border">
                <div
                  className={cn('h-1.5 rounded-full transition-all duration-500', getRiskBarColor(cat.score))}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* B) Active Conflicts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-heading text-lg text-text-primary">Active Conflicts</h2>
          {conflicts.filter((c) => c.status === 'active').length > 0 && (
            <Badge variant="warning" size="sm">
              {conflicts.filter((c) => c.status === 'active').length}
            </Badge>
          )}
        </div>

        {conflicts.filter((c) => c.status === 'active').length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-text-secondary">No active conflicts detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts
              .filter((c) => c.status === 'active')
              .map((conflict) => (
                <div
                  key={conflict.id}
                  className="card p-5 border-l-4 border-l-status-warning"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary mb-2">{conflict.description}</p>
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="text-xs text-text-secondary">Agents involved:</span>
                        {conflict.agents?.map((ca) => (
                          <Badge key={ca.id} variant="teal" size="sm">
                            {ca.agent?.name ?? 'Unknown Agent'}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="status-dot bg-status-warning" />
                          <span className="text-xs text-text-secondary capitalize">{conflict.status}</span>
                        </div>
                        <button
                          onClick={() => openResolveModal(conflict.id)}
                          className="btn-primary text-xs py-1 px-3"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* C) Spending Exposure */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-accent-teal" />
          </div>
          <div>
            <h2 className="font-heading text-lg text-text-primary">Spending Exposure</h2>
            <p className="text-xs text-text-secondary">Financial activity across agents</p>
          </div>
        </div>

        {/* Total spending */}
        <div className="mb-6">
          <p className="text-xs text-text-secondary mb-1">Total Spending This Month</p>
          <p className="text-3xl font-heading font-mono text-text-primary">
            {formatCurrency(riskData?.totalSpending ?? 0)}
          </p>
        </div>

        {/* Bar chart - last 7 days */}
        {dailySpending.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-text-primary mb-3">Last 7 Days</p>
            <div className="flex items-end gap-2 h-40">
              {dailySpending.map((day) => {
                const heightPercent = maxDailyAmount > 0
                  ? Math.max(4, (day.amount / maxDailyAmount) * 100)
                  : 4
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-mono text-text-secondary">
                      {formatCurrency(day.amount)}
                    </span>
                    <div
                      className="w-full bg-accent-teal rounded-t transition-all duration-300 min-h-[4px]"
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-xs text-text-secondary">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top spending agents */}
        {(riskData?.topSpenders ?? []).length > 0 && (
          <div>
            <p className="text-sm font-medium text-text-primary mb-3">Top Spending Agents</p>
            <div className="space-y-3">
              {(() => {
                const topSpenders = riskData?.topSpenders ?? []
                const maxAmount = topSpenders.length > 0
                  ? Math.max(...topSpenders.map((s) => s.amount))
                  : 1
                return topSpenders.map((spender) => (
                  <div key={spender.agentName} className="flex items-center gap-3">
                    <span className="text-sm text-text-primary w-28 shrink-0 truncate">
                      {spender.agentName}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-surface-border">
                      <div
                        className="h-2 rounded-full bg-accent-teal transition-all duration-300"
                        style={{
                          width: `${maxAmount > 0 ? (spender.amount / maxAmount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-text-secondary w-20 text-right shrink-0">
                      {formatCurrency(spender.amount)}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </section>

      {/* D) Alert History */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-text-secondary" />
          <h2 className="font-heading text-lg text-text-primary">Alert History</h2>
        </div>

        {(riskData?.alerts ?? []).length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-text-secondary">No recent alerts</p>
          </div>
        ) : (
          <div className="card divide-y divide-surface-border">
            {(riskData?.alerts ?? []).slice(0, 10).map((alert: ActivityLogEntry) => {
              const AgentIcon = alert.agent ? getAgentIcon(alert.agent.icon) : Bot
              return (
                <div key={alert.id} className="p-4 flex items-center gap-4">
                  <div className="w-28 shrink-0">
                    <p className="text-xs text-text-secondary font-mono">
                      {formatDate(alert.createdAt)}
                    </p>
                    <p className="text-xs text-text-secondary font-mono">
                      {formatTime(alert.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-accent-teal-light flex items-center justify-center">
                      <AgentIcon className="w-3 h-3 text-accent-teal" />
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {alert.agent?.name ?? 'Unknown'}
                    </span>
                  </div>
                  <p className="flex-1 text-sm text-text-secondary truncate">
                    {alert.detail || alert.action}
                  </p>
                  <Badge variant={getTypeBadgeVariant(alert.type)} size="sm">
                    {alert.type}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Resolve Conflict Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => {
          setResolveModalOpen(false)
          setResolution('')
          setActiveConflictId(null)
        }}
        title="Resolve Conflict"
      >
        <div className="space-y-4">
          <div>
            <label className="label text-sm mb-1.5 block">Resolution</label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe how this conflict should be resolved..."
              className="input w-full text-sm min-h-[120px] resize-y"
              rows={4}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setResolveModalOpen(false)
                setResolution('')
                setActiveConflictId(null)
              }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={!resolution.trim() || resolving}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {resolving ? 'Resolving...' : 'Resolve Conflict'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
