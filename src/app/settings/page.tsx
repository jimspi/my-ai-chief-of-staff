'use client'

import { useState, useEffect, useCallback } from 'react'
import { User as UserIcon, Key, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function SettingsPage() {
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { fetchSettings() }, [fetchSettings])

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
          <p className="text-xs text-text-secondary mt-1.5">Required for AI Briefing and content generation features.</p>
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
