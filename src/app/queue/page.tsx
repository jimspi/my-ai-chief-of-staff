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

export default function ContentQueuePage() {
  const { addToast } = useToast()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      </div>

      {items.map(item => {
        const Icon = getAgentIcon(item.agent?.icon || '')
        const processing = processingIds.has(item.id)
        const expanded = expandedId === item.id

        return (
          <div key={item.id} className={cn(
            'card p-5',
            item.urgency === 'high' && 'border-l-4 border-l-status-danger'
          )}>
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-surface-bg flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-accent-teal" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-secondary">{item.agent?.name}</span>
                  <Badge variant={getUrgencyBadgeVariant(item.urgency)} size="sm">{item.urgency}</Badge>
                  <span className="text-xs text-text-secondary ml-auto">{formatRelativeTime(item.createdAt)}</span>
                </div>
                <p className="text-base font-heading text-text-primary">{item.action}</p>
              </div>
            </div>

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
                  Why this was created
                </button>
                {expanded && (
                  <p className="text-xs text-text-secondary mt-1.5 pl-4 border-l-2 border-surface-border">{item.reasoning}</p>
                )}
              </div>
            )}

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
