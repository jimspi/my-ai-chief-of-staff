'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  Newspaper,
  Mail,
  Search,
  Check,
  Copy,
  ChevronDown,
  FileText,
  Target,
  MessageSquare,
  BookOpen,
  AlignLeft,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn, formatRelativeTime, getUrgencyBadgeVariant } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import type { ContentItem } from '@/types'

const ICON_MAP: Record<string, LucideIcon> = { Newspaper, Mail, Search }
function getAgentIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Bot
}

const EXECUTION_ACTIONS = [
  { type: 'draft_response', label: 'Draft Response', icon: MessageSquare, description: 'AI drafts a reply' },
  { type: 'research', label: 'Deep Dive', icon: BookOpen, description: 'Research deeper' },
  { type: 'summarize', label: 'Summarize', icon: AlignLeft, description: 'Executive summary' },
  { type: 'rewrite', label: 'Rewrite', icon: Pencil, description: 'Polish content' },
] as const

function getSuggestedActionBadge(action: string | null) {
  switch (action) {
    case 'approve': return { variant: 'success' as const, label: 'AI: Approve' }
    case 'escalate': return { variant: 'danger' as const, label: 'AI: Escalate' }
    case 'dismiss': return { variant: 'default' as const, label: 'AI: Dismiss' }
    case 'review': return { variant: 'warning' as const, label: 'AI: Review' }
    default: return null
  }
}

export default function ContentQueuePage() {
  const { addToast } = useToast()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [executingId, setExecutingId] = useState<string | null>(null)

  // Edit modal
  const [editItem, setEditItem] = useState<ContentItem | null>(null)
  const [editDetail, setEditDetail] = useState('')

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals?status=pending')
      if (res.ok) setItems(await res.json())
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function handleAction(id: string, action: 'approve' | 'deny', modifiedDetail?: string) {
    setProcessingIds(prev => new Set(prev).add(id))
    try {
      const item = items.find(i => i.id === id)
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, modifiedDetail }),
      })
      if (res.ok) {
        if (action === 'approve' && item) {
          await navigator.clipboard.writeText(modifiedDetail || item.detail)
          addToast('Approved and copied to clipboard', 'success')
        } else {
          addToast('Dismissed', 'info')
        }
        setEditItem(null)
        fetchItems()
      }
    } catch {
      addToast('Action failed', 'error')
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleExecute(itemId: string, executionType: string) {
    setExecutingId(itemId)
    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, executionType }),
      })
      if (res.ok) {
        const result = await res.json()
        addToast(`${result.type} completed — check queue for result`, 'success')
        fetchItems()
      } else {
        const err = await res.json()
        addToast(err.error || 'Execution failed', 'error')
      }
    } catch {
      addToast('Execution failed', 'error')
    } finally {
      setExecutingId(null)
    }
  }

  async function handleCopy(detail: string) {
    await navigator.clipboard.writeText(detail)
    addToast('Copied to clipboard', 'success')
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-surface-bg rounded w-1/3 mb-3" />
            <div className="h-3 bg-surface-bg rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileText}
          title="Content queue is empty"
          description="Your agents haven&apos;t generated any content yet. Scan your news agent or wait for agents to produce content."
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="teal">{items.length} pending</Badge>
        {items.filter(i => i.suggestedAction === 'escalate').length > 0 && (
          <Badge variant="danger">{items.filter(i => i.suggestedAction === 'escalate').length} escalated</Badge>
        )}
        {items.filter(i => i.suggestedAction === 'approve').length > 0 && (
          <Badge variant="success">{items.filter(i => i.suggestedAction === 'approve').length} ready to approve</Badge>
        )}
      </div>

      {items.map(item => {
        const Icon = getAgentIcon(item.agent?.icon || '')
        const processing = processingIds.has(item.id)
        const expanded = expandedId === item.id
        const executing = executingId === item.id
        const actionBadge = getSuggestedActionBadge(item.suggestedAction)

        return (
          <div key={item.id} className={cn(
            'card p-5',
            item.suggestedAction === 'escalate' ? 'border-l-4 border-l-status-danger' :
            item.urgency === 'high' ? 'border-l-4 border-l-status-danger' :
            item.suggestedAction === 'approve' ? 'border-l-4 border-l-status-success' : ''
          )}>
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-surface-bg flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-accent-teal" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-text-secondary">{item.agent?.name}</span>
                  <Badge variant={getUrgencyBadgeVariant(item.urgency)} size="sm">{item.urgency}</Badge>
                  {actionBadge && (
                    <Badge variant={actionBadge.variant} size="sm">{actionBadge.label}</Badge>
                  )}
                  {item.relevanceScore !== null && item.relevanceScore !== undefined && (
                    <span className="text-xs text-text-secondary font-medium">{item.relevanceScore}/10 relevance</span>
                  )}
                  <span className="text-xs text-text-secondary ml-auto">{formatRelativeTime(item.createdAt)}</span>
                </div>
                <p className="text-base font-heading text-text-primary">{item.action}</p>
              </div>
            </div>

            {/* Goal alignment */}
            {item.goalAlignment && item.goalAlignment !== 'unknown' && item.goalAlignment !== 'Could not assess' && item.goalAlignment !== 'none' && (
              <div className="flex items-center gap-1.5 text-xs text-accent-teal mb-3 bg-accent-teal-light/30 rounded-lg px-3 py-1.5">
                <Target className="w-3.5 h-3.5 shrink-0" />
                <span>{item.goalAlignment}</span>
              </div>
            )}

            {/* Content */}
            <p className="text-sm text-text-primary leading-relaxed mb-3">{item.detail}</p>

            {/* Reasoning (expandable) */}
            {item.reasoning && (
              <div className="mb-3">
                <button
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
                >
                  <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
                  AI triage reasoning
                </button>
                {expanded && (
                  <p className="text-xs text-text-secondary mt-1.5 pl-4 border-l-2 border-surface-border">{item.reasoning}</p>
                )}
              </div>
            )}

            {/* Chief of Staff Actions */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="text-xs text-text-secondary mr-1">Chief of Staff:</span>
              {EXECUTION_ACTIONS.map(ea => {
                const EaIcon = ea.icon
                return (
                  <button
                    key={ea.type}
                    onClick={() => handleExecute(item.id, ea.type)}
                    disabled={executing}
                    className="text-xs px-2 py-1 rounded-button bg-surface-bg text-text-secondary hover:text-accent-teal hover:bg-accent-teal-light/30 transition-colors flex items-center gap-1"
                    title={ea.description}
                  >
                    {executing && executingId === item.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <EaIcon className="w-3 h-3" />
                    )}
                    {ea.label}
                  </button>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-surface-border">
              <button
                onClick={() => handleAction(item.id, 'approve')}
                disabled={processing}
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Approve & Copy
              </button>
              <button
                onClick={() => { setEditItem(item); setEditDetail(item.detail) }}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                Edit & Approve
              </button>
              <button
                onClick={() => handleCopy(item.detail)}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                onClick={() => handleAction(item.id, 'deny')}
                disabled={processing}
                className="ml-auto text-sm text-text-secondary hover:text-status-danger transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit & Approve"
        size="md"
      >
        {editItem && (
          <div className="space-y-4">
            <div>
              <label className="label">Content</label>
              <textarea
                value={editDetail}
                onChange={e => setEditDetail(e.target.value)}
                rows={6}
                className="input"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setEditItem(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => handleAction(editItem.id, 'approve', editDetail)}
                disabled={processingIds.has(editItem.id)}
                className="btn-primary text-sm"
              >
                Approve & Copy
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
