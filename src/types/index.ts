export interface User {
  id: string
  name: string
  email: string
  timezone: string
  settings: string
  createdAt: string
}

export interface Agent {
  id: string
  userId: string
  name: string
  icon: string
  category: string
  description: string
  status: 'active' | 'paused' | 'error'
  autonomyLevel: 'low' | 'medium' | 'high'
  budget: number | null
  budgetUsed: number
  budgetPeriod: string
  externalUrl: string | null
  lastScannedAt: string | null
  scanInterval: number
  createdAt: string
  _count?: {
    approvals: number
    activities: number
    conflicts: number
  }
}

export interface ApprovalItem {
  id: string
  agentId: string
  action: string
  detail: string
  amount: number | null
  urgency: 'low' | 'medium' | 'high'
  riskTag: string | null
  status: 'pending' | 'approved' | 'denied'
  reasoning: string | null
  createdAt: string
  resolvedAt: string | null
  agent?: Agent
}

export interface ActivityLogEntry {
  id: string
  agentId: string
  action: string
  type: 'auto' | 'approved' | 'denied' | 'alert'
  category: string
  detail: string
  metadata: string
  createdAt: string
  agent?: Agent
}

export interface GovernanceRule {
  id: string
  agentId: string | null
  userId: string
  condition: string
  action: string
  threshold: string | null
  isActive: boolean
  priority: number
  createdAt: string
  agent?: Agent
}

export interface Conflict {
  id: string
  description: string
  status: 'active' | 'resolved'
  resolution: string | null
  createdAt: string
  resolvedAt: string | null
  agents: ConflictAgent[]
}

export interface ConflictAgent {
  id: string
  conflictId: string
  agentId: string
  agent?: Agent
}

export interface Transaction {
  id: string
  agentId: string
  description: string
  amount: number
  status: string
  createdAt: string
  agent?: Agent
}

export interface DashboardData {
  stats: {
    activeAgents: number
    pendingApprovals: number
    actionsToday: number
    riskAlerts: number
  }
  approvals: ApprovalItem[]
  agents: Agent[]
  recentActivity: ActivityLogEntry[]
  conflicts: Conflict[]
}

export interface RiskData {
  overallScore: number
  categories: {
    financial: number
    communication: number
    legal: number
    content: number
  }
  totalSpending: number
  dailySpending: { date: string; amount: number }[]
  topSpenders: { agentName: string; amount: number }[]
  alerts: ActivityLogEntry[]
}
