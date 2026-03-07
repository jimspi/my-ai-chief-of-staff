import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId, AuthError } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [activeAgents, contentReady, activityToday, goalsSet] = await Promise.all([
      prisma.agent.count({ where: { userId, status: 'active' } }),
      prisma.approvalItem.count({ where: { status: 'pending', agent: { userId } } }),
      prisma.activityLog.count({ where: { agent: { userId }, createdAt: { gte: todayStart } } }),
      prisma.goal.count({ where: { userId, active: true } }),
    ])

    const stats = { activeAgents, contentReady, activityToday, goalsSet }

    const content = await prisma.approvalItem.findMany({
      where: { status: 'pending', agent: { userId } },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
    })

    // Sort by: escalated first, then urgency, then relevance score, then time
    const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    const actionOrder: Record<string, number> = { escalate: 0, approve: 1, review: 2, dismiss: 3 }
    content.sort((a, b) => {
      // Escalated items first
      const aAction = actionOrder[a.suggestedAction || 'review'] ?? 2
      const bAction = actionOrder[b.suggestedAction || 'review'] ?? 2
      if (aAction !== bAction) return aAction - bAction
      // Then by urgency
      const d = (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1)
      if (d !== 0) return d
      // Then by relevance score (higher first)
      const aScore = a.relevanceScore ?? 5
      const bScore = b.relevanceScore ?? 5
      if (aScore !== bScore) return bScore - aScore
      // Then by time
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

    // Generate insights
    const insights: string[] = []
    const staleAgents = agents.filter(a => {
      if (!a.externalUrl || a.status !== 'active') return false
      if (!a.lastScannedAt) return true
      return (Date.now() - new Date(a.lastScannedAt).getTime()) > 24 * 60 * 60 * 1000
    })
    if (staleAgents.length > 0) {
      insights.push(`${staleAgents.map(a => a.name).join(', ')} haven't reported in 24h+`)
    }
    const highUrgency = content.filter(c => c.urgency === 'high')
    if (highUrgency.length >= 3) {
      insights.push(`${highUrgency.length} high-urgency items piling up`)
    }
    if (goalsSet === 0) {
      insights.push('No goals set — AI triage and briefings work better with goals defined')
    }

    return NextResponse.json({ stats, content, agents, recentActivity, insights })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
