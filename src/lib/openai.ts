import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OpenAI API key not configured')
  }

  if (!client || apiKey) {
    client = new OpenAI({ apiKey: key })
  }
  return client
}

export async function generateAgentResponse(
  prompt: string,
  systemPrompt: string,
  apiKey?: string
): Promise<string> {
  const openai = getOpenAIClient(apiKey)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  })

  return response.choices[0]?.message?.content || ''
}

export async function analyzeRisk(
  action: string,
  detail: string,
  apiKey?: string
): Promise<{ score: number; reasoning: string; riskTag: string | null }> {
  const openai = getOpenAIClient(apiKey)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a risk assessment AI. Analyze the proposed agent action and return a JSON object with:
- "score": a number 0-100 indicating risk level
- "reasoning": a brief explanation of the risk assessment
- "riskTag": one of "financial-alert", "content-sensitive", "privacy-sensitive", "financial-communication", or null if no special risk

Respond ONLY with valid JSON, no markdown.`,
      },
      {
        role: 'user',
        content: `Action: ${action}\nDetail: ${detail}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 256,
  })

  const text = response.choices[0]?.message?.content || '{}'
  try {
    return JSON.parse(text)
  } catch {
    return { score: 50, reasoning: 'Unable to assess risk automatically', riskTag: null }
  }
}

export async function generateApprovalSuggestion(
  action: string,
  detail: string,
  agentName: string,
  apiKey?: string
): Promise<{ suggestion: 'approve' | 'deny' | 'review'; reasoning: string }> {
  const openai = getOpenAIClient(apiKey)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an AI governance advisor. Given an agent's proposed action, suggest whether to "approve", "deny", or "review" (needs human review). Return a JSON object with:
- "suggestion": one of "approve", "deny", "review"
- "reasoning": a brief explanation

Respond ONLY with valid JSON, no markdown.`,
      },
      {
        role: 'user',
        content: `Agent: ${agentName}\nAction: ${action}\nDetail: ${detail}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 256,
  })

  const text = response.choices[0]?.message?.content || '{}'
  try {
    return JSON.parse(text)
  } catch {
    return { suggestion: 'review', reasoning: 'Unable to auto-assess. Manual review recommended.' }
  }
}
