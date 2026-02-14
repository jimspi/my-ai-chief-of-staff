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
  externalUrl: string | null
  lastScannedAt: string | null
  scanInterval: number
  createdAt: string
  _count?: {
    content: number
    activities: number
  }
}

export interface ContentItem {
  id: string
  agentId: string
  action: string
  detail: string
  urgency: 'low' | 'medium' | 'high'
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

export interface BriefingData {
  stats: {
    activeAgents: number
    contentReady: number
    activityToday: number
  }
  content: ContentItem[]
  agents: Agent[]
  recentActivity: ActivityLogEntry[]
}
