export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

export function getUrgencyBorderClass(urgency: string): string {
  switch (urgency) {
    case 'high': return 'border-l-4 border-l-status-danger'
    case 'medium': return 'border-l-4 border-l-status-warning'
    default: return 'border-l-4 border-l-surface-border'
  }
}

export function getUrgencyBadgeVariant(urgency: string): 'danger' | 'warning' | 'default' {
  switch (urgency) {
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'default'
  }
}

export function getStatusDotColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-status-success'
    case 'paused': return 'bg-status-warning'
    case 'error': return 'bg-status-danger'
    default: return 'bg-text-secondary'
  }
}

export function getTypeBadgeVariant(type: string): 'teal' | 'success' | 'danger' | 'warning' | 'default' {
  switch (type) {
    case 'auto': return 'teal'
    case 'approved': return 'success'
    case 'denied': return 'danger'
    case 'alert': return 'warning'
    default: return 'default'
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getAutonomyPercent(level: string): number {
  switch (level) {
    case 'low': return 33
    case 'medium': return 66
    case 'high': return 100
    default: return 50
  }
}

export function getBudgetPercent(used: number, total: number | null): number {
  if (!total || total === 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}
