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
