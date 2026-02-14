'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bot,
  Plus,
  AlertTriangle,
  Mail,
  Calendar,
  Shield,
  ShoppingCart,
  Heart,
  Scale,
  Share2,
  Search,
  Newspaper,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Agent } from '@/types'
import { cn, formatCurrency, getBudgetPercent } from '@/lib/utils'
import { AGENT_CATEGORIES, AUTONOMY_LEVELS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import Toggle from '@/components/ui/Toggle'
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

const CATEGORY_ICON_MAP: Record<string, string> = {
  News: 'Newspaper',
  Communication: 'Mail',
  Finance: 'ShoppingCart',
  Scheduling: 'Calendar',
  Shopping: 'ShoppingCart',
  Health: 'Heart',
  Legal: 'Scale',
  'Social Media': 'Share2',
  Research: 'Search',
}

function getAutonomyBadgeVariant(level: string): 'default' | 'teal' | 'warning' {
  switch (level) {
    case 'low':
      return 'default'
    case 'medium':
      return 'teal'
    case 'high':
      return 'warning'
    default:
      return 'default'
  }
}

interface NewAgentForm {
  name: string
  category: string
  description: string
  autonomyLevel: 'low' | 'medium' | 'high'
  budget: string
  externalUrl: string
}

const INITIAL_FORM: NewAgentForm = {
  name: '',
  category: 'News',
  description: '',
  autonomyLevel: 'medium',
  budget: '',
  externalUrl: '',
}

export default function AgentsPage() {
  const { addToast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  // Add agent modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<NewAgentForm>(INITIAL_FORM)
  const [creating, setCreating] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data: Agent[] = await res.json()
      setAgents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    setUpdatingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update agent')

      // Optimistic update
      setAgents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      )
      addToast('Agent updated', 'success')
    } catch {
      addToast('Failed to update agent', 'error')
      // Revert by refetching
      fetchAgents()
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleToggleStatus = (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active'
    updateAgent(agent.id, { status: newStatus })
  }

  const handleAutonomyChange = (agent: Agent, level: 'low' | 'medium' | 'high') => {
    if (level !== agent.autonomyLevel) {
      updateAgent(agent.id, { autonomyLevel: level })
    }
  }

  const handleCreateAgent = async () => {
    if (!form.name.trim()) {
      addToast('Agent name is required', 'error')
      return
    }
    setCreating(true)
    try {
      const icon = CATEGORY_ICON_MAP[form.category] || 'Bot'
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        icon,
        category: form.category,
        description: form.description.trim(),
        autonomyLevel: form.autonomyLevel,
      }
      if (form.budget.trim()) {
        body.budget = parseFloat(form.budget)
      }
      if (form.externalUrl.trim()) {
        body.externalUrl = form.externalUrl.trim()
      }

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create agent')

      addToast('Agent created successfully', 'success')
      setShowAddModal(false)
      setForm(INITIAL_FORM)
      fetchAgents()
    } catch {
      addToast('Failed to create agent', 'error')
    } finally {
      setCreating(false)
    }
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-status-danger mx-auto mb-3" />
          <h2 className="font-heading text-xl mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <button onClick={fetchAgents} className="btn-primary text-sm">
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
        <h1 className="font-heading text-2xl text-text-primary">My Agents</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage and configure your AI agents
        </p>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {agents.map((agent) => {
            const AgentIcon = getAgentIcon(agent.icon)
            const budgetPercent = getBudgetPercent(agent.budgetUsed, agent.budget)
            const isUpdating = updatingIds.has(agent.id)

            return (
              <div key={agent.id} className="card-hover p-5">
                {/* Header: Icon + Name + Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center shrink-0">
                      <AgentIcon className="w-5 h-5 text-accent-teal" />
                    </div>
                    <h3 className="font-heading text-lg text-text-primary">{agent.name}</h3>
                  </div>
                  <Toggle
                    checked={agent.status === 'active'}
                    onChange={() => handleToggleStatus(agent)}
                    disabled={isUpdating}
                  />
                </div>

                {/* Category + Autonomy Badges */}
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default" size="sm">{agent.category}</Badge>
                  <Badge variant={getAutonomyBadgeVariant(agent.autonomyLevel)} size="sm">
                    {agent.autonomyLevel} autonomy
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-text-secondary line-clamp-2 mb-3">
                  {agent.description}
                </p>

                {/* Stats Row */}
                <div className="flex gap-4 mb-3">
                  <div>
                    <span className="text-base font-medium text-text-primary">
                      {agent._count?.activities ?? 0}
                    </span>
                    <span className="text-xs text-text-secondary ml-1">actions</span>
                  </div>
                  <div>
                    <span className="text-base font-medium text-text-primary">
                      {agent._count?.approvals ?? 0}
                    </span>
                    <span className="text-xs text-text-secondary ml-1">pending</span>
                  </div>
                  <div>
                    <span className="text-base font-medium text-text-primary">
                      {agent._count?.conflicts ?? 0}
                    </span>
                    <span className="text-xs text-text-secondary ml-1">conflicts</span>
                  </div>
                </div>

                {/* Budget Section */}
                {agent.budget != null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                      <span>Budget</span>
                      <span>
                        {formatCurrency(agent.budgetUsed)} / {formatCurrency(agent.budget)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-border overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          budgetPercent > 90 ? 'bg-status-danger' : 'bg-accent-teal'
                        )}
                        style={{ width: `${budgetPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Autonomy Level Buttons */}
                <div className="flex gap-1 mb-3">
                  {AUTONOMY_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => handleAutonomyChange(agent, level)}
                      disabled={isUpdating}
                      className={cn(
                        'flex-1 py-1 text-xs font-medium rounded-button transition-colors capitalize',
                        agent.autonomyLevel === level
                          ? 'bg-accent-teal text-white'
                          : 'bg-surface-bg text-text-secondary hover:bg-surface-border'
                      )}
                    >
                      {level === 'medium' ? 'Med' : level === 'low' ? 'Low' : 'High'}
                    </button>
                  ))}
                </div>

                {/* Configure Link */}
                <Link
                  href={`/agents/${agent.id}`}
                  className="text-sm font-medium text-accent-teal hover:text-accent-teal-hover"
                >
                  Configure
                </Link>
              </div>
            )
          })}

          {/* Add Agent Card */}
          <button
            onClick={() => setShowAddModal(true)}
            className="border-2 border-dashed border-surface-border rounded-card p-5 flex flex-col items-center justify-center gap-3 hover:border-accent-teal hover:bg-accent-teal-light/30 transition-colors min-h-[200px] cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-surface-bg flex items-center justify-center">
              <Plus className="w-6 h-6 text-text-secondary" />
            </div>
            <span className="font-heading text-lg text-text-secondary">Add Agent</span>
          </button>
        </div>
      )}

      {/* Add Agent Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setForm(INITIAL_FORM)
        }}
        title="Add New Agent"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Echo, Chronos..."
              className="input"
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="input"
            >
              {AGENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="What does this agent do?"
              className="input"
            />
          </div>

          <div>
            <label className="label">Autonomy Level</label>
            <div className="flex gap-2">
              {AUTONOMY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() =>
                    setForm((p) => ({ ...p, autonomyLevel: level }))
                  }
                  className={cn(
                    'flex-1 py-2 text-sm font-medium rounded-button transition-colors capitalize',
                    form.autonomyLevel === level
                      ? 'bg-accent-teal text-white'
                      : 'bg-surface-bg text-text-secondary hover:bg-surface-border border border-surface-border'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">External Agent URL (optional)</label>
            <input
              type="url"
              value={form.externalUrl}
              onChange={(e) => setForm((p) => ({ ...p, externalUrl: e.target.value }))}
              placeholder="e.g. https://my-agent.vercel.app"
              className="input"
            />
          </div>

          <div>
            <label className="label">Monthly Budget (optional)</label>
            <input
              type="number"
              step="0.01"
              value={form.budget}
              onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
              placeholder="e.g. 500.00"
              className="input"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setShowAddModal(false)
                setForm(INITIAL_FORM)
              }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
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
