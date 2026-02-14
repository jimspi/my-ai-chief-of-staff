'use client'

import { useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Shield,
  Activity,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateAgent?: () => void
}

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to Your AI Chief of Staff',
    description:
      'Your personal command center for managing AI agents. Monitor, control, and govern all your autonomous systems from one place.',
    features: [
      'Centralized dashboard for all your AI agents',
      'Real-time activity monitoring and alerts',
      'Full control over what your agents can do',
    ],
  },
  {
    icon: Bot,
    title: 'Meet Your Agents',
    description:
      'Each agent handles a specific domain — news, email, finance, scheduling, and more. You decide their autonomy level and budget.',
    features: [
      'Set autonomy levels: Low, Medium, or High',
      'Assign monthly budgets to control spending',
      'Connect agents to external services and APIs',
    ],
  },
  {
    icon: CheckCircle2,
    title: 'Approve or Deny Actions',
    description:
      'Review what your agents want to do before they do it. Approve, deny, or modify their proposed actions with a single click.',
    features: [
      'Batch approve or deny multiple actions at once',
      'Modify content before approving',
      'Urgency-based prioritization (high, medium, low)',
    ],
  },
  {
    icon: Shield,
    title: 'Governance Rules',
    description:
      'Set rules that automatically control agent behavior. Block sensitive actions, require approvals for high-risk operations, or auto-approve routine tasks.',
    features: [
      'Global rules that apply to all agents',
      'Agent-specific rules for fine-grained control',
      'Conditions: keywords, spending limits, time windows',
    ],
  },
  {
    icon: Activity,
    title: 'Risk & Activity Monitoring',
    description:
      'Track everything your agents do with a complete audit trail. Monitor risk scores, resolve conflicts, and export reports.',
    features: [
      'Full activity log with search and filtering',
      'Risk scoring across financial, legal, and content',
      'Conflict detection when agents disagree',
    ],
  },
]

export default function WelcomeModal({ isOpen, onClose, onCreateAgent }: WelcomeModalProps) {
  const [step, setStep] = useState(0)

  if (!isOpen) return null

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  const handleFinish = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: JSON.stringify({ onboardingComplete: true }),
        }),
      })
    } catch {
      // non-critical
    }
    onClose()
    if (onCreateAgent) onCreateAgent()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-surface-card rounded-card shadow-modal animate-fade-in overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-surface-border">
          <div
            className="h-full bg-accent-teal transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div className="w-14 h-14 rounded-full bg-accent-teal-light flex items-center justify-center mx-auto mb-5">
            <Icon className="w-7 h-7 text-accent-teal" />
          </div>

          {/* Content */}
          <h2 className="font-heading text-xl text-text-primary text-center mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-text-secondary text-center mb-6">
            {current.description}
          </p>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {current.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-accent-teal-light flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-accent-teal" />
                </div>
                <span className="text-sm text-text-primary">{feature}</span>
              </div>
            ))}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === step ? 'bg-accent-teal w-6' : 'bg-surface-border hover:bg-text-secondary'
                )}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="btn-secondary text-sm inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Skip tour
              </button>
            )}

            {isLast ? (
              <button
                onClick={handleFinish}
                className="btn-primary text-sm inline-flex items-center gap-1"
              >
                Get Started
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="btn-primary text-sm inline-flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
