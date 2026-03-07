'use client'

import { useState, useEffect, useCallback } from 'react'
import { User as UserIcon, Key, Eye, EyeOff, Target, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import type { Goal } from '@/types'

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
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', priority: 5 })
  const [creatingGoal, setCreatingGoal] = useState(false)

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
    } catch { /* */ }
  }, [])

  useEffect(() => { fetchSettings(); fetchGoals() }, [fetchSettings, fetchGoals])

  async function handleCreateGoal() {
    if (!goalForm.title.trim() || !goalForm.description.trim()) return
    setCreatingGoal(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalForm),
      })
      if (res.ok) {
        addToast('Goal created', 'success')
        setGoalForm({ title: '', description: '', priority: 5 })
        setShowGoalForm(false)
        fetchGoals()
      }
    } catch {
      addToast('Failed to create goal', 'error')
    } finally {
      setCreatingGoal(false)
    }
  }

  async function handleDeleteGoal(goalId: string) {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Goal removed', 'info')
        fetchGoals()
      }
    } catch {
      addToast('Failed to delete goal', 'error')
    }
  }

  async function handleToggleGoal(goal: Goal) {
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !goal.active }),
      })
      fetchGoals()
    } catch {
      addToast('Failed to update goal', 'error')
    }
  }

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
          <p className="text-xs text-text-secondary mt-1.5">Optional if OPENAI_API_KEY is set as a server environment variable (e.g. on Vercel). Only needed to override the server key.</p>
        </div>
      </div>

      {/* Goals */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-accent-teal" />
            <h3 className="font-heading text-lg text-text-primary">Goals</h3>
          </div>
          <button
            onClick={() => setShowGoalForm(!showGoalForm)}
            className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Goal
          </button>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Define your priorities. The AI uses these to score every incoming item — triage, briefings, and recommendations are all driven by your goals.
        </p>

        {showGoalForm && (
          <div className="p-4 rounded-lg bg-surface-bg mb-4 space-y-3">
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                value={goalForm.title}
                onChange={e => setGoalForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Grow newsletter subscribers"
                className="input"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={goalForm.description}
                onChange={e => setGoalForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="What does success look like? How should AI prioritize content for this goal?"
                className="input"
              />
            </div>
            <div>
              <label className="label">Priority (1-10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={goalForm.priority}
                onChange={e => setGoalForm(p => ({ ...p, priority: Number(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Low</span>
                <span className="font-medium text-text-primary">{goalForm.priority}</span>
                <span>Critical</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowGoalForm(false)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={handleCreateGoal}
                disabled={creatingGoal || !goalForm.title.trim() || !goalForm.description.trim()}
                className="btn-primary text-sm"
              >
                {creatingGoal ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </div>
        )}

        {goals.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-4">No goals yet. Add goals to help your Chief of Staff prioritize.</p>
        ) : (
          <div className="space-y-3">
            {goals.map(goal => (
              <div key={goal.id} className={`flex items-start gap-3 p-3 rounded-lg border border-surface-border ${!goal.active ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text-primary">{goal.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent-teal-light text-accent-teal">P{goal.priority}</span>
                    {!goal.active && <span className="text-xs text-text-secondary">(paused)</span>}
                  </div>
                  <p className="text-xs text-text-secondary">{goal.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleGoal(goal)}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    {goal.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1 text-text-secondary hover:text-status-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
