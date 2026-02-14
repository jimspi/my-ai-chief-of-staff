export const NAV_ITEMS = [
  { label: 'Command Center', href: '/', icon: 'LayoutDashboard' },
  { label: 'Approvals', href: '/approvals', icon: 'CheckCircle' },
  { label: 'My Agents', href: '/agents', icon: 'Bot' },
  { label: 'Activity Log', href: '/activity', icon: 'ScrollText' },
  { label: 'Risk & Conflicts', href: '/risk', icon: 'ShieldAlert' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const

export const AGENT_CATEGORIES = [
  'News',
  'Communication',
  'Finance',
  'Scheduling',
  'Shopping',
  'Health',
  'Legal',
  'Social Media',
  'Research',
] as const

export const URGENCY_LEVELS = ['low', 'medium', 'high'] as const
export const AUTONOMY_LEVELS = ['low', 'medium', 'high'] as const

export const APPROVAL_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Urgent', value: 'high' },
  { label: 'News', value: 'News' },
  { label: 'Financial', value: 'Finance' },
  { label: 'Communication', value: 'Communication' },
  { label: 'Legal', value: 'Legal' },
] as const

export const ACTIVITY_TYPES = [
  { label: 'All', value: 'all' },
  { label: 'Auto', value: 'auto' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
  { label: 'Alerts', value: 'alert' },
] as const

export const DEMO_USER_ID = 'demo-user-001'

export const RULE_CONDITIONS = [
  'Post contains sensitive keywords',
  'Post mentions competitor brand',
  'Scan finds breaking news',
  'Amount exceeds threshold',
  'Category matches',
  'Time is outside hours',
  'Action involves external service',
  'Frequency exceeds limit',
  'Risk score above threshold',
] as const

export const RULE_ACTIONS = [
  'auto-approve',
  'require-approval',
  'block',
  'notify',
] as const
