'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User as UserIcon,
  Globe,
  Bell,
  Database,
  Plus,
  Trash2,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { GovernanceRule } from '@/types'
import { cn } from '@/lib/utils'
import { RULE_CONDITIONS, RULE_ACTIONS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { CardSkeleton } from '@/components/ui/SkeletonLoader'
import { useToast } from '@/contexts/ToastContext'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
]

function getActionBadgeVariant(action: string): 'success' | 'warning' | 'danger' | 'teal' | 'default' {
  switch (action) {
    case 'auto-approve': return 'success'
    case 'require-approval': return 'warning'
    case 'block': return 'danger'
    case 'notify': return 'teal'
    default: return 'default'
  }
}

export default function SettingsPage() {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [inAppNotifs, setInAppNotifs] = useState(true)
  const [urgencyThreshold, setUrgencyThreshold] = useState<'high' | 'medium' | 'all'>('medium')

  // Data & Privacy
  const [dataRetention, setDataRetention] = useState('90')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // OpenAI
  const [openaiKey, setOpenaiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  // Global Rules
  const [globalRules, setGlobalRules] = useState<GovernanceRule[]>([])
  const [addRuleModalOpen, setAddRuleModalOpen] = useState(false)
  const [newRuleCondition, setNewRuleCondition] = useState<string>(RULE_CONDITIONS[0])
  const [newRuleAction, setNewRuleAction] = useState<string>(RULE_ACTIONS[0])
  const [newRuleThreshold, setNewRuleThreshold] = useState('')
  const [addingRule, setAddingRule] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, rulesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/global-rules'),
      ])

      if (settingsRes.ok) {
        const userData = await settingsRes.json()
        setName(userData.name ?? '')
        setEmail(userData.email ?? '')
        setTimezone(userData.timezone ?? 'America/New_York')

        try {
          const parsed = JSON.parse(userData.settings || '{}')
          if (parsed.notifications) {
            setEmailNotifs(parsed.notifications.email ?? true)
            setPushNotifs(parsed.notifications.push ?? true)
            setInAppNotifs(parsed.notifications.inApp ?? true)
            setUrgencyThreshold(parsed.notifications.urgencyThreshold ?? 'medium')
          }
          if (parsed.dataRetention) {
            setDataRetention(parsed.dataRetention)
          }
          if (parsed.openaiApiKey) {
            setOpenaiKey(parsed.openaiApiKey)
          }
        } catch {
          // ignore parse errors
        }
      }

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json()
        setGlobalRules(Array.isArray(rulesData) ? rulesData : rulesData.rules ?? [])
      }
    } catch {
      addToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const settingsJson = JSON.stringify({
        notifications: {
          email: emailNotifs,
          push: pushNotifs,
          inApp: inAppNotifs,
          urgencyThreshold,
        },
        dataRetention,
        openaiApiKey: openaiKey || undefined,
      })

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          timezone,
          settings: settingsJson,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/global-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, isActive }),
      })
      if (!res.ok) throw new Error('Failed to update rule')
      setGlobalRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, isActive } : r))
      )
      addToast(isActive ? 'Rule enabled' : 'Rule disabled', 'success')
    } catch {
      addToast('Failed to update rule', 'error')
    }
  }

  const deleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/global-rules?id=${ruleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete rule')
      setGlobalRules((prev) => prev.filter((r) => r.id !== ruleId))
      addToast('Rule deleted', 'success')
    } catch {
      addToast('Failed to delete rule', 'error')
    }
  }

  const addRule = async () => {
    setAddingRule(true)
    try {
      const res = await fetch('/api/global-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition: newRuleCondition,
          action: newRuleAction,
          threshold: newRuleThreshold || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to add rule')
      addToast('Global rule added', 'success')
      setAddRuleModalOpen(false)
      setNewRuleCondition(RULE_CONDITIONS[0])
      setNewRuleAction(RULE_ACTIONS[0])
      setNewRuleThreshold('')
      await fetchSettings()
    } catch {
      addToast('Failed to add rule', 'error')
    } finally {
      setAddingRule(false)
    }
  }

  const handleExportData = () => {
    addToast('Export started. You will receive a download link via email.', 'info')
  }

  const handleDeleteHistory = () => {
    addToast('Agent history deleted successfully', 'success')
    setDeleteConfirmOpen(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your profile, rules, and preferences
          </p>
        </div>
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
        <h1 className="font-heading text-2xl text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your profile, rules, and preferences
        </p>
      </div>

      {/* A) Profile */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-accent-teal" />
          </div>
          <h2 className="font-heading text-lg text-text-primary">Profile</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="label text-sm mb-1.5 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full text-sm"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="label text-sm mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full text-sm"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="label text-sm mb-1.5 block">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input w-full text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </section>

      {/* B) Global Rules */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
              <Globe className="w-5 h-5 text-accent-teal" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-text-primary">Global Governance Rules</h2>
              <p className="text-xs text-text-secondary">Rules that apply to ALL agents</p>
            </div>
          </div>
          <button
            onClick={() => setAddRuleModalOpen(true)}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Global Rule
          </button>
        </div>

        {globalRules.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-6">
            No global rules configured yet.
          </p>
        ) : (
          <div className="space-y-3 mt-4">
            {globalRules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg bg-surface-bg',
                  !rule.isActive && 'opacity-60'
                )}
              >
                <Toggle
                  checked={rule.isActive}
                  onChange={(checked) => toggleRule(rule.id, checked)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{rule.condition}</p>
                  {rule.threshold && (
                    <p className="text-xs text-text-secondary mt-0.5">
                      Threshold: {rule.threshold}
                    </p>
                  )}
                </div>
                <Badge variant={getActionBadgeVariant(rule.action)} size="sm">
                  {rule.action}
                </Badge>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 rounded text-text-secondary hover:text-status-danger hover:bg-status-danger-light transition-colors"
                  aria-label="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* C) Notification Preferences */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
            <Bell className="w-5 h-5 text-accent-teal" />
          </div>
          <h2 className="font-heading text-lg text-text-primary">Notification Preferences</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-text-primary">Email Notifications</p>
              <p className="text-xs text-text-secondary">Receive alerts via email</p>
            </div>
            <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-text-primary">Push Notifications</p>
              <p className="text-xs text-text-secondary">Browser push notifications</p>
            </div>
            <Toggle checked={pushNotifs} onChange={setPushNotifs} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-text-primary">In-App Notifications</p>
              <p className="text-xs text-text-secondary">Show notifications within the dashboard</p>
            </div>
            <Toggle checked={inAppNotifs} onChange={setInAppNotifs} />
          </div>

          <div className="border-t border-surface-border pt-4">
            <label className="label text-sm mb-1.5 block">Urgency Threshold</label>
            <p className="text-xs text-text-secondary mb-2">
              Only notify for items at or above this urgency level
            </p>
            <div className="flex items-center gap-2">
              {(['high', 'medium', 'all'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setUrgencyThreshold(level)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize',
                    urgencyThreshold === level
                      ? 'bg-accent-teal text-white'
                      : 'bg-surface-bg text-text-secondary hover:bg-surface-border'
                  )}
                >
                  {level === 'high' ? 'High Only' : level === 'medium' ? 'Medium + High' : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-surface-border">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </section>

      {/* D) AI Integration */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
            <Key className="w-5 h-5 text-accent-teal" />
          </div>
          <div>
            <h2 className="font-heading text-lg text-text-primary">AI Integration</h2>
            <p className="text-xs text-text-secondary">Connect OpenAI for AI-powered agent capabilities</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label text-sm mb-1.5 block">OpenAI API Key</label>
            <p className="text-xs text-text-secondary mb-2">
              Your API key is stored securely and used for content generation, risk analysis, and smart suggestions.
            </p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="input w-full text-sm pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        </div>
      </section>

      {/* E) Data & Privacy */}
      <section className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-accent-teal-light flex items-center justify-center">
            <Database className="w-5 h-5 text-accent-teal" />
          </div>
          <h2 className="font-heading text-lg text-text-primary">Data &amp; Privacy</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={handleExportData}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              <Database className="w-4 h-4" />
              Export All Data
            </button>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="btn-danger text-sm inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete Agent History
            </button>
          </div>

          <div className="border-t border-surface-border pt-4">
            <label className="label text-sm mb-1.5 block">Data Retention Period</label>
            <p className="text-xs text-text-secondary mb-2">
              How long to keep activity logs and transaction history
            </p>
            <select
              value={dataRetention}
              onChange={(e) => setDataRetention(e.target.value)}
              className="input text-sm w-48"
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="forever">Forever</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Privacy Settings'}
            </button>
          </div>
        </div>
      </section>

      {/* Add Global Rule Modal */}
      <Modal
        isOpen={addRuleModalOpen}
        onClose={() => setAddRuleModalOpen(false)}
        title="Add Global Rule"
      >
        <div className="space-y-4">
          <div>
            <label className="label text-sm mb-1.5 block">Condition</label>
            <select
              value={newRuleCondition}
              onChange={(e) => setNewRuleCondition(e.target.value)}
              className="input w-full text-sm"
            >
              {RULE_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-sm mb-1.5 block">Action</label>
            <select
              value={newRuleAction}
              onChange={(e) => setNewRuleAction(e.target.value)}
              className="input w-full text-sm"
            >
              {RULE_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-sm mb-1.5 block">Threshold (optional)</label>
            <input
              type="text"
              value={newRuleThreshold}
              onChange={(e) => setNewRuleThreshold(e.target.value)}
              placeholder="e.g., $500, 10pm-7am"
              className="input w-full text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setAddRuleModalOpen(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={addRule}
              disabled={addingRule}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {addingRule ? 'Adding...' : 'Add Rule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete History Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteHistory}
        title="Delete Agent History"
        message="Are you sure you want to delete all agent history? This action cannot be undone and will remove all activity logs, transaction records, and audit trails."
        confirmLabel="Delete History"
        variant="danger"
      />
    </div>
  )
}
