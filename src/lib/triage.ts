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
        content: `You are an AI Chief of Staff triage engine. Score incoming items against the user's goals and tell them what to DO about each one.

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
  "reasoning": "specific action recommendation - e.g. 'Reply today — they need budget approval by Friday' NOT generic like 'may be relevant to goals'"
}

Scoring rules:
- urgency: high = needs response/action within hours, medium = should handle today, low = can wait or ignore
- relevanceScore: 10 = directly advances top goal, 0 = completely irrelevant
- suggestedAction: approve = important + act on it, review = needs human judgment, dismiss = noise/low value, escalate = urgent + blocking something
- reasoning: MUST be a specific action the user should take. Say what to do, not just why it matters. Reference the sender/subject/event by name.
- Be opinionated. Newsletters, marketing, and automated notifications = dismiss. Personal emails from real people = higher priority.`,
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
