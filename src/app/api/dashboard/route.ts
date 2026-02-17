import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [activeAgents, contentReady, activityToday] = await Promise.all([
      prisma.agent.count({ where: { userId, status: 'active' } }),
      prisma.approvalItem.count({ where: { status: 'pending', agent: { userId } } }),
      prisma.activityLog.count({ where: { agent: { userId }, createdAt: { gte: todayStart } } }),
    ])

    const stats = { activeAgents, contentReady, activityToday }

    const content = await prisma.approvalItem.findMany({
      where: { status: 'pending', agent: { userId } },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
    })

    // Sort by urgency then time
    const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    content.sort((a, b) => {
      const d = (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1)
      if (d !== 0) return d
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const agents = await prisma.agent.findMany({
      where: { userId },
      include: {
        _count: { select: { content: true, activities: true } },
      },
    })

    const recentActivity = await prisma.activityLog.findMany({
      where: { agent: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { agent: true },
    })

    return NextResponse.json({ stats, content, agents, recentActivity })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
