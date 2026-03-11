'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Sparkles,
  RefreshCw,
  Check,
  X,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Badge from '@/components/ui/Badge'
import { CardSkeleton } from '@/components/ui/SkeletonLoader'
import type { BriefingData, ContentItem, Agent } from '@/types'

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
            addToast(`${result.totalCreated} new item${result.totalCreated === 1 ? '' : 's'} synced`, 'success')
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
      const allItems = [...(data?.emailItems || []), ...(data?.calendarItems || []), ...(data?.content || [])]
      const item = allItems.find(c => c.id === id)
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
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <CardSkeleton /><CardSkeleton />
      </div>
    )
  }

  if (!data) return <div className="p-6 text-text-secondary">Failed to load data.</div>

  const gmailAgent = data.agents.find((a: Agent) => a.category === 'Gmail')
  const calendarAgent = data.agents.find((a: Agent) => a.category === 'Calendar')
  const googleConnected = gmailAgent || calendarAgent

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = session?.user?.name?.split(' ')[0] || ''

  // Count high urgency across all items
  const highUrgencyCount = [...(data.emailItems || []), ...(data.calendarItems || [])].filter(i => i.urgency === 'high').length

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-text-primary">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {highUrgencyCount > 0 ? (
              <span className="text-status-danger">You have {highUrgencyCount} urgent item{highUrgencyCount === 1 ? '' : 's'} needing attention</span>
            ) : (
              "Here\u2019s what\u2019s on your plate"
            )}
          </p>
        </div>
        <button
          onClick={generateBriefing}
          disabled={briefingLoading}
          className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
        >
          {briefingLoading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> AI Briefing</>
          )}
        </button>
      </div>

      {/* AI Briefing (expandable, only shown when generated) */}
      {briefing && (
        <div className="card p-5 border-l-4 border-l-accent-teal">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent-teal" />
            <h3 className="font-heading text-sm text-accent-teal">AI BRIEFING</h3>
          </div>
          <div className="text-sm text-text-primary leading-relaxed space-y-2">
            {briefing.split('\n').map((line, i) => {
              const trimmed = line.trim()
              if (!trimmed) return null
              if (/^[A-Z][A-Z\s]{3,}$/.test(trimmed)) {
                return <h4 key={i} className="font-heading text-accent-teal text-xs pt-3 first:pt-0 uppercase tracking-wide">{trimmed}</h4>
              }
              return <p key={i}>{trimmed}</p>
            })}
          </div>
        </div>
      )}

      {/* Urgent items banner */}
      {highUrgencyCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-status-danger/5 border border-status-danger/20">
          <AlertCircle className="w-5 h-5 text-status-danger shrink-0" />
          <p className="text-sm text-text-primary">
            <span className="font-medium">{highUrgencyCount} urgent</span> — review these first
          </p>
        </div>
      )}

      {/* Google not connected */}
      {!googleConnected && (
        <div className="card p-8 text-center">
          <Mail className="w-10 h-10 text-text-secondary mx-auto mb-3" />
          <h3 className="font-heading text-lg text-text-primary mb-2">Connect your Google account</h3>
          <p className="text-sm text-text-secondary mb-4">Link Gmail and Google Calendar to see your emails and schedule here.</p>
          <Link href="/settings" className="btn-primary text-sm py-2 px-6 inline-block">
            Go to Settings
          </Link>
        </div>
      )}

      {/* Today's Schedule */}
      {calendarAgent && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-teal" />
              <h2 className="font-heading text-base text-text-primary">Today&apos;s Schedule</h2>
              {data.calendarItems.length > 0 && (
                <span className="text-xs text-text-secondary bg-surface-bg px-2 py-0.5 rounded-full">{data.calendarItems.length}</span>
              )}
            </div>
            <button
              onClick={() => handleScan(calendarAgent.id)}
              disabled={scanningId !== null}
              className="text-text-secondary hover:text-text-primary transition-colors p-1.5"
              title="Refresh calendar"
            >
              <RefreshCw className={cn('w-4 h-4', scanningId === calendarAgent.id && 'animate-spin')} />
            </button>
          </div>
          {data.calendarItems.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 pb-4">No events today.</p>
          ) : (
            <div className="divide-y divide-surface-border">
              {data.calendarItems.map((item: ContentItem) => {
                const processing = processingIds.has(item.id)
                const timeMatch = item.detail.match(/Time: (.+)/)
                const locationMatch = item.detail.match(/Location: (.+)/)
                const attendeesMatch = item.detail.match(/Attendees: (.+)/)
                const eventName = item.detail.split('\n')[0]
                return (
                  <div key={item.id} className={cn(
                    'px-4 py-3 flex items-start gap-4 hover:bg-surface-bg/50 transition-colors',
                    item.urgency === 'high' && 'border-l-3 border-l-status-danger'
                  )}>
                    {/* Time column */}
                    <div className="w-20 shrink-0 pt-0.5">
                      {timeMatch ? (
                        <p className="text-sm font-medium text-text-primary">{timeMatch[1].split(' - ')[0]}</p>
                      ) : (
                        <p className="text-xs text-text-secondary">All day</p>
                      )}
                    </div>
                    {/* Event details */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">{eventName}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        {timeMatch && timeMatch[1].includes(' - ') && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-text-secondary" />
                            <span className="text-xs text-text-secondary">{timeMatch[1]}</span>
                          </div>
                        )}
                        {locationMatch && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-text-secondary" />
                            <span className="text-xs text-text-secondary">{locationMatch[1]}</span>
                          </div>
                        )}
                        {attendeesMatch && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-text-secondary" />
                            <span className="text-xs text-text-secondary line-clamp-1">{attendeesMatch[1]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleAction(item.id, 'approve')}
                        disabled={processing}
                        className="p-1.5 rounded-button text-text-secondary hover:bg-status-success/10 hover:text-status-success transition-colors"
                        title="Approve"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'deny')}
                        disabled={processing}
                        className="p-1.5 rounded-button text-text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Email */}
      {gmailAgent && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent-teal" />
              <h2 className="font-heading text-base text-text-primary">Email</h2>
              {data.emailItems.length > 0 && (
                <span className="text-xs text-text-secondary bg-surface-bg px-2 py-0.5 rounded-full">{data.emailItems.length}</span>
              )}
            </div>
            <button
              onClick={() => handleScan(gmailAgent.id)}
              disabled={scanningId !== null}
              className="text-text-secondary hover:text-text-primary transition-colors p-1.5"
              title="Refresh email"
            >
              <RefreshCw className={cn('w-4 h-4', scanningId === gmailAgent.id && 'animate-spin')} />
            </button>
          </div>
          {data.emailItems.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 pb-4">No emails need attention.</p>
          ) : (
            <div className="divide-y divide-surface-border">
              {data.emailItems.map((item: ContentItem) => {
                const processing = processingIds.has(item.id)
                const isFollowUp = item.action.startsWith('Follow up')
                // Parse sender from detail
                const fromMatch = item.detail.match(/From: (.+)/)
                const subjectMatch = item.detail.match(/Subject: (.+)/)
                const sender = fromMatch ? fromMatch[1].replace(/<.*>/, '').trim() : ''
                const subject = subjectMatch ? subjectMatch[1] : item.action
                return (
                  <div key={item.id} className={cn(
                    'px-4 py-3 flex items-start gap-3 hover:bg-surface-bg/50 transition-colors',
                    item.urgency === 'high' && 'border-l-3 border-l-status-danger'
                  )}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-text-primary truncate">{sender || 'Unknown'}</span>
                        {isFollowUp && (
                          <Badge variant="warning" size="sm">follow-up</Badge>
                        )}
                        {item.urgency === 'high' && !isFollowUp && (
                          <Badge variant="danger" size="sm">urgent</Badge>
                        )}
                        <span className="text-xs text-text-secondary ml-auto shrink-0">{formatRelativeTime(item.createdAt)}</span>
                      </div>
                      <p className="text-sm text-text-primary truncate">{subject}</p>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{item.detail.split('\n\n')[1] || ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleAction(item.id, 'approve')}
                        disabled={processing}
                        className="p-1.5 rounded-button text-text-secondary hover:bg-status-success/10 hover:text-status-success transition-colors"
                        title="Approve"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'deny')}
                        disabled={processing}
                        className="p-1.5 rounded-button text-text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
