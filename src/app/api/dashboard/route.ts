import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Stats
    const [activeAgents, pendingApprovals, actionsToday, riskAlerts] = await Promise.all([
      prisma.agent.count({
        where: { userId: userId, status: 'active' },
      }),
      prisma.approvalItem.count({
        where: { status: 'pending', agent: { userId: userId } },
      }),
      prisma.activityLog.count({
        where: { agent: { userId: userId }, createdAt: { gte: todayStart } },
      }),
      prisma.activityLog.count({
        where: { type: 'alert', agent: { userId: userId }, createdAt: { gte: todayStart } },
      }),
    ])

    const stats = { activeAgents, pendingApprovals, actionsToday, riskAlerts }

    // Approvals - fetch all pending, sort by urgency in JS
    const allPendingApprovals = await prisma.approvalItem.findMany({
      where: { status: 'pending', agent: { userId: userId } },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
    })

    const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    allPendingApprovals.sort((a, b) => {
      const urgencyDiff = (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1)
      if (urgencyDiff !== 0) return urgencyDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    const approvals = allPendingApprovals.slice(0, 4)

    // Agents with counts
    const agents = await prisma.agent.findMany({
      where: { userId: userId },
      include: {
        _count: {
          select: {
            approvals: { where: { status: 'pending' } },
            activities: true,
            conflicts: true,
          },
        },
      },
    })

    // Recent activity
    const recentActivity = await prisma.activityLog.findMany({
      where: { agent: { userId: userId } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { agent: true },
    })

    // Conflicts
    const conflicts = await prisma.conflict.findMany({
      where: { status: 'active' },
      include: {
        agents: {
          include: { agent: true },
        },
      },
    })

    return NextResponse.json({ stats, approvals, agents, recentActivity, conflicts })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
