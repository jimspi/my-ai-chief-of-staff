import OpenAI from 'openai'

// Cache client by API key to avoid creating new instances for the same key,
// but ensure different keys get different clients
const clientCache = new Map<string, OpenAI>()

export function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OpenAI API key not configured. Add it in Settings or set OPENAI_API_KEY environment variable.')
  }

  let client = clientCache.get(key)
  if (!client) {
    client = new OpenAI({ apiKey: key })
    clientCache.set(key, client)
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
