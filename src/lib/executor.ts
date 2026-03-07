import { getOpenAIClient } from '@/lib/openai'

export type ExecutionAction = 'draft_response' | 'deep_dive' | 'summarize' | 'rewrite'

interface ExecutionResult {
  action: ExecutionAction
  output: string
}

const ACTION_PROMPTS: Record<ExecutionAction, string> = {
  draft_response: `You are a Chief of Staff drafting a response on behalf of the user. Write a professional, clear reply based on the content provided. Match the appropriate tone. Keep it concise but thorough.`,
  deep_dive: `You are a research analyst. The user wants to understand this topic deeper. Provide a thorough analysis with key points, implications, and actionable insights. Include context that isn't immediately obvious.`,
  summarize: `You are an executive assistant creating a brief for a busy leader. Summarize the content into 3-5 bullet points capturing the essential information. Lead with the most important point. Be ruthlessly concise.`,
  rewrite: `You are an editor polishing content for publication. Rewrite the content to be clearer, more engaging, and more professional. Maintain the original meaning and key information. Fix any grammar or style issues.`,
}

const ACTION_LABELS: Record<ExecutionAction, string> = {
  draft_response: 'Draft Response',
  deep_dive: 'Deep Dive Research',
  summarize: 'Executive Summary',
  rewrite: 'Polished Rewrite',
}

export function getActionLabel(action: ExecutionAction): string {
  return ACTION_LABELS[action] || action
}

export async function executeAction(
  action: ExecutionAction,
  content: string,
  context: string,
  apiKey: string
): Promise<ExecutionResult> {
  const systemPrompt = ACTION_PROMPTS[action]
  if (!systemPrompt) {
    throw new Error(`Unknown action: ${action}`)
  }

  const openai = getOpenAIClient(apiKey)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${context ? `Context: ${context}\n\n` : ''}Content:\n${content}`,
      },
    ],
    temperature: action === 'summarize' ? 0.3 : 0.7,
    max_tokens: action === 'deep_dive' ? 2048 : 1024,
  })

  return {
    action,
    output: response.choices[0]?.message?.content || 'No output generated.',
  }
}
