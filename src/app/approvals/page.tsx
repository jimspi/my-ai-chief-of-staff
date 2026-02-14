'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  Inbox,
  Bot,
  ChevronDown,
  Mail,
  Calendar,
  Shield,
  ShoppingCart,
  Heart,
  Scale,
  Share2,
  Newspaper,
  AlertTriangle,
  Copy,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ApprovalItem } from '@/types'
import {
  cn,
  formatRelativeTime,
  formatCurrency,
  getUrgencyBorderClass,
  getUrgencyBadgeVariant,
} from '@/lib/utils'
import { APPROVAL_FILTERS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
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

type SortOption = 'urgency' | 'time' | 'amount'

export default function ApprovalsPage() {
  const { addToast } = useToast()
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('urgency')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Batch confirm dialog
  const [batchConfirm, setBatchConfirm] = useState<{
    isOpen: boolean
    action: 'approve' | 'deny'
  }>({ isOpen: false, action: 'approve' })

  // Modify modal
  const [modifyModal, setModifyModal] = useState<{
    isOpen: boolean
    approval: ApprovalItem | null
    detail: string
    amount: string
  }>({ isOpen: false, approval: null, detail: '', amount: '' })

  // AI analysis
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { suggestion: string; reasoning: string }>>({})

  const fetchApprovals = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams({ status: 'pending', sort: sortBy === 'time' ? 'time' : sortBy })
      if (activeFilter === 'high') {
        params.set('urgency', 'high')
      } else if (activeFilter !== 'all') {
        params.set('category', activeFilter)
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim())
      }

      const res = await fetch(`/api/approvals?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch approvals')
      const data: ApprovalItem[] = await res.json()
      setApprovals(data)
      setDismissedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch approvals')
    } finally {
      setLoading(false)
    }
  }, [activeFilter, sortBy, searchQuery])

  useEffect(() => {
    setLoading(true)
    fetchApprovals()
  }, [fetchApprovals])

  const visibleApprovals = useMemo(
    () => approvals.filter((a) => !dismissedIds.has(a.id)),
    [approvals, dismissedIds]
  )

  const handleApprovalAction = async (
    id: string,
    action: 'approve' | 'deny',
    modifiedDetail?: string,
    modifiedAmount?: number
  ) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    try {
      const body: Record<string, unknown> = { action }
      if (modifiedDetail) body.modifiedDetail = modifiedDetail
      if (modifiedAmount !== undefined) body.modifiedAmount = modifiedAmount

      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to process approval')

      // Copy to clipboard on approve
      if (action === 'approve') {
        const approval = approvals.find((a) => a.id === id)
        if (approval?.detail) {
          try {
            await navigator.clipboard.writeText(approval.detail)
          } catch {
            // clipboard may not be available
          }
        }
      }

      // Optimistic dismiss with animation
      setDismissedIds((prev) => new Set(prev).add(id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      addToast(
        action === 'approve' ? 'Post approved & copied to clipboard!' : 'Approval denied',
        action === 'approve' ? 'success' : 'info'
      )

      // Refresh after a brief delay for animation
      setTimeout(() => fetchApprovals(), 300)
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

  const handleBatchAction = async (action: 'approve' | 'deny') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      })
      if (!res.ok) throw new Error('Failed to process batch action')

      setDismissedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.add(id))
        return next
      })
      setSelectedIds(new Set())
      addToast(
        `${ids.length} item${ids.length > 1 ? 's' : ''} ${action === 'approve' ? 'approved' : 'denied'}`,
        'success'
      )
      setTimeout(() => fetchApprovals(), 300)
    } catch {
      addToast('Failed to process batch action', 'error')
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleApprovals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleApprovals.map((a) => a.id)))
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleReasoning = (id: string) => {
    setExpandedReasoningIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleAIAnalyze = async (approvalId: string) => {
    setAnalyzingIds((prev) => new Set(prev).add(approvalId))
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, action: 'suggest' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analysis failed')
      }
      const data = await res.json()
      setAiSuggestions((prev) => ({ ...prev, [approvalId]: data }))
      addToast('AI analysis complete', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'AI analysis failed', 'error')
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev)
        next.delete(approvalId)
        return next
      })
    }
  }

  const openModifyModal = (approval: ApprovalItem) => {
    setModifyModal({
      isOpen: true,
      approval,
      detail: approval.detail,
      amount: approval.amount != null ? String(approval.amount) : '',
    })
  }

  const handleModifyApprove = () => {
    if (!modifyModal.approval) return
    const modifiedAmount = modifyModal.amount ? parseFloat(modifyModal.amount) : undefined
    handleApprovalAction(
      modifyModal.approval.id,
      'approve',
      modifyModal.detail !== modifyModal.approval.detail ? modifyModal.detail : undefined,
      modifiedAmount !== modifyModal.approval?.amount ? modifiedAmount : undefined
    )
    setModifyModal({ isOpen: false, approval: null, detail: '', amount: '' })
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-status-danger mx-auto mb-3" />
          <h2 className="font-heading text-xl mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <button onClick={fetchApprovals} className="btn-primary text-sm">
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
        <h1 className="font-heading text-2xl text-text-primary">Approval Queue</h1>
        <p className="text-sm text-text-secondary mt-1">
          Review and manage pending agent actions
        </p>
      </div>

      {/* Filter Tabs + Sort + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex flex-wrap gap-2 flex-1">
          {APPROVAL_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                setActiveFilter(filter.value)
                setSelectedIds(new Set())
              }}
              className={cn(
                'px-3 py-1.5 rounded-button text-sm font-medium transition-colors',
                activeFilter === filter.value
                  ? 'bg-accent-teal text-white'
                  : 'bg-surface-card text-text-secondary hover:bg-surface-bg border border-surface-border'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input pr-8 text-sm appearance-none cursor-pointer"
            >
              <option value="urgency">By Urgency</option>
              <option value="time">By Time</option>
              <option value="amount">By Amount</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search approvals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 text-sm w-48"
            />
          </div>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="card p-3 flex items-center gap-4 animate-fade-in">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === visibleApprovals.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-surface-border text-accent-teal focus:ring-accent-teal"
            />
            <span className="text-sm font-medium text-text-primary">
              {selectedIds.size} selected
            </span>
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setBatchConfirm({ isOpen: true, action: 'approve' })}
              className="btn-primary text-sm py-1.5"
            >
              Approve All
            </button>
            <button
              onClick={() => setBatchConfirm({ isOpen: true, action: 'deny' })}
              className="btn-danger text-sm py-1.5"
            >
              Deny All
            </button>
          </div>
        </div>
      )}

      {/* Approval Cards */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : visibleApprovals.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No pending approvals"
          description="Your agents are running smoothly. No actions require your review."
        />
      ) : (
        <div className="space-y-3">
          {visibleApprovals.map((approval) => {
            const AgentIcon = approval.agent
              ? getAgentIcon(approval.agent.icon)
              : Bot
            const isDismissed = dismissedIds.has(approval.id)

            return (
              <div
                key={approval.id}
                className={cn(
                  'card p-5 transition-all duration-300',
                  getUrgencyBorderClass(approval.urgency),
                  isDismissed && 'opacity-0 scale-95'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(approval.id)}
                    onChange={() => toggleSelected(approval.id)}
                    className="w-4 h-4 rounded border-surface-border text-accent-teal focus:ring-accent-teal mt-1 shrink-0"
                  />

                  {/* Agent Icon */}
                  <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center shrink-0">
                    <AgentIcon className="w-5 h-5 text-accent-teal" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Agent info row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-text-primary">
                        {approval.agent?.name ?? 'Unknown Agent'}
                      </span>
                      {approval.agent && (
                        <Badge variant="default" size="sm">
                          {approval.agent.category}
                        </Badge>
                      )}
                      <Badge variant={getUrgencyBadgeVariant(approval.urgency)} size="sm">
                        {approval.urgency}
                      </Badge>
                    </div>

                    {/* Action title */}
                    <h3 className="text-lg font-medium text-text-primary">{approval.action}</h3>

                    {/* Detail */}
                    <p className="text-sm text-text-secondary mt-1">{approval.detail}</p>

                    {/* Amount */}
                    {approval.amount != null && (
                      <p className="text-xl font-mono text-accent-teal mt-2">
                        {formatCurrency(approval.amount)}
                      </p>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-text-secondary mt-2">
                      {formatRelativeTime(approval.createdAt)}
                    </p>

                    {/* Agent Reasoning */}
                    {approval.reasoning && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleReasoning(approval.id)}
                          className="text-xs font-medium text-accent-teal hover:text-accent-teal-hover flex items-center gap-1"
                        >
                          <ChevronDown
                            className={cn(
                              'w-3.5 h-3.5 transition-transform',
                              expandedReasoningIds.has(approval.id) && 'rotate-180'
                            )}
                          />
                          Agent reasoning
                        </button>
                        {expandedReasoningIds.has(approval.id) && (
                          <div className="mt-2 p-3 bg-surface-bg rounded-input text-sm text-text-secondary animate-fade-in">
                            {approval.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Suggestion */}
                    {aiSuggestions[approval.id] && (
                      <div className={cn(
                        'mt-3 p-3 rounded-input text-sm animate-fade-in',
                        aiSuggestions[approval.id].suggestion === 'approve' && 'bg-status-success-light text-status-success',
                        aiSuggestions[approval.id].suggestion === 'deny' && 'bg-status-danger-light text-status-danger',
                        aiSuggestions[approval.id].suggestion === 'review' && 'bg-status-warning-light text-status-warning',
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="font-medium capitalize">AI suggests: {aiSuggestions[approval.id].suggestion}</span>
                        </div>
                        <p className="text-text-secondary text-xs">{aiSuggestions[approval.id].reasoning}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <button
                        onClick={() => handleApprovalAction(approval.id, 'approve')}
                        disabled={processingIds.has(approval.id)}
                        className="btn-primary text-sm py-1.5"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalAction(approval.id, 'deny')}
                        disabled={processingIds.has(approval.id)}
                        className="btn-secondary text-sm py-1.5"
                      >
                        Deny
                      </button>
                      <button
                        onClick={() => openModifyModal(approval)}
                        disabled={processingIds.has(approval.id)}
                        className="btn-secondary text-sm py-1.5"
                      >
                        Modify & Approve
                      </button>
                      <button
                        onClick={() => handleAIAnalyze(approval.id)}
                        disabled={analyzingIds.has(approval.id)}
                        className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1"
                      >
                        <Sparkles className={cn('w-3.5 h-3.5', analyzingIds.has(approval.id) && 'animate-spin')} />
                        {analyzingIds.has(approval.id) ? 'Analyzing...' : 'AI Analyze'}
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(approval.detail)
                            addToast('Copied to clipboard', 'success')
                          } catch {
                            addToast('Failed to copy', 'error')
                          }
                        }}
                        className="btn-secondary text-sm py-1.5 inline-flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Batch Confirm Dialog */}
      <ConfirmDialog
        isOpen={batchConfirm.isOpen}
        onClose={() => setBatchConfirm({ ...batchConfirm, isOpen: false })}
        onConfirm={() => handleBatchAction(batchConfirm.action)}
        title={batchConfirm.action === 'approve' ? 'Approve All Selected' : 'Deny All Selected'}
        message={`Are you sure you want to ${batchConfirm.action} ${selectedIds.size} selected approval${selectedIds.size > 1 ? 's' : ''}?`}
        confirmLabel={batchConfirm.action === 'approve' ? 'Approve All' : 'Deny All'}
        variant={batchConfirm.action === 'deny' ? 'danger' : 'primary'}
      />

      {/* Modify & Approve Modal */}
      <Modal
        isOpen={modifyModal.isOpen}
        onClose={() => setModifyModal({ isOpen: false, approval: null, detail: '', amount: '' })}
        title="Modify & Approve"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Detail</label>
            <textarea
              value={modifyModal.detail}
              onChange={(e) =>
                setModifyModal((prev) => ({ ...prev, detail: e.target.value }))
              }
              rows={3}
              className="input"
            />
          </div>
          {modifyModal.approval?.amount != null && (
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                step="0.01"
                value={modifyModal.amount}
                onChange={(e) =>
                  setModifyModal((prev) => ({ ...prev, amount: e.target.value }))
                }
                className="input"
              />
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() =>
                setModifyModal({ isOpen: false, approval: null, detail: '', amount: '' })
              }
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button onClick={handleModifyApprove} className="btn-primary text-sm">
              Approve with Modifications
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
