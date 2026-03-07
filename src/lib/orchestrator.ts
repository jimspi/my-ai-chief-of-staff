import { prisma } from '@/lib/prisma'
import { syncAgent } from '@/lib/sync'
import { triageItem } from '@/lib/triage'
import { getUserGoals } from '@/lib/goals'

interface OrchestratorResult {
  synced: number
  totalCreated: number
  totalTriaged: number
  agentResults: Record<string, { created: number; skipped: number; error?: string }>
  crossAgentInsights: string[]
}

/**
 * Orchestrator: syncs all agents in parallel, applies AI triage,
 * and identifies cross-agent patterns.
 */
export async function orchestrateSync(userId: string, apiKey?: string): Promise<OrchestratorResult> {
  const agents = await prisma.agent.findMany({
    where: { userId, status: 'active', externalUrl: { not: null } },
  })

  const goals = await getUserGoals(userId)

  // Sync all agents in parallel
  const syncPromises = agents.map(async (agent) => {
    try {
      const result = await syncAgent(agent.id)
      return { name: agent.name, id: agent.id, category: agent.category, ...result }
    } catch (err) {
      return { name: agent.name, id: agent.id, category: agent.category, created: 0, skipped: 0, error: String(err) }
    }
  })

  const results = await Promise.all(syncPromises)

  const agentResults: Record<string, { created: number; skipped: number; error?: string }> = {}
  let totalCreated = 0
  for (const r of results) {
    agentResults[r.name] = { created: r.created, skipped: r.skipped, error: r.error }
    totalCreated += r.created
  }

  // Now triage all newly-created pending items
  let totalTriaged = 0
  if (totalCreated > 0 && apiKey) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const newItems = await prisma.approvalItem.findMany({
      where: {
        status: 'pending',
        createdAt: { gte: fiveMinAgo },
        relevanceScore: null,
        agent: { userId },
      },
      include: { agent: { select: { name: true, category: true } } },
    })

    // Build cross-agent context: recent items from OTHER agents
    const recentCrossContext = await prisma.approvalItem.findMany({
      where: {
        agent: { userId },
        status: 'pending',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { agent: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const crossContextStr = recentCrossContext
      .map(i => `[${i.agent.name}] ${i.action}: ${i.detail.slice(0, 100)}`)
      .join('\n')

    // Triage items in parallel (batches of 5 to avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < newItems.length; i += batchSize) {
      const batch = newItems.slice(i, i + batchSize)
      const triagePromises = batch.map(async (item) => {
        try {
          const result = await triageItem(
            `${item.action}\n${item.detail}`,
            item.agent.name,
            item.agent.category,
            goals,
            crossContextStr,
            apiKey
          )

          await prisma.approvalItem.update({
            where: { id: item.id },
            data: {
              urgency: result.urgency,
              relevanceScore: result.relevanceScore,
              suggestedAction: result.suggestedAction,
              goalAlignment: result.goalAlignment,
              reasoning: result.reasoning,
            },
          })

          totalTriaged++
        } catch {
          // Triage failure is non-fatal
        }
      })

      await Promise.all(triagePromises)
    }
  }

  // Detect cross-agent insights
  const crossAgentInsights = await detectCrossAgentPatterns(userId)

  return {
    synced: agents.length,
    totalCreated,
    totalTriaged,
    agentResults,
    crossAgentInsights,
  }
}

/**
 * Detect patterns across agents - overlapping topics, gaps, anomalies.
 */
async function detectCrossAgentPatterns(userId: string): Promise<string[]> {
  const insights: string[] = []

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Check for agents that haven't produced anything in 24h
  const staleAgents = await prisma.agent.findMany({
    where: {
      userId,
      status: 'active',
      externalUrl: { not: null },
      OR: [
        { lastScannedAt: null },
        { lastScannedAt: { lt: since24h } },
      ],
    },
  })
  if (staleAgents.length > 0) {
    insights.push(`${staleAgents.map(a => a.name).join(', ')} ${staleAgents.length === 1 ? 'has' : 'have'} gone silent for 24h+`)
  }

  // Check denial rate by agent (quality signal)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const agents = await prisma.agent.findMany({ where: { userId } })
  for (const agent of agents) {
    const [approved, denied] = await Promise.all([
      prisma.approvalItem.count({
        where: { agentId: agent.id, status: 'approved', resolvedAt: { gte: since7d } },
      }),
      prisma.approvalItem.count({
        where: { agentId: agent.id, status: 'denied', resolvedAt: { gte: since7d } },
      }),
    ])
    const total = approved + denied
    if (total >= 5 && denied / total > 0.6) {
      insights.push(`${agent.name} has a ${Math.round((denied / total) * 100)}% denial rate — content quality may need tuning`)
    }
  }

  // Check for high-urgency item buildup
  const highUrgencyCount = await prisma.approvalItem.count({
    where: { status: 'pending', urgency: 'high', agent: { userId } },
  })
  if (highUrgencyCount >= 3) {
    insights.push(`${highUrgencyCount} high-urgency items are piling up — review needed`)
  }

  return insights
}
