import { getOpenAIClient } from '@/lib/openai'
import { getGoalsSummary } from '@/lib/goals'
import { prisma } from '@/lib/prisma'

export interface TriageResult {
  urgency: 'low' | 'medium' | 'high'
  relevanceScore: number
  suggestedAction: 'approve' | 'review' | 'dismiss' | 'escalate'
  goalAlignment: string
  reasoning: string
}

export async function triageItem(
  item: { id: string; action: string; detail: string; agentName: string },
  userId: string,
  crossAgentContext: string,
  apiKey: string
): Promise<TriageResult> {
  const goalsSummary = await getGoalsSummary(userId)

  const openai = getOpenAIClient(apiKey)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an AI Chief of Staff triage engine. Score incoming items against the user's goals and recommend an action.

USER'S GOALS:
${goalsSummary}

CROSS-AGENT CONTEXT (other recent items across all agents):
${crossAgentContext || 'No other items currently.'}

Respond with ONLY valid JSON (no markdown):
{
  "urgency": "low" | "medium" | "high",
  "relevanceScore": 0-10,
  "suggestedAction": "approve" | "review" | "dismiss" | "escalate",
  "goalAlignment": "which goal this serves, or 'none'",
  "reasoning": "one sentence explaining your judgment"
}

Scoring rules:
- urgency: high = time-sensitive + goal-aligned, medium = useful but not urgent, low = noise or tangential
- relevanceScore: 10 = directly advances top goal, 0 = completely irrelevant
- suggestedAction: approve = high quality + goal-aligned, review = needs human judgment, dismiss = low relevance or noise, escalate = urgent + important
- Be opinionated. If content is generic filler, score it low.`,
      },
      {
        role: 'user',
        content: `Agent: ${item.agentName}\nAction: ${item.action}\nContent: ${item.detail.slice(0, 500)}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 256,
  })

  const text = response.choices[0]?.message?.content || '{}'
  try {
    const result = JSON.parse(text)
    return {
      urgency: ['low', 'medium', 'high'].includes(result.urgency) ? result.urgency : 'medium',
      relevanceScore: Math.min(10, Math.max(0, Number(result.relevanceScore) || 5)),
      suggestedAction: ['approve', 'review', 'dismiss', 'escalate'].includes(result.suggestedAction) ? result.suggestedAction : 'review',
      goalAlignment: result.goalAlignment || 'none',
      reasoning: result.reasoning || 'Auto-triaged',
    }
  } catch {
    return {
      urgency: 'medium',
      relevanceScore: 5,
      suggestedAction: 'review',
      goalAlignment: 'none',
      reasoning: 'Triage parse error — defaulting to review',
    }
  }
}

export async function triageBatch(
  items: { id: string; action: string; detail: string; agentName: string }[],
  userId: string,
  apiKey: string
): Promise<void> {
  // Build cross-agent context from all items
  const crossContext = items
    .map((it) => `[${it.agentName}] ${it.action}: ${it.detail.slice(0, 100)}`)
    .join('\n')

  // Process in parallel batches of 5
  const batchSize = 5
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await triageItem(item, userId, crossContext, apiKey)
          await prisma.approvalItem.update({
            where: { id: item.id },
            data: {
              urgency: result.urgency,
              relevanceScore: result.relevanceScore,
              suggestedAction: result.suggestedAction,
              goalAlignment: result.goalAlignment,
              reasoning: result.reasoning,
              triaged: true,
            },
          })
        } catch (err) {
          console.error(`Triage failed for item ${item.id}:`, err)
        }
      })
    )
  }
}
