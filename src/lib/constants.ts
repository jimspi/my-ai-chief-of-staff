export const NAV_ITEMS = [
  { label: 'Briefing', href: '/', icon: 'Sparkles' },
  { label: 'Content Queue', href: '/queue', icon: 'FileText' },
  { label: 'Agents', href: '/agents', icon: 'Bot' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const

export const AGENT_CATEGORIES = [
  'News',
  'Communication',
  'Research',
  'Finance',
  'Scheduling',
  'Health',
  'Legal',
  'Social Media',
] as const

export const URGENCY_LEVELS = ['low', 'medium', 'high'] as const

export const DEMO_USER_ID = 'demo-user-001'
