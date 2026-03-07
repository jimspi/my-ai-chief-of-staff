import { getOpenAIClient } from '@/lib/openai'
import { formatGoalsForContext, type Goal } from '@/lib/goals'

interface TriageResult {
  urgency: 'low' | 'medium' | 'high'
  relevanceScore: number
  suggestedAction: string
  goalAlignment: string
  reasoning: string
}

/**
 * AI-powered triage: scores incoming content against user goals,
 * assigns urgency, and suggests an action.
 */
export async function triageItem(
  content: string,
  agentName: string,
  agentCategory: string,
  goals: Goal[],
  recentContext: string,
  apiKey?: string
): Promise<TriageResult> {
  const openai = getOpenAIClient(apiKey)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a Chief of Staff AI that triages incoming content. You score relevance, assign urgency, and recommend actions.

${formatGoalsForContext(goals)}

You must respond with ONLY valid JSON in this exact format:
{
  "urgency": "low" | "medium" | "high",
  "relevanceScore": 0-10,
  "suggestedAction": "approve" | "review" | "dismiss" | "escalate",
  "goalAlignment": "which goal this serves and why, or 'none'",
  "reasoning": "one sentence explaining your triage decision"
}

Scoring guide:
- HIGH urgency: time-sensitive, directly serves top priority goals, or flags a risk
- MEDIUM urgency: relevant to goals but not time-critical
- LOW urgency: informational, loosely related, or noise
- relevanceScore 8-10: directly advances a top-3 goal
- relevanceScore 5-7: tangentially relevant to goals
- relevanceScore 0-4: not aligned with stated goals

suggestedAction guide:
- "approve": high-quality, goal-aligned, ready to act on
- "review": needs human judgment, could go either way
- "dismiss": low relevance, noise, or duplicate
- "escalate": urgent + important, needs immediate attention`,
      },
      {
        role: 'user',
        content: `Agent: ${agentName} (${agentCategory})
Content: ${content.slice(0, 1000)}

Recent context from other agents:
${recentContext || 'No recent cross-agent context.'}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 256,
  })

  const text = response.choices[0]?.message?.content || ''

  try {
    const parsed = JSON.parse(text)
    return {
      urgency: ['low', 'medium', 'high'].includes(parsed.urgency) ? parsed.urgency : 'medium',
      relevanceScore: Math.min(10, Math.max(0, Number(parsed.relevanceScore) || 5)),
      suggestedAction: parsed.suggestedAction || 'review',
      goalAlignment: parsed.goalAlignment || 'unknown',
      reasoning: parsed.reasoning || 'Auto-triaged by AI',
    }
  } catch {
    return {
      urgency: 'medium',
      relevanceScore: 5,
      suggestedAction: 'review',
      goalAlignment: 'Could not assess',
      reasoning: 'Auto-triaged (fallback)',
    }
  }
}
