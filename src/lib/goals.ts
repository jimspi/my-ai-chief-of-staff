import { prisma } from '@/lib/prisma'

export interface Goal {
  id: string
  title: string
  description: string
  priority: number
  category: string
  active: boolean
}

/**
 * Get active goals for a user, sorted by priority (1 = highest).
 */
export async function getUserGoals(userId: string): Promise<Goal[]> {
  return prisma.goal.findMany({
    where: { userId, active: true },
    orderBy: { priority: 'asc' },
  })
}

/**
 * Format goals as context for AI prompts.
 */
export function formatGoalsForContext(goals: Goal[]): string {
  if (goals.length === 0) {
    return 'USER GOALS: None set. Recommend the user define their priorities.'
  }

  return `USER GOALS (ranked by priority):
${goals.map((g, i) => `${i + 1}. [${g.category}] ${g.title}${g.description ? ` — ${g.description}` : ''}`).join('\n')}`
}

/**
 * Score how well a piece of content aligns with user goals.
 * Returns a string describing alignment for AI context.
 */
export function buildGoalAlignmentPrompt(goals: Goal[], content: string): string {
  if (goals.length === 0) return ''

  return `
Given the user's priorities:
${goals.map((g, i) => `${i + 1}. ${g.title} (${g.category})`).join('\n')}

Score this content's relevance to the user's goals on a scale of 0-10 and explain which goal it serves:
"${content.slice(0, 500)}"
`
}
