import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUserId } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const userId = await getSessionUserId()
    // Overall score components
    const [activeConflicts, highUrgencyPending] = await Promise.all([
      prisma.conflict.count({ where: { status: 'active' } }),
      prisma.approvalItem.count({
        where: { status: 'pending', urgency: 'high', agent: { userId: userId } },
      }),
    ])

    const overallScore = Math.min(100, activeConflicts * 15 + highUrgencyPending * 10 + 10)

    // Category risk calculations
    // Financial: based on budget usage ratio across financial agents
    const financialAgents = await prisma.agent.findMany({
      where: { userId: userId, category: 'Finance' },
      select: { budget: true, budgetUsed: true },
    })

    let financialRisk = 20
    if (financialAgents.length > 0) {
      const totalBudget = financialAgents.reduce((sum, a) => sum + (a.budget ?? 0), 0)
      const totalUsed = financialAgents.reduce((sum, a) => sum + a.budgetUsed, 0)
      if (totalBudget > 0) {
        financialRisk = Math.min(100, Math.round((totalUsed / totalBudget) * 100))
      }
    }

    // Communication: count pending for communication agents * 10
    const communicationPending = await prisma.approvalItem.count({
      where: { status: 'pending', agent: { userId: userId, category: 'Communication' } },
    })
    const communicationRisk = Math.min(100, communicationPending * 10)

    // Legal: 65 if any legal pending with high urgency, else 20
    const legalHighUrgency = await prisma.approvalItem.count({
      where: {
        status: 'pending',
        urgency: 'high',
        agent: { userId: userId, category: 'Legal' },
      },
    })
    const legalRisk = legalHighUrgency > 0 ? 65 : 20

    // Content: based on pending news posts count
    const contentPending = await prisma.approvalItem.count({
      where: { status: 'pending', agent: { userId: userId, category: 'News' } },
    })
    const contentRisk = Math.min(100, contentPending * 15)

    const categories = {
      financial: financialRisk,
      communication: communicationRisk,
      legal: legalRisk,
      content: contentRisk,
    }

    // Total spending this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthlyTransactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: monthStart }, agent: { userId: userId } },
      select: { amount: true },
    })
    const totalSpending = monthlyTransactions.reduce((sum, t) => sum + t.amount, 0)

    // Daily spending for last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const recentTransactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, agent: { userId: userId } },
      select: { amount: true, createdAt: true },
    })

    const dailyMap: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dailyMap[key] = 0
    }
    for (const t of recentTransactions) {
      const key = new Date(t.createdAt).toISOString().split('T')[0]
      if (dailyMap[key] !== undefined) {
        dailyMap[key] += t.amount
      }
    }

    const dailySpending = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))

    // Top spenders: group by agentId, sum amounts, include agent name, top 5
    const allTransactionsThisMonth = await prisma.transaction.findMany({
      where: { createdAt: { gte: monthStart }, agent: { userId: userId } },
      select: { agentId: true, amount: true, agent: { select: { name: true } } },
    })

    const spenderMap: Record<string, { agentId: string; name: string; total: number }> = {}
    for (const t of allTransactionsThisMonth) {
      if (!spenderMap[t.agentId]) {
        spenderMap[t.agentId] = { agentId: t.agentId, name: t.agent.name, total: 0 }
      }
      spenderMap[t.agentId].total += t.amount
    }

    const topSpenders = Object.values(spenderMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((s) => ({ ...s, total: Math.round(s.total * 100) / 100 }))

    // Alerts: recent alert-type activities
    const alerts = await prisma.activityLog.findMany({
      where: { type: 'alert', agent: { userId: userId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { agent: true },
    })

    return NextResponse.json({
      overallScore,
      categories,
      totalSpending: Math.round(totalSpending * 100) / 100,
      dailySpending,
      topSpenders,
      alerts,
    })
  } catch (error) {
    console.error('Risk GET error:', error)
    return NextResponse.json({ error: 'Failed to calculate risk data' }, { status: 500 })
  }
}
