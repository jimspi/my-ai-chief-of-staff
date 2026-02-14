import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'teal'
  size?: 'sm' | 'md'
}

const variantClasses = {
  default: 'bg-surface-bg text-text-secondary',
  success: 'bg-status-success-light text-status-success',
  warning: 'bg-status-warning-light text-status-warning',
  danger: 'bg-status-danger-light text-status-danger',
  teal: 'bg-accent-teal-light text-accent-teal',
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size]
      )}
    >
      {children}
    </span>
  )
}
