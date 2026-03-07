import { prisma } from '@/lib/prisma'
import { syncAgent } from '@/lib/sync'
import { syncGmailAgent, syncCalendarAgent } from '@/lib/google-sync'
import { triageBatch } from '@/lib/triage'

interface OrchestratorResult {
  synced: number
  totalCreated: number
  triaged: number
  insights: string[]
  results: Record<string, { created: number; skipped: number; error?: string }>
}

export async function orchestrateSync(userId: string, apiKey?: string): Promise<OrchestratorResult> {
  // Get external URL agents + Google-connected agents
  const allAgents = await prisma.agent.findMany({
    where: { userId, status: 'active' },
  })

  const externalAgents = allAgents.filter(a => a.externalUrl)
  const gmailAgents = allAgents.filter(a => a.category === 'Gmail')
  const calendarAgents = allAgents.filter(a => a.category === 'Calendar')

  // Check if Google is connected
  const googleAccount = await prisma.googleAccount.findUnique({ where: { userId } })

  // 1. Sync all agents in parallel
  const syncPromises = [
    // External URL agents
    ...externalAgents.map(async (agent) => ({
      name: agent.name,
      result: await syncAgent(agent.id),
    })),
    // Gmail agents (if Google connected)
    ...(googleAccount ? gmailAgents.map(async (agent) => ({
      name: agent.name,
      result: await syncGmailAgent(agent.id, userId),
    })) : []),
    // Calendar agents (if Google connected)
    ...(googleAccount ? calendarAgents.map(async (agent) => ({
      name: agent.name,
      result: await syncCalendarAgent(agent.id, userId),
    })) : []),
  ]

  const agents = [...externalAgents, ...(googleAccount ? [...gmailAgents, ...calendarAgents] : [])]
  const syncResults = await Promise.allSettled(syncPromises)

  const results: Record<string, { created: number; skipped: number; error?: string }> = {}
  let totalCreated = 0
  for (const r of syncResults) {
    if (r.status === 'fulfilled') {
      results[r.value.name] = r.value.result
      totalCreated += r.value.result.created
    } else {
      // Find which agent failed based on order
      const idx = syncResults.indexOf(r)
      const agentName = agents[idx]?.name || 'Unknown'
      results[agentName] = { created: 0, skipped: 0, error: String(r.reason) }
    }
  }

  // 2. Triage new untriaged items if we have an API key
  let triaged = 0
  if (apiKey && totalCreated > 0) {
    const untriagedItems = await prisma.approvalItem.findMany({
      where: {
        agent: { userId },
        status: 'pending',
        triaged: false,
      },
      include: { agent: { select: { name: true } } },
      take: 20,
    })

    if (untriagedItems.length > 0) {
      const itemsForTriage = untriagedItems.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        agentName: item.agent.name,
      }))

      await triageBatch(itemsForTriage, userId, apiKey)
      triaged = untriagedItems.length
    }
  }

  // 3. Detect cross-agent patterns
  const insights = await detectPatterns(userId)

  // 4. Update agent stats
  await updateAgentStats(userId)

  return { synced: agents.length, totalCreated, triaged, insights, results }
}

async function detectPatterns(userId: string): Promise<string[]> {
  const insights: string[] = []
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const agents = await prisma.agent.findMany({
    where: { userId },
    include: {
      content: {
        where: { resolvedAt: { gte: since7d } },
        select: { status: true, relevanceScore: true },
      },
    },
  })

  for (const agent of agents) {
    const resolved = agent.content
    if (resolved.length < 3) continue

    const approved = resolved.filter((c) => c.status === 'approved').length
    const rate = approved / resolved.length

    if (rate < 0.3) {
      insights.push(`${agent.name} has a ${Math.round(rate * 100)}% approval rate — content quality may need attention`)
    }

    const avgRelevance = resolved.reduce((sum, c) => sum + (c.relevanceScore ?? 5), 0) / resolved.length
    if (avgRelevance < 4) {
      insights.push(`${agent.name} avg relevance is ${avgRelevance.toFixed(1)}/10 — may not be aligned with your goals`)
    }
  }

  // Check for stale agents (external URL agents or Google agents)
  const googleCategories = ['Gmail', 'Calendar']
  const stale = agents.filter((a) => {
    if (a.status !== 'active') return false
    if (!a.externalUrl && !googleCategories.includes(a.category)) return false
    if (!a.lastScannedAt) return true
    return Date.now() - new Date(a.lastScannedAt).getTime() > 48 * 60 * 60 * 1000
  })
  if (stale.length > 0) {
    insights.push(`Stale agents (48h+ since last scan): ${stale.map((a) => a.name).join(', ')}`)
  }

  // Check for urgency buildup
  const highUrgency = await prisma.approvalItem.count({
    where: { agent: { userId }, status: 'pending', urgency: 'high' },
  })
  if (highUrgency >= 3) {
    insights.push(`${highUrgency} high-urgency items building up in queue — review needed`)
  }

  return insights
}

async function updateAgentStats(userId: string) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const agents = await prisma.agent.findMany({
    where: { userId },
    select: { id: true },
  })

  await Promise.all(
    agents.map(async (agent) => {
      const resolved = await prisma.approvalItem.findMany({
        where: { agentId: agent.id, resolvedAt: { gte: since30d }, status: { in: ['approved', 'denied'] } },
        select: { status: true, relevanceScore: true },
      })

      if (resolved.length === 0) return

      const approved = resolved.filter((r) => r.status === 'approved').length
      const approvalRate = approved / resolved.length
      const avgRelevance = resolved.reduce((sum, r) => sum + (r.relevanceScore ?? 5), 0) / resolved.length

      await prisma.agent.update({
        where: { id: agent.id },
        data: { approvalRate, avgRelevance },
      })
    })
  )
}
