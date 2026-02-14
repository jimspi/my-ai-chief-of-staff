'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Bot,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Plus,
  DollarSign,
  Mail,
  Calendar,
  Shield,
  ShoppingCart,
  Heart,
  Scale,
  Share2,
  Search,
  Newspaper,
  FileText,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Send,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Agent, GovernanceRule, ActivityLogEntry } from '@/types'
import {
  cn,
  formatRelativeTime,
  formatDate,
  formatCurrency,
  getTypeBadgeVariant,
  getBudgetPercent,
} from '@/lib/utils'
import {
  RULE_CONDITIONS,
  RULE_ACTIONS,
  ACTIVITY_TYPES,
} from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { StatSkeleton, CardSkeleton, Skeleton } from '@/components/ui/SkeletonLoader'
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

type TabKey = 'overview' | 'rules' | 'budget' | 'history'

interface HistoryResponse {
  items: ActivityLogEntry[]
  total: number
  page: number
  totalPages: number
}

interface NewRuleForm {
  condition: string
  action: string
  threshold: string
  priority: number
}

const INITIAL_RULE_FORM: NewRuleForm = {
  condition: RULE_CONDITIONS[0],
  action: RULE_ACTIONS[0],
  threshold: '',
  priority: 0,
}

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params.id as string
  const { addToast } = useToast()

  const [agent, setAgent] = useState<(Agent & { rules?: GovernanceRule[]; activities?: ActivityLogEntry[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [updatingAgent, setUpdatingAgent] = useState(false)

  // Rules state
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState<NewRuleForm>(INITIAL_RULE_FORM)
  const [creatingRule, setCreatingRule] = useState(false)
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<{
    isOpen: boolean
    ruleId: string | null
  }>({ isOpen: false, ruleId: null })

  // History state
  const [history, setHistory] = useState<ActivityLogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set())

  // Overview recent actions
  const [overviewHistory, setOverviewHistory] = useState<ActivityLogEntry[]>([])
  const [overviewHistoryLoading, setOverviewHistoryLoading] = useState(false)

  // Scan state
  const [scanning, setScanning] = useState(false)

  // AI generate state
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAIPrompt] = useState('')
  const [aiGenerating, setAIGenerating] = useState(false)

  // Budget modal
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetValue, setBudgetValue] = useState('')

  // Budget transactions
  const [budgetTransactions, setBudgetTransactions] = useState<ActivityLogEntry[]>([])
  const [budgetTransactionsLoading, setBudgetTransactionsLoading] = useState(false)

  // Fetch agent data
  const fetchAgent = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/agents/${agentId}`)
      if (!res.ok) throw new Error('Failed to fetch agent')
      const data = await res.json()
      setAgent(data)
      if (data.rules) setRules(data.rules)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  // Fetch rules
  const fetchRules = useCallback(async () => {
    setRulesLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/rules`)
      if (!res.ok) throw new Error('Failed to fetch rules')
      const data: GovernanceRule[] = await res.json()
      setRules(data)
    } catch {
      addToast('Failed to fetch rules', 'error')
    } finally {
      setRulesLoading(false)
    }
  }, [agentId, addToast])

  // Fetch history
  const fetchHistory = useCallback(
    async (page: number, type?: string) => {
      setHistoryLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '15',
        })
        if (type && type !== 'all') {
          params.set('type', type)
        }
        const res = await fetch(`/api/agents/${agentId}/history?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch history')
        const data: HistoryResponse = await res.json()
        setHistory(data.items)
        setHistoryTotalPages(data.totalPages)
        setHistoryPage(data.page)
      } catch {
        addToast('Failed to fetch history', 'error')
      } finally {
        setHistoryLoading(false)
      }
    },
    [agentId, addToast]
  )

  // Fetch overview history (recent 10 actions)
  const fetchOverviewHistory = useCallback(async () => {
    setOverviewHistoryLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/history?limit=10`)
      if (!res.ok) throw new Error('Failed to fetch history')
      const data: HistoryResponse = await res.json()
      setOverviewHistory(data.items)
    } catch {
      // Fail silently, not critical
    } finally {
      setOverviewHistoryLoading(false)
    }
  }, [agentId])

  // Fetch budget transactions
  const fetchBudgetTransactions = useCallback(async () => {
    setBudgetTransactionsLoading(true)
    try {
      const res = await fetch(
        `/api/agents/${agentId}/history?category=Finance&limit=20`
      )
      if (!res.ok) throw new Error('Failed to fetch transactions')
      const data: HistoryResponse = await res.json()
      setBudgetTransactions(data.items)
    } catch {
      // Fail silently
    } finally {
      setBudgetTransactionsLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchAgent()
  }, [fetchAgent])

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    if (!agent) return

    if (activeTab === 'rules') {
      fetchRules()
    } else if (activeTab === 'history') {
      fetchHistory(1, historyFilter)
    } else if (activeTab === 'overview') {
      fetchOverviewHistory()
    } else if (activeTab === 'budget') {
      fetchBudgetTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, agent?.id])

  // Refetch history when filter changes
  useEffect(() => {
    if (activeTab === 'history' && agent) {
      fetchHistory(1, historyFilter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilter])

  const updateAgent = async (updates: Partial<Agent>) => {
    setUpdatingAgent(true)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update agent')
      const updated = await res.json()
      setAgent((prev) => (prev ? { ...prev, ...updated } : prev))
      addToast('Agent updated', 'success')
    } catch {
      addToast('Failed to update agent', 'error')
    } finally {
      setUpdatingAgent(false)
    }
  }

  const handleToggleStatus = () => {
    if (!agent) return
    const newStatus = agent.status === 'active' ? 'paused' : 'active'
    updateAgent({ status: newStatus })
  }

  // Rule handlers
  const handleToggleRule = async (rule: GovernanceRule) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      })
      if (!res.ok) throw new Error('Failed to update rule')
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
      )
      addToast('Rule updated', 'success')
    } catch {
      addToast('Failed to update rule', 'error')
    }
  }

  const handleDeleteRule = async () => {
    if (!deleteRuleConfirm.ruleId) return
    try {
      const res = await fetch(
        `/api/agents/${agentId}/rules?ruleId=${deleteRuleConfirm.ruleId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to delete rule')
      setRules((prev) => prev.filter((r) => r.id !== deleteRuleConfirm.ruleId))
      addToast('Rule deleted', 'success')
    } catch {
      addToast('Failed to delete rule', 'error')
    }
    setDeleteRuleConfirm({ isOpen: false, ruleId: null })
  }

  const handleCreateRule = async () => {
    setCreatingRule(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition: ruleForm.condition,
          action: ruleForm.action,
          threshold: ruleForm.threshold || null,
          priority: ruleForm.priority,
          isActive: true,
        }),
      })
      if (!res.ok) throw new Error('Failed to create rule')
      addToast('Rule created', 'success')
      setShowAddRuleModal(false)
      setRuleForm(INITIAL_RULE_FORM)
      fetchRules()
    } catch {
      addToast('Failed to create rule', 'error')
    } finally {
      setCreatingRule(false)
    }
  }

  const handleUpdateBudget = async () => {
    const newBudget = parseFloat(budgetValue)
    if (isNaN(newBudget) || newBudget < 0) {
      addToast('Enter a valid budget amount', 'error')
      return
    }
    await updateAgent({ budget: newBudget })
    setShowBudgetModal(false)
  }

  const handleTriggerScan = async () => {
    if (!agent?.externalUrl) return
    setScanning(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, { method: 'POST' })
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      if (data.success) {
        addToast(`Scan complete! ${data.postsCreated} post${data.postsCreated === 1 ? '' : 's'} generated.`, 'success')
      } else {
        addToast(data.message || 'Scan completed with no results', 'info')
      }
      await fetchAgent()
      if (activeTab === 'overview') fetchOverviewHistory()
    } catch {
      addToast('Failed to trigger scan', 'error')
    } finally {
      setScanning(false)
    }
  }

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAIGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, prompt: aiPrompt.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Generation failed')
      }
      const data = await res.json()
      addToast(data.message || 'Content generated!', 'success')
      setShowAIModal(false)
      setAIPrompt('')
      await fetchAgent()
      if (activeTab === 'overview') fetchOverviewHistory()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Generation failed', 'error')
    } finally {
      setAIGenerating(false)
    }
  }

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <CardSkeleton />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="animate-fade-in">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-status-danger mx-auto mb-3" />
          <h2 className="font-heading text-xl mb-2">
            {error ?? 'Agent not found'}
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            {error
              ? 'Could not load agent details.'
              : 'The agent you are looking for does not exist.'}
          </p>
          <Link href="/agents" className="btn-primary text-sm inline-block">
            Back to Agents
          </Link>
        </div>
      </div>
    )
  }

  const AgentIcon = getAgentIcon(agent.icon)
  const budgetPercent = getBudgetPercent(agent.budgetUsed, agent.budget)

  // Dynamic tabs: only show budget tab if agent has a budget
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'rules', label: 'Rules' },
    ...(agent.budget != null ? [{ key: 'budget' as TabKey, label: 'Budget' }] : []),
    { key: 'history', label: 'History' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Link */}
      <Link
        href="/agents"
        className="text-sm text-text-secondary hover:text-accent-teal inline-flex items-center gap-1"
      >
        &larr; Back to Agents
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent-teal-light flex items-center justify-center">
            <AgentIcon className="w-6 h-6 text-accent-teal" />
          </div>
          <div>
            <h1 className="font-heading text-2xl text-text-primary">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default">{agent.category}</Badge>
              <Badge
                variant={
                  agent.status === 'active'
                    ? 'success'
                    : agent.status === 'paused'
                    ? 'warning'
                    : 'danger'
                }
              >
                {agent.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAIModal(true)}
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
          {agent.externalUrl && (
            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <RefreshCw className={cn('w-4 h-4', scanning && 'animate-spin')} />
              {scanning ? 'Scanning...' : 'Scan Now'}
            </button>
          )}
          <Toggle
            checked={agent.status === 'active'}
            onChange={handleToggleStatus}
            disabled={updatingAgent}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-b-accent-teal text-accent-teal'
                : 'border-b-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-sm text-text-secondary">Total Actions</p>
              <p className="text-2xl font-heading text-text-primary mt-1">
                {agent._count?.activities ?? 0}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">Approval Rate</p>
              <p className="text-2xl font-heading text-text-primary mt-1">
                {agent._count?.activities && agent._count.activities > 0
                  ? `${Math.round(
                      ((agent._count.activities - (agent._count.approvals ?? 0)) /
                        agent._count.activities) *
                        100
                    )}%`
                  : '100%'}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">Pending Items</p>
              <p className="text-2xl font-heading text-text-primary mt-1">
                {agent._count?.approvals ?? 0}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-text-secondary">Error Rate</p>
              <p className="text-2xl font-heading text-text-primary mt-1">0%</p>
            </div>
          </div>

          {/* External URL info */}
          {agent.externalUrl && (
            <div className="card p-4 flex items-center gap-3">
              <ExternalLink className="w-5 h-5 text-accent-teal shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Connected External Agent</p>
                <p className="text-xs text-text-secondary truncate">{agent.externalUrl}</p>
              </div>
              {agent.lastScannedAt && (
                <p className="text-xs text-text-secondary shrink-0">
                  Last scanned: {formatRelativeTime(agent.lastScannedAt)}
                </p>
              )}
            </div>
          )}

          {/* Recent Actions */}
          <section>
            <h2 className="font-heading text-lg text-text-primary mb-4">
              Recent Actions
            </h2>
            {overviewHistoryLoading ? (
              <div className="space-y-2">
                <CardSkeleton />
              </div>
            ) : overviewHistory.length > 0 ? (
              <div className="card divide-y divide-surface-border">
                {overviewHistory.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-center gap-4">
                    <span className="text-xs text-text-secondary shrink-0 w-20">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                    <span className="text-sm text-text-primary flex-1 truncate">
                      {entry.action}
                    </span>
                    <Badge variant={getTypeBadgeVariant(entry.type)} size="sm">
                      {entry.type}
                    </Badge>
                    <span className="text-xs text-text-secondary truncate max-w-[200px]">
                      {entry.detail}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-6 text-center text-sm text-text-secondary">
                No recent actions recorded.
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg text-text-primary">
              Governance Rules
            </h2>
            <button
              onClick={() => setShowAddRuleModal(true)}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>

          {rulesLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No rules configured"
              description="Add governance rules to control this agent's behavior."
              action={{
                label: 'Add Rule',
                onClick: () => setShowAddRuleModal(true),
              }}
            />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="card p-4">
                  <div className="flex items-start gap-4">
                    <Toggle
                      checked={rule.isActive}
                      onChange={() => handleToggleRule(rule)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary">
                          {rule.condition}
                        </span>
                        <span className="text-text-secondary">&rarr;</span>
                        <Badge
                          variant={
                            rule.action === 'block'
                              ? 'danger'
                              : rule.action === 'require-approval'
                              ? 'warning'
                              : rule.action === 'auto-approve'
                              ? 'success'
                              : 'teal'
                          }
                          size="sm"
                        >
                          {rule.action}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        {rule.threshold && (
                          <span className="text-xs text-text-secondary">
                            Threshold: {rule.threshold}
                          </span>
                        )}
                        <span className="text-xs text-text-secondary">
                          Priority: {rule.priority}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setDeleteRuleConfirm({ isOpen: true, ruleId: rule.id })
                      }
                      className="p-1.5 rounded-button text-text-secondary hover:text-status-danger hover:bg-status-danger-light transition-colors shrink-0"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Rule Modal */}
          <Modal
            isOpen={showAddRuleModal}
            onClose={() => {
              setShowAddRuleModal(false)
              setRuleForm(INITIAL_RULE_FORM)
            }}
            title="Add Governance Rule"
          >
            <div className="space-y-4">
              <div>
                <label className="label">Condition</label>
                <select
                  value={ruleForm.condition}
                  onChange={(e) =>
                    setRuleForm((p) => ({ ...p, condition: e.target.value }))
                  }
                  className="input"
                >
                  {RULE_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Action</label>
                <select
                  value={ruleForm.action}
                  onChange={(e) =>
                    setRuleForm((p) => ({ ...p, action: e.target.value }))
                  }
                  className="input"
                >
                  {RULE_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Threshold (optional)</label>
                <input
                  type="text"
                  value={ruleForm.threshold}
                  onChange={(e) =>
                    setRuleForm((p) => ({ ...p, threshold: e.target.value }))
                  }
                  placeholder="e.g. 500, 3 per hour"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) =>
                    setRuleForm((p) => ({
                      ...p,
                      priority: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="input"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddRuleModal(false)
                    setRuleForm(INITIAL_RULE_FORM)
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRule}
                  disabled={creatingRule}
                  className="btn-primary text-sm"
                >
                  {creatingRule ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </div>
          </Modal>

          {/* Delete Rule Confirm */}
          <ConfirmDialog
            isOpen={deleteRuleConfirm.isOpen}
            onClose={() =>
              setDeleteRuleConfirm({ isOpen: false, ruleId: null })
            }
            onConfirm={handleDeleteRule}
            title="Delete Rule"
            message="Are you sure you want to delete this governance rule? This action cannot be undone."
            confirmLabel="Delete"
            variant="danger"
          />
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="space-y-6 animate-fade-in">
          {agent.budget == null ? (
            <EmptyState
              icon={DollarSign}
              title="No budget configured"
              description="Set a monthly budget to track spending for this agent."
              action={{
                label: 'Set Budget',
                onClick: () => {
                  setBudgetValue('')
                  setShowBudgetModal(true)
                },
              }}
            />
          ) : (
            <>
              {/* Budget overview */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-lg text-text-primary">
                    Monthly Budget
                  </h2>
                  <button
                    onClick={() => {
                      setBudgetValue(String(agent.budget ?? ''))
                      setShowBudgetModal(true)
                    }}
                    className="btn-secondary text-sm py-1.5"
                  >
                    Edit
                  </button>
                </div>

                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-heading text-text-primary">
                    {formatCurrency(agent.budgetUsed)}
                  </span>
                  <span className="text-text-secondary">
                    of {formatCurrency(agent.budget)}
                  </span>
                </div>

                <div className="h-3 rounded-full bg-surface-border overflow-hidden mb-2">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      budgetPercent > 90 ? 'bg-status-danger' : 'bg-accent-teal'
                    )}
                    style={{ width: `${budgetPercent}%` }}
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  {budgetPercent}% used this period ({agent.budgetPeriod})
                </p>
              </div>

              {/* Transaction-like history */}
              <section>
                <h2 className="font-heading text-lg text-text-primary mb-4">
                  Financial Activity
                </h2>
                {budgetTransactionsLoading ? (
                  <CardSkeleton />
                ) : budgetTransactions.length > 0 ? (
                  <div className="card divide-y divide-surface-border">
                    {budgetTransactions.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 flex items-center gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {entry.action}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {entry.detail}
                          </p>
                        </div>
                        <span className="text-xs text-text-secondary shrink-0">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card p-6 text-center text-sm text-text-secondary">
                    No financial activity recorded for this agent.
                  </div>
                )}
              </section>
            </>
          )}

          {/* Budget Edit Modal */}
          <Modal
            isOpen={showBudgetModal}
            onClose={() => setShowBudgetModal(false)}
            title="Set Monthly Budget"
            size="sm"
          >
            <div className="space-y-4">
              <div>
                <label className="label">Monthly Limit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="input"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowBudgetModal(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBudget}
                  disabled={updatingAgent}
                  className="btn-primary text-sm"
                >
                  {updatingAgent ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setHistoryFilter(type.value)
                  setHistoryPage(1)
                }}
                className={cn(
                  'px-3 py-1.5 rounded-button text-sm font-medium transition-colors',
                  historyFilter === type.value
                    ? 'bg-accent-teal text-white'
                    : 'bg-surface-card text-text-secondary hover:bg-surface-bg border border-surface-border'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* History list */}
          {historyLoading ? (
            <div className="space-y-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No activity found"
              description="No activity recorded for the selected filter."
            />
          ) : (
            <div className="card divide-y divide-surface-border">
              {history.map((entry) => (
                <div key={entry.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-text-secondary shrink-0 w-20">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                    <span className="text-sm text-text-primary flex-1 truncate">
                      {entry.action}
                    </span>
                    <Badge variant={getTypeBadgeVariant(entry.type)} size="sm">
                      {entry.type}
                    </Badge>
                    <button
                      onClick={() => toggleHistoryExpand(entry.id)}
                      className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          expandedHistoryIds.has(entry.id) && 'rotate-180'
                        )}
                      />
                    </button>
                  </div>
                  {expandedHistoryIds.has(entry.id) && (
                    <div className="mt-2 ml-24 p-3 bg-surface-bg rounded-input text-sm text-text-secondary animate-fade-in">
                      {entry.detail || 'No additional details.'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => {
                      setHistoryPage(page)
                      fetchHistory(page, historyFilter)
                    }}
                    className={cn(
                      'w-8 h-8 rounded-button text-sm font-medium transition-colors',
                      historyPage === page
                        ? 'bg-accent-teal text-white'
                        : 'bg-surface-card text-text-secondary hover:bg-surface-bg border border-surface-border'
                    )}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Generate Modal */}
      <Modal
        isOpen={showAIModal}
        onClose={() => {
          setShowAIModal(false)
          setAIPrompt('')
        }}
        title={`Generate with ${agent.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Describe what you want {agent.name} to create. The output will be sent to your approval queue for review.
          </p>
          <div>
            <label className="label">Prompt</label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              rows={4}
              placeholder={
                agent.category === 'News'
                  ? 'e.g. Write a Twitter thread about the latest AI regulation news'
                  : agent.category === 'Communication'
                  ? 'e.g. Draft a follow-up email to the client about project timeline'
                  : agent.category === 'Research'
                  ? 'e.g. Compile a research brief on multi-agent systems'
                  : `e.g. Describe what you want ${agent.name} to do...`
              }
              className="input"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setShowAIModal(false)
                setAIPrompt('')
              }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAIGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              {aiGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
