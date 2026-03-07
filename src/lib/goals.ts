import { prisma } from '@/lib/prisma'

export interface Goal {
  id: string
  userId: string
  title: string
  description: string
  priority: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export async function getUserGoals(userId: string): Promise<Goal[]> {
  return prisma.goal.findMany({
    where: { userId, active: true },
    orderBy: { priority: 'desc' },
  })
}

export async function getGoalsSummary(userId: string): Promise<string> {
  const goals = await getUserGoals(userId)
  if (goals.length === 0) return 'No goals defined.'
  return goals
    .map((g, i) => `${i + 1}. [Priority ${g.priority}/10] ${g.title}: ${g.description}`)
    .join('\n')
}

export async function createGoal(userId: string, data: { title: string; description: string; priority?: number }) {
  return prisma.goal.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      priority: data.priority ?? 5,
    },
  })
}

export async function updateGoal(goalId: string, userId: string, data: Partial<{ title: string; description: string; priority: number; active: boolean }>) {
  return prisma.goal.updateMany({
    where: { id: goalId, userId },
    data,
  })
}

export async function deleteGoal(goalId: string, userId: string) {
  return prisma.goal.deleteMany({
    where: { id: goalId, userId },
  })
}
