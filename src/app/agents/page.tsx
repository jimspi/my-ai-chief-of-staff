'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Bot,
  Plus,
  Newspaper,
  Mail,
  Search,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn, getStatusDotColor } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { AGENT_CATEGORIES } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Toggle from '@/components/ui/Toggle'
import { CardSkeleton } from '@/components/ui/SkeletonLoader'
import type { Agent } from '@/types'

const ICON_MAP: Record<string, LucideIcon> = { Newspaper, Mail, Search }
function getAgentIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Bot
}

const CATEGORY_ICON_MAP: Record<string, string> = {
  News: 'Newspaper', Communication: 'Mail', Research: 'Search',
  Finance: 'Shield', Scheduling: 'Calendar', Health: 'Heart',
  Legal: 'Scale', 'Social Media': 'Share2',
}

const INITIAL_FORM = { name: '', category: 'News', description: '', externalUrl: '' }

export default function AgentsPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [creating, setCreating] = useState(false)

  const handleAuthError = useCallback(async () => {
    addToast('Session expired — please sign in again', 'error')
    await signOut({ redirect: false })
    router.push('/login')
  }, [addToast, router])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.status === 401) { handleAuthError(); return }
      if (res.ok) setAgents(await res.json())
    } catch { /* */ } finally { setLoading(false) }
  }, [handleAuthError])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  async function handleCreateAgent() {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          icon: CATEGORY_ICON_MAP[form.category] || 'Bot',
          externalUrl: form.externalUrl || null,
        }),
      })
      if (res.status === 401) { handleAuthError(); return }
      if (res.ok) {
        addToast('Agent created', 'success')
        setShowAddModal(false)
        setForm(INITIAL_FORM)
        fetchAgents()
      } else {
        const data = await res.json()
        addToast(data.error || 'Failed to create agent', 'error')
      }
    } catch {
      addToast('Failed to create agent', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus(agent: Agent) {
    const newStatus = agent.status === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a))
        addToast(`${agent.name} ${newStatus}`, 'success')
      }
    } catch {
      addToast('Failed to update agent', 'error')
    }
  }

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(agent => {
          const Icon = getAgentIcon(agent.icon)
          return (
            <div key={agent.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-teal-light flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent-teal" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base text-text-primary">{agent.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge size="sm">{agent.category}</Badge>
                      <span className={cn('status-dot', getStatusDotColor(agent.status))} />
                    </div>
                  </div>
                </div>
                <Toggle
                  checked={agent.status === 'active'}
                  onChange={() => toggleStatus(agent)}
                />
              </div>

              <p className="text-sm text-text-secondary mb-3 line-clamp-2">{agent.description}</p>

              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span>{agent._count?.content ?? 0} pending</span>
                <span>{agent._count?.activities ?? 0} actions</span>
              </div>

              {agent.externalUrl && (
                <div className="flex items-center gap-1.5 text-xs text-accent-teal mt-2">
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate">{agent.externalUrl}</span>
                </div>
              )}
            </div>
          )
        })}

        {/* Add Agent Card */}
        <button
          onClick={() => setShowAddModal(true)}
          className="border-2 border-dashed border-surface-border rounded-card p-5 flex flex-col items-center justify-center gap-3 hover:border-accent-teal hover:bg-accent-teal-light/30 transition-colors min-h-[180px]"
        >
          <Plus className="w-8 h-8 text-text-secondary" />
          <span className="font-heading text-lg text-text-secondary">Add Agent</span>
        </button>
      </div>

      {/* Add Agent Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setForm(INITIAL_FORM) }}
        title="Add New Agent"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Echo, Chronos..."
              className="input"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="input"
            >
              {AGENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="What does this agent do?"
              className="input"
            />
          </div>
          <div>
            <label className="label">External URL (optional)</label>
            <input
              type="url"
              value={form.externalUrl}
              onChange={e => setForm(p => ({ ...p, externalUrl: e.target.value }))}
              placeholder="e.g. https://my-agent.vercel.app"
              className="input"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => { setShowAddModal(false); setForm(INITIAL_FORM) }} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={handleCreateAgent}
              disabled={creating || !form.name.trim()}
              className="btn-primary text-sm"
            >
              {creating ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
