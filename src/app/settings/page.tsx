'use client'

import { useState, useEffect, useCallback } from 'react'
import { User as UserIcon, Key, Eye, EyeOff, Target, Plus, Trash2, GripVertical } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { AGENT_CATEGORIES } from '@/lib/constants'
import type { Goal } from '@/types'

const GOAL_CATEGORIES = ['General', ...AGENT_CATEGORIES]

export default function SettingsPage() {
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Goals
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(true)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDesc, setNewGoalDesc] = useState('')
  const [newGoalCategory, setNewGoalCategory] = useState('General')
  const [addingGoal, setAddingGoal] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setName(data.name || '')
        setEmail(data.email || '')
        setTimezone(data.timezone || 'America/New_York')
        const settings = data.settings ? JSON.parse(data.settings) : {}
        setApiKey(settings.openaiApiKey || '')
      }
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals')
      if (res.ok) setGoals(await res.json())
    } catch { /* */ } finally { setGoalsLoading(false) }
  }, [])

  useEffect(() => { fetchSettings(); fetchGoals() }, [fetchSettings, fetchGoals])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          timezone,
          settings: JSON.stringify({ openaiApiKey: apiKey }),
        }),
      })
      if (res.ok) {
        addToast('Settings saved', 'success')
      }
    } catch {
      addToast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddGoal() {
    if (!newGoalTitle.trim()) return
    setAddingGoal(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newGoalTitle,
          description: newGoalDesc,
          category: newGoalCategory,
          priority: goals.length + 1,
        }),
      })
      if (res.ok) {
        addToast('Goal added', 'success')
        setNewGoalTitle('')
        setNewGoalDesc('')
        setNewGoalCategory('General')
        fetchGoals()
      }
    } catch {
      addToast('Failed to add goal', 'error')
    } finally {
      setAddingGoal(false)
    }
  }

  async function handleDeleteGoal(id: string) {
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Goal removed', 'info')
        fetchGoals()
      }
    } catch {
      addToast('Failed to remove goal', 'error')
    }
  }

  async function handleToggleGoal(goal: Goal) {
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goal.id, active: !goal.active }),
      })
      if (res.ok) fetchGoals()
    } catch {
      addToast('Failed to update goal', 'error')
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-5 bg-surface-bg rounded w-1/4 mb-4" />
            <div className="h-10 bg-surface-bg rounded mb-3" />
            <div className="h-10 bg-surface-bg rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Goals */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-accent-teal" />
          <h3 className="font-heading text-lg text-text-primary">Your Goals</h3>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Define your priorities. The AI Chief of Staff uses these to triage content, score relevance, and generate smarter briefings.
        </p>

        {/* Existing goals */}
        {goalsLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-surface-bg rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {goals.length === 0 ? (
              <p className="text-sm text-text-secondary py-3 text-center">
                No goals set. Add your priorities so the AI can triage content for you.
              </p>
            ) : (
              goals.map((goal, i) => (
                <div key={goal.id} className={`flex items-center gap-3 p-3 rounded-lg border border-surface-border ${!goal.active ? 'opacity-50' : ''}`}>
                  <GripVertical className="w-4 h-4 text-text-secondary shrink-0" />
                  <span className="text-sm font-heading text-accent-teal w-5">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{goal.title}</p>
                    {goal.description && <p className="text-xs text-text-secondary">{goal.description}</p>}
                  </div>
                  <span className="text-xs text-text-secondary shrink-0">{goal.category}</span>
                  <button
                    onClick={() => handleToggleGoal(goal)}
                    className={`text-xs px-2 py-0.5 rounded ${goal.active ? 'bg-status-success/10 text-status-success' : 'bg-surface-bg text-text-secondary'}`}
                  >
                    {goal.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-text-secondary hover:text-status-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Add new goal */}
        <div className="border-t border-surface-border pt-4 space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={newGoalTitle}
              onChange={e => setNewGoalTitle(e.target.value)}
              placeholder="What's a key priority? e.g. 'Grow newsletter to 10k subscribers'"
              className="input flex-1"
            />
            <select
              value={newGoalCategory}
              onChange={e => setNewGoalCategory(e.target.value)}
              className="input w-40"
            >
              {GOAL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={newGoalDesc}
            onChange={e => setNewGoalDesc(e.target.value)}
            placeholder="Optional: add context (e.g. 'Focus on AI and tech content')"
            className="input"
          />
          <button
            onClick={handleAddGoal}
            disabled={addingGoal || !newGoalTitle.trim()}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {addingGoal ? 'Adding...' : 'Add Goal'}
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-5 h-5 text-accent-teal" />
          <h3 className="font-heading text-lg text-text-primary">Profile</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={email} disabled className="input opacity-60" />
          </div>
          <div>
            <label className="label">Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input">
              {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'].map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* AI Integration */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-accent-teal" />
          <h3 className="font-heading text-lg text-text-primary">AI Integration</h3>
        </div>
        <div>
          <label className="label">OpenAI API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="input pr-10"
            />
            <button
              onClick={() => setShowKey(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-1.5">Required for AI Briefing, content generation, auto-triage, and Chief of Staff execution features.</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
