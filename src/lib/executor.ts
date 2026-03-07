import { getOpenAIClient } from '@/lib/openai'
import { prisma } from '@/lib/prisma'
import { getUserGoals, formatGoalsForContext } from '@/lib/goals'

export type ExecutionType = 'draft_response' | 'research' | 'summarize' | 'rewrite'

interface ExecutionResult {
  type: ExecutionType
  output: string
  approvalId: string
}

const EXECUTION_PROMPTS: Record<ExecutionType, string> = {
  draft_response: `You are a Chief of Staff drafting a response on behalf of the user. Write a professional, concise response that the user can review and send. Match the tone to the context. Do not add subject lines unless it's clearly an email.`,
  research: `You are a research assistant. Given the content, provide deeper analysis: key facts, implications, what the user should know, and recommended next steps. Be thorough but concise. Cite specifics.`,
  summarize: `You are a Chief of Staff summarizing content for a busy executive. Extract the 3-5 most important points. Highlight any action items or deadlines. Keep it under 150 words.`,
  rewrite: `You are a skilled editor. Rewrite the content to be clearer, more concise, and more professional. Preserve the key message but improve the quality. Do not change the meaning.`,
}

/**
 * Execute an action on an approval item — draft a response, research deeper,
 * summarize, or rewrite. Creates a new approval item with the result.
 */
export async function executeAction(
  itemId: string,
  executionType: ExecutionType,
  userId: string,
  customPrompt?: string,
  apiKey?: string
): Promise<ExecutionResult> {
  const item = await prisma.approvalItem.findUnique({
    where: { id: itemId },
    include: { agent: true },
  })

  if (!item) throw new Error('Item not found')

  const goals = await getUserGoals(userId)
  const openai = getOpenAIClient(apiKey)

  const systemPrompt = customPrompt
    ? `${EXECUTION_PROMPTS[executionType]}\n\nAdditional instructions: ${customPrompt}`
    : EXECUTION_PROMPTS[executionType]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${formatGoalsForContext(goals)}`,
      },
      {
        role: 'user',
        content: `Original content from ${item.agent.name} (${item.agent.category}):\n\nTitle: ${item.action}\n\nContent:\n${item.detail}`,
      },
    ],
    temperature: executionType === 'research' ? 0.5 : 0.7,
    max_tokens: 1024,
  })

  const output = response.choices[0]?.message?.content || ''

  const actionLabels: Record<ExecutionType, string> = {
    draft_response: 'Drafted response',
    research: 'Research deep-dive',
    summarize: 'Executive summary',
    rewrite: 'Polished rewrite',
  }

  // Create a new approval item with the result
  const newItem = await prisma.approvalItem.create({
    data: {
      agentId: item.agentId,
      action: `${actionLabels[executionType]}: ${item.action.slice(0, 60)}`,
      detail: output,
      urgency: item.urgency,
      reasoning: `${actionLabels[executionType]} generated from "${item.action}" by Chief of Staff AI`,
      suggestedAction: 'approve',
      goalAlignment: item.goalAlignment,
      relatedItemIds: JSON.stringify([item.id]),
    },
  })

  await prisma.activityLog.create({
    data: {
      agentId: item.agentId,
      action: `${actionLabels[executionType]}: ${item.action.slice(0, 60)}`,
      type: 'auto',
      category: item.agent.category,
      detail: `Chief of Staff executed "${executionType}" on content from ${item.agent.name}`,
      metadata: JSON.stringify({ sourceItemId: item.id, executionType }),
    },
  })

  return {
    type: executionType,
    output,
    approvalId: newItem.id,
  }
}
